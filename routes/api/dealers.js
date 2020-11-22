/* eslint-disable linebreak-style */
const express = require('express');
const validator = require('validator');
const Sequelize = require('sequelize');
const models = require('../../db/models');
const paginator = require('../../helpers/paginator');
const carHelper = require('../../helpers/car');
const distanceHelper = require('../../helpers/distance');
const minio = require('../../helpers/minio');

const {
    Op
} = Sequelize;
const router = express.Router();

const DEFAULT_LIMIT = process.env.DEFAULT_LIMIT || 10;
const MAX_LIMIT = process.env.MAX_LIMIT || 50;

router.get('/', async (req, res) => {
    let {
        page,
        limit,
        by,
        sort,
        brandId,
        condition,
        name,
        cityId,
        subdistrictId,
        radius,
        latitude,
        longitude
    } = req.query;
    let offset = 0;

    if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
    if (parseInt(limit) > MAX_LIMIT) limit = MAX_LIMIT;
    if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
    else page = 1;

    if (!by) by = 'createdAt';
    if (!sort) sort = 'asc';
    else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';
    let order;

    if (by == 'name') {
        order = [
            [{
                model: models.User,
                as: 'user'
            }, by, sort]
        ]
    } else if (by == 'countListing') {
        order = [
            [models.sequelize.col('countListing'), sort]
        ]
    } else {
        order = [
            [by, sort]
        ]
    }

    const where = {
        isPartner: true
    };

    if (brandId) {
        Object.assign(where, {
            authorizedBrandId: brandId
        });
    }

    if (name) {
        Object.assign(where, {
            [Op.and]: [
                models.sequelize.literal(`(SELECT "Users"."name" 
                FROM "Users" 
                WHERE "Users"."id" = "Dealer"."userId"
                    AND "Users"."deletedAt" IS NULL) iLike '%${name}%'
            `)
            ]
        });
    }

    const whereCar = {
        userId: {
            [Op.eq]: models.sequelize.col('Dealer.userId')
        }
    };

    let whereCondition = '';
    if (condition) {
        Object.assign(whereCar, {
            condition
        });

        whereCondition = `AND "Cars"."condition" = ${condition}`;
    }

    if (cityId) {
        const city = await models.City.findByPk(cityId);
        if (!city) {
            return res.status(400).json({
                success: false,
                errors: 'City not found!'
            });
        }

        const queryWhereCity = `(SELECT "Users"."cityId" 
        FROM "Users" 
        WHERE "Users"."id" = "Dealer"."userId"
            AND "Users"."deletedAt" IS NULL) = ${cityId}`;

        if (subdistrictId) {
            const subdistrict = await models.SubDistrict.findOne({
                where: {
                    id: subdistrictId,
                    cityId
                }
            });

            if (!subdistrict) {
                return res.status(400).json({
                    success: false,
                    errors: 'Subdistrict not found!'
                });
            }

            Object.assign(where, {
                [Op.and]: [
                    models.sequelize.literal(queryWhereCity),
                    models.sequelize.literal(`(SELECT "Users"."subdistrictId" 
                    FROM "Users" 
                    WHERE "Users"."id" = "Dealer"."userId"
                        AND "Users"."deletedAt" IS NULL) = ${subdistrictId}
                `)
                ]
            });
        } else {
            Object.assign(where, {
                [Op.and]: [
                    models.sequelize.literal(queryWhereCity)
                ]
            });
        }
    }

    const customAttributes = [];
    if (radius && latitude && longitude) {
        const queryLatLong = field => `(SELECT "s"."${field}" 
        FROM "SubDistricts" s 
        WHERE "s"."id" = (SELECT "Users"."subdistrictId" 
            FROM "Users" 
            WHERE "Users"."id" = "Dealer"."userId"
                AND "Users"."deletedAt" IS NULL
        )
    )`;

        const distances = models.sequelize.literal(distanceHelper.calculate(latitude, longitude, queryLatLong('latitude'), queryLatLong('longitude')));
        Object.assign(where, {
            [Op.and]: [models.sequelize.where(distances, {
                [Op.lte]: radius
            })]
        });

        customAttributes.push([
            distances,
            'distancer'
        ]);
    }

    return models.Dealer.findAll({
            attributes: Object.keys(models.Dealer.attributes).concat([
                [
                    models.sequelize.literal(
                        `(SELECT COUNT("Cars"."id") 
                FROM "Cars" 
                WHERE "Cars"."userId" = "Dealer"."userId" 
                    ${whereCondition} 
                    AND "Cars"."deletedAt" IS NULL
            )`
                    ),
                    'countListing'
                ],
                [
                    models.sequelize.literal(
                        `(SELECT COUNT("Cars"."id") 
                FROM "Cars" 
                WHERE "Cars"."brandId" = "Dealer"."authorizedBrandId"  
                    ${whereCondition} 
                    AND "Cars"."userId" = "Dealer"."userId"
                    AND "Cars"."deletedAt" IS NULL
            )`
                    ),
                    'countListingAuthorizedBrand'
                ],
                [
                    models.sequelize.literal(
                        `(COALESCE(NULLIF((SELECT "GroupModels"."name" 
                FROM "GroupModels" 
                WHERE "GroupModels"."brandId" = "Dealer"."authorizedBrandId" 
                    AND "GroupModels"."deletedAt" IS NULL
                    AND (SELECT COUNT("Cars"."id") 
                        FROM "Cars" 
                        WHERE "Cars"."brandId" = "Dealer"."authorizedBrandId" 
                            AND "Cars"."userId" = "Dealer"."userId" 
                            ${whereCondition}
                            AND "Cars"."groupModelId" = "GroupModels"."id"
                            AND "Cars"."deletedAt" IS NULL) > 0
                ORDER BY (SELECT COUNT("Cars"."id") 
                    FROM "Cars" 
                    WHERE "Cars"."brandId" = "Dealer"."authorizedBrandId" 
                        AND "Cars"."userId" = "Dealer"."userId" 
                        ${whereCondition} 
                        AND "Cars"."groupModelId" = "GroupModels"."id"
                        AND "Cars"."deletedAt" IS NULL) DESC 
                LIMIT 1
            ), ''), ''))`
                    ),
                    'groupModelMostListing'
                ]
            ]),
            include: [{
                    model: models.User,
                    as: 'user',
                    attributes: {
                        include: customAttributes,
                        exclude: ['password', 'createdAt', 'updatedAt', 'deletedAt']
                    },
                    include: [{
                            model: models.File,
                            as: 'file',
                            attributes: {
                                exclude: ['createdAt', 'updatedAt', 'deletedAt']
                            }
                        },
                        {
                            model: models.City,
                            as: 'city'
                        },
                        {
                            model: models.SubDistrict,
                            as: 'subdistrict'
                        }
                    ]
                },
                {
                    model: models.Car,
                    as: 'car',
                    required: false,
                    where: whereCar,
                    attributes: {
                        exclude: ['createdAt', 'updatedAt', 'deletedAt']
                    }
                }
            ],
            where,
            order,
            offset,
            limit
        })
        .then(async data => {
            const count = await models.Dealer.count({
                distinct: true,
                col: 'id',
                include: [{
                    model: models.Car,
                    as: 'car',
                    required: false,
                    where: whereCar
                }],
                where
            });
            const pagination = paginator.paging(page, count, limit);

            await Promise.all(
                data.map(async item => {
                    if (item.user.file.url) {
                        const url = await minio.getUrl(item.user.file.url).then(res => {
                            return res;
                        }).catch(err => {
                            res.status(422).json({
                                success: false,
                                errors: err
                            });
                        });

                        item.user.file.dataValues.fileUrl = url;
                    } else {
                        item.user.file.dataValues.fileUrl = null;
                    }

                    await Promise.all(
                        item.car.map(async itemCar => {
                            if (itemCar.STNKphoto) {
                                const url = await minio.getUrl(itemCar.STNKphoto).then(res => {
                                    return res;
                                }).catch(err => {
                                    res.status(422).json({
                                        success: false,
                                        errors: err
                                    });
                                });

                                itemCar.dataValues.stnkUrl = url;
                            } else {
                                itemCar.dataValues.stnkUrl = null;
                            }
                        })
                    );
                })
            );

            res.json({
                success: true,
                pagination,
                data
            });
        })
        .catch(err => {
            res.status(422).json({
                success: false,
                errors: err.message
            });
        });
});

router.get('/id/:id', async (req, res) => {
    const {
        id
    } = req.params;

    return models.Dealer.findOne({
            include: [{
                    model: models.User,
                    as: 'user',
                    attributes: {
                        exclude: ['password', 'createdAt', 'updatedAt', 'deletedAt']
                    },
                    include: [{
                            model: models.File,
                            as: 'file',
                            attributes: {
                                exclude: ['createdAt', 'updatedAt', 'deletedAt']
                            }
                        },
                        {
                            model: models.City,
                            as: 'city'
                        },
                        {
                            model: models.SubDistrict,
                            as: 'subdistrict'
                        }
                    ]
                },
                {
                    model: models.Brand,
                    as: 'brand',
                    attributes: {
                        exclude: ['createdAt', 'updatedAt', 'deletedAt']
                    }
                }
            ],
            where: {
                id
            }
        })
        .then(async data => {
            if (data) {
                if (data.brand.logo) {
                    const url = await minio.getUrl(data.brand.logo).then(res => {
                        return res;
                    }).catch(err => {
                        res.status(422).json({
                            success: false,
                            errors: err
                        });
                    });

                    data.brand.dataValues.logoUrl = url;
                } else {
                    data.brand.dataValues.logoUrl = null;
                }

                if (data.user.file.url) {
                    const url = await minio.getUrl(data.user.file.url).then(res => {
                        return res;
                    }).catch(err => {
                        res.status(422).json({
                            success: false,
                            errors: err
                        });
                    });

                    data.user.file.dataValues.fileUrl = url;
                } else {
                    data.user.file.dataValues.fileUrl = null;
                }
            }

            res.json({
                success: true,
                data
            });
        })
        .catch(err =>
            res.status(422).json({
                success: false,
                errors: err.message
            })
        );
});

router.get('/listingBrandForDealer', async (req, res) => {
    let {
        page,
        limit,
        sort,
        condition
    } = req.query;
    let offset = 0;

    if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
    if (parseInt(limit) > MAX_LIMIT) limit = MAX_LIMIT;
    if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
    else page = 1;

    let order = [
        ['createdAt', 'desc']
    ];
    if (!sort) sort = 'asc';
    else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';

    let whereCondition = '';
    const whereCar = {
        userId: {
            [Op.eq]: models.sequelize.col('dealer.userId')
        }
    };

    if (condition) {
        Object.assign(whereCar, {
            condition
        });

        whereCondition = `AND "Cars"."condition" = ${condition}`
    }

    let groupModelMostListing = (field) => {
        return models.sequelize.literal(
            `(SELECT "GroupModels"."${field}" 
                FROM "GroupModels" 
                WHERE "GroupModels"."brandId" = "Brand"."id" 
                AND "GroupModels"."deletedAt" IS NULL 
                AND (SELECT COUNT("Cars"."id") 
                    FROM "Cars" 
                    WHERE "Cars"."groupModelId" = "GroupModels"."id" 
                    AND "Cars"."status" = 0 
                    ${whereCondition} 
                    AND "Cars"."userId" IN ( 
                        SELECT "Dealers"."userId" 
                        FROM "Dealers" 
                        WHERE "Dealers"."authorizedBrandId" = "Brand"."id" 
                    )
                    AND "Cars"."deletedAt" IS NULL 
                ) > 0
                ORDER BY 
                    (SELECT COUNT("Cars"."id") 
                        FROM "Cars" 
                        WHERE "Cars"."groupModelId" = "GroupModels"."id" 
                        AND "Cars"."status" = 0 
                        ${whereCondition} 
                        AND "Cars"."userId" IN ( 
                            SELECT "Dealers"."userId" 
                            FROM "Dealers" 
                            WHERE "Dealers"."authorizedBrandId" = "Brand"."id" 
                        )
                        AND "Cars"."deletedAt" IS NULL 
                    ) 
                DESC LIMIT 1 
            )`
        );
    };

    return models.Brand.findAll({
            attributes: Object.keys(models.Brand.attributes).concat([
                [
                    models.sequelize.literal(
                        `(SELECT COUNT("Cars"."id") 
                            FROM "Cars" 
                            WHERE "Cars"."brandId" = "Brand"."id" 
                            ${whereCondition} 
                            AND "Cars"."userId" IN 
                                (SELECT "Dealers"."userId" 
                                FROM "Dealers" 
                                WHERE "Dealers"."authorizedBrandId" = "Brand"."id"
                                AND "Dealers"."deletedAt" IS NULL)
                            AND "Cars"."deletedAt" IS NULL 
                        )`
                    ),
                    'countListing'
                ],
                [
                    models.sequelize.literal(
                        `(SELECT COUNT("Dealers"."id") 
                            FROM "Dealers" 
                            WHERE "Dealers"."authorizedBrandId" = "Brand"."id" 
                            AND "Dealers"."isPartner" = true 
                            AND (SELECT COUNT("Cars"."id") 
                                FROM "Cars" 
                                WHERE "Cars"."status" = 0 
                                ${whereCondition} 
                                AND "Cars"."userId" IN ( 
                                    SELECT "Dealers"."userId" 
                                    FROM "Dealers" 
                                    WHERE "Dealers"."authorizedBrandId" = "Brand"."id" 
                                )
                                AND "Cars"."deletedAt" IS NULL 
                            ) > 0
                            AND "Dealers"."deletedAt" IS NULL 
                        )`
                    ),
                    'countPartner'
                ],
                [groupModelMostListing("name"), 'groupModelMostListing'],
                [groupModelMostListing("id"), 'groupModelMostListingId'],
                [
                    models.sequelize.literal(
                        `(SELECT 
                            (SELECT COUNT("Cars"."id") 
                                FROM "Cars" 
                                WHERE "Cars"."groupModelId" = "GroupModels"."id" 
                                AND "Cars"."status" = 0 
                                ${whereCondition} 
                                AND "Cars"."userId" IN ( 
                                    SELECT "Dealers"."userId" 
                                    FROM "Dealers" 
                                    WHERE "Dealers"."authorizedBrandId" = "Brand"."id" 
                                )
                                AND "Cars"."deletedAt" IS NULL 
                            ) groupModelMaxListing 
                            FROM "GroupModels" 
                            WHERE "GroupModels"."brandId" = "Brand"."id" 
                            AND "GroupModels"."deletedAt" IS NULL 
                            ORDER BY groupModelMaxListing 
                            DESC LIMIT 1 
                        )`
                    ),
                    'groupModelCountListing'
                ]
            ]),
            include: [{
                model: models.Dealer,
                as: 'dealer',
                attributes: {
                    exclude: ['createdAt', 'updatedAt', 'deletedAt']
                },
                include: [{
                    required: false,
                    model: models.Car,
                    as: 'car',
                    where: whereCar,
                    attributes: {
                        exclude: ['createdAt', 'updatedAt', 'deletedAt']
                    }
                }]
            }],
            offset,
            limit
        })
        .then(async data => {
            const count = await models.Brand.count({
                distinct: true,
                col: 'id',
                include: [{
                    model: models.Car,
                    as: 'car',
                    where: {
                        condition
                    }
                }]
            });
            const pagination = paginator.paging(page, count, limit);

            res.json({
                success: true,
                pagination,
                data
            });
        })
        .catch(err => {
            res.status(422).json({
                success: false,
                errors: err.message
            });
        });
});

router.get('/listingBrandForDealer/id/:id', async (req, res) => {
    const {
        id
    } = req.params;
    let {
        page,
        limit,
        sort,
        condition,
        groupModelId
    } = req.query;
    let offset = 0;

    if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
    if (parseInt(limit) > MAX_LIMIT) limit = MAX_LIMIT;
    if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
    else page = 1;

    let order = [
        ['createdAt', 'desc']
    ];
    if (!sort) sort = 'asc';
    else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';

    let whereCondition = '';
    const whereCar = {
        userId: {
            [Op.in]: models.sequelize.literal(
                `(SELECT "Dealers"."userId" 
                    FROM "Dealers" 
                    WHERE "Dealers"."deletedAt" IS NULL 
                        AND "Dealers"."authorizedBrandId" = ${id}
                )`
            )
        }
    };

    if (condition) {
        Object.assign(whereCar, {
            condition
        });

        whereCondition += ` AND "Cars"."condition" = ${condition}`
    }

    if (groupModelId) {
        Object.assign(whereCar, {
            groupModelId
        });

        whereCondition += ` AND "Cars"."groupModelId" = ${groupModelId}`
    }

    const addAttributes = {
        fields: [
            'like',
            'view',
            'numberOfBidder',
            'bidAmount'
        ],
        upperCase: true,
    };

    const addAttribute = await carHelper.customFields(addAttributes);
    return models.Brand.findByPk(id, {
            attributes: Object.keys(models.Brand.attributes).concat([
                [
                    models.sequelize.literal(
                        `(SELECT COUNT("Cars"."id") 
                            FROM "Cars" 
                            WHERE "Cars"."brandId" = "Brand"."id" 
                            ${whereCondition} 
                            AND "Cars"."userId" IN 
                                (SELECT "Dealers"."userId" 
                                FROM "Dealers" 
                                WHERE "Dealers"."authorizedBrandId" = "Brand"."id"
                                AND "Dealers"."deletedAt" IS NULL)
                            AND "Cars"."deletedAt" IS NULL 
                        )`
                    ),
                    'countListing'
                ],
                [
                    models.sequelize.literal(
                        `(SELECT COUNT("Dealers"."id") 
                            FROM "Dealers" 
                            WHERE "Dealers"."authorizedBrandId" = "Brand"."id" 
                                AND "Dealers"."isPartner" = true 
                                AND "Dealers"."deletedAt" IS NULL
                        )`
                    ),
                    'countPartner'
                ],
                [
                    models.sequelize.literal(
                        `(SELECT "GroupModels"."name" 
                            FROM "GroupModels" 
                            WHERE "GroupModels"."brandId" = "Brand"."id" 
                            AND "GroupModels"."deletedAt" IS NULL 
                            AND (SELECT COUNT("Cars"."id") 
                                FROM "Cars" 
                                WHERE "Cars"."groupModelId" = "GroupModels"."id" 
                                AND "Cars"."status" = 0 
                                ${whereCondition} 
                                AND "Cars"."userId" IN ( 
                                    SELECT "Dealers"."userId" 
                                    FROM "Dealers" 
                                    WHERE "Dealers"."authorizedBrandId" = "Brand"."id" 
                                )
                                AND "Cars"."deletedAt" IS NULL 
                            ) > 0
                            ORDER BY 
                                (SELECT COUNT("Cars"."id") 
                                    FROM "Cars" 
                                    WHERE "Cars"."groupModelId" = "GroupModels"."id" 
                                    AND "Cars"."status" = 0 
                                    ${whereCondition} 
                                    AND "Cars"."userId" IN ( 
                                        SELECT "Dealers"."userId" 
                                        FROM "Dealers" 
                                        WHERE "Dealers"."authorizedBrandId" = "Brand"."id" 
                                    )
                                    AND "Cars"."deletedAt" IS NULL 
                                ) 
                            DESC LIMIT 1 
                        )`
                    ),
                    'groupModelMostListing'
                ],
                [
                    models.sequelize.literal(
                        `(SELECT 
                            (SELECT COUNT("Cars"."id") 
                                FROM "Cars" 
                                WHERE "Cars"."groupModelId" = "GroupModels"."id" 
                                AND "Cars"."status" = 0 
                                ${whereCondition} 
                                AND "Cars"."userId" IN ( 
                                    SELECT "Dealers"."userId" 
                                    FROM "Dealers" 
                                    WHERE "Dealers"."authorizedBrandId" = "Brand"."id" 
                                )
                                AND "Cars"."deletedAt" IS NULL 
                            ) groupModelMaxListing 
                            FROM "GroupModels" 
                            WHERE "GroupModels"."brandId" = "Brand"."id" 
                            AND "GroupModels"."deletedAt" IS NULL 
                            ORDER BY groupModelMaxListing 
                            DESC LIMIT 1 
                        )`
                    ),
                    'groupModelCountListing'
                ]
            ]),
            include: [{
                required: false,
                model: models.Car,
                as: 'car',
                where: whereCar,
                subQuery: true,
                attributes: Object.keys(models.Car.attributes).concat(addAttribute),
                include: [{
                        model: models.User,
                        as: 'user',
                        include: [{
                                model: models.Dealer,
                                as: 'dealer',
                                attributes: {
                                    exclude: ['createdAt', 'updatedAt', 'deletedAt']
                                }
                            },
                            {
                                model: models.File,
                                as: 'file',
                                attributes: {
                                    exclude: ['createdAt', 'updatedAt', 'deletedAt']
                                }
                            },
                            {
                                model: models.City,
                                as: 'city'
                            },
                            {
                                model: models.SubDistrict,
                                as: 'subdistrict'
                            }
                        ]
                    },
                    {
                        model: models.ExteriorGalery,
                        as: 'exteriorGalery',
                        attributes: {
                            exclude: ['createdAt', 'updatedAt', 'deletedAt']
                        },
                        include: {
                            model: models.File,
                            as: 'file',
                            attributes: ['type', 'url']
                        }
                    },
                    {
                        model: models.Brand,
                        as: 'brand',
                        attributes: {
                            exclude: ['createdAt', 'updatedAt', 'deletedAt']
                        }
                    },
                    {
                        model: models.Model,
                        as: 'model',
                        attributes: {
                            exclude: ['createdAt', 'updatedAt', 'deletedAt']
                        }
                    },
                    {
                        model: models.GroupModel,
                        as: 'groupModel',
                        attributes: {
                            exclude: ['createdAt', 'updatedAt', 'deletedAt']
                        }
                    },
                    {
                        model: models.ModelYear,
                        as: 'modelYear',
                        attributes: {
                            exclude: ['createdAt', 'updatedAt', 'deletedAt']
                        }
                    },
                    {
                        model: models.Color,
                        as: 'exteriorColor',
                        attributes: {
                            exclude: ['createdAt', 'updatedAt', 'deletedAt']
                        }
                    },
                    {
                        model: models.Color,
                        as: 'interiorColor',
                        attributes: {
                            exclude: ['createdAt', 'updatedAt', 'deletedAt']
                        }
                    }
                ],
                limit,
                offset
            }]
        })
        .then(async data => {
            const count = await models.Brand.count({
                where: {
                    id
                },
                include: [{
                    model: models.Car,
                    as: 'car',
                    where: whereCar
                }]
            });
            const pagination = paginator.paging(page, count, limit);

            if (data) {
                await Promise.all(
                    data.car.map(async item => {
                        if (item.STNKphoto) {
                            const url = await minio.getUrl(item.STNKphoto).then(res => {
                                return res;
                            }).catch(err => {
                                res.status(422).json({
                                    success: false,
                                    errors: err
                                });
                            });

                            item.dataValues.stnkUrl = url;
                        } else {
                            item.dataValues.stnkUrl = null;
                        }

                        await Promise.all(
                            item.exteriorGalery.map(async itemExteriorGalery => {
                                if (itemExteriorGalery.file.url) {
                                    const url = await minio.getUrl(itemExteriorGalery.file.url).then(res => {
                                        return res;
                                    }).catch(err => {
                                        res.status(422).json({
                                            success: false,
                                            errors: err
                                        });
                                    });

                                    itemExteriorGalery.file.dataValues.fileUrl = url;
                                } else {
                                    itemExteriorGalery.file.dataValues.fileUrl = null;
                                }
                            })
                        );
                    })
                );
            }

            res.json({
                success: true,
                pagination,
                data
            });
        })
        .catch(err => {
            res.status(422).json({
                success: false,
                errors: err.message
            });
        });
});

router.get('/car/sellList/:id', async (req, res) => {
    let {
        page,
        limit,
        sort
    } = req.query;

    const {
        id
    } = req.params;
    let offset = 0;

    if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
    if (parseInt(limit) > MAX_LIMIT) limit = MAX_LIMIT;
    if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
    else page = 1;

    let order = [
        ['createdAt', 'desc']
    ];
    if (!sort) sort = 'asc';
    else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';

    const addAttributes = {
        fields: [
            'like',
            'view',
            'numberOfBidder',
            'bidAmount',
            'highestBidder'
        ],
        upperCase: true,
    };

    const addAttribute = await carHelper.customFields(addAttributes);
    return models.Dealer.findByPk(id, {
            raw: true,
            nest: true,
            include: [{
                model: models.User,
                as: 'user',
                attributes: {
                    exclude: ['password', 'createdAt', 'updatedAt', 'deletedAt']
                },
                include: [{
                        model: models.File,
                        as: 'file',
                        attributes: {
                            exclude: ['createdAt', 'updatedAt', 'deletedAt']
                        }
                    },
                    {
                        model: models.City,
                        as: 'city'
                    },
                    {
                        model: models.SubDistrict,
                        as: 'subdistrict'
                    }
                ]
            }]
        })
        .then(async data => {
            let count = 0;
            if (data) {
                const whereCar = {
                    userId: data.userId
                };

                await models.Car.findAll({
                    where: whereCar,
                    attributes: Object.keys(models.Car.attributes).concat(addAttribute),
                    include: [{
                            model: models.ExteriorGalery,
                            as: 'exteriorGalery',
                            attributes: {
                                exclude: ['createdAt', 'updatedAt', 'deletedAt']
                            },
                            include: {
                                model: models.File,
                                as: 'file',
                                attributes: ['type', 'url']
                            }
                        },
                        {
                            model: models.InteriorGalery,
                            as: 'interiorGalery',
                            attributes: ['id', 'fileId', 'carId'],
                            include: [{
                                model: models.File,
                                as: 'file',
                                attributes: {
                                    exclude: ['createdAt', 'updatedAt', 'deletedAt']
                                }
                            }]
                        },
                        {
                            model: models.Brand,
                            as: 'brand',
                            attributes: {
                                exclude: ['createdAt', 'updatedAt', 'deletedAt']
                            }
                        },
                        {
                            model: models.Model,
                            as: 'model',
                            attributes: {
                                exclude: ['createdAt', 'updatedAt', 'deletedAt']
                            }
                        },
                        {
                            model: models.GroupModel,
                            as: 'groupModel',
                            attributes: {
                                exclude: ['createdAt', 'updatedAt', 'deletedAt']
                            }
                        },
                        {
                            model: models.ModelYear,
                            as: 'modelYear',
                            attributes: {
                                exclude: ['createdAt', 'updatedAt', 'deletedAt']
                            }
                        },
                        {
                            model: models.Color,
                            as: 'exteriorColor',
                            attributes: {
                                exclude: ['createdAt', 'updatedAt', 'deletedAt']
                            }
                        },
                        {
                            model: models.Color,
                            as: 'interiorColor',
                            attributes: {
                                exclude: ['createdAt', 'updatedAt', 'deletedAt']
                            }
                        },
                        {
                            model: models.MeetingSchedule,
                            as: 'meetingSchedule',
                            attributes: ['id', 'carId', 'day', 'startTime', 'endTime']
                        }
                    ],
                    limit,
                    offset
                }).then(async resultCar => {
                    data.car = resultCar;
                });

                count = await models.Car.count({
                    distinct: true,
                    col: 'id',
                    where: whereCar
                });
            }

            const pagination = paginator.paging(page, count, limit);

            if (data) {
                if (data.user.file.url) {
                    const url = await minio.getUrl(data.user.file.url).then(res => {
                        return res;
                    }).catch(err => {
                        res.status(422).json({
                            success: false,
                            errors: err
                        });
                    });

                    data.user.file.fileUrl = url;
                } else {
                    data.user.file.fileUrl = null;
                }

                await Promise.all(
                    data.car.map(async item => {
                        if (item.STNKphoto) {
                            const url = await minio.getUrl(item.STNKphoto).then(res => {
                                return res;
                            }).catch(err => {
                                res.status(422).json({
                                    success: false,
                                    errors: err
                                });
                            });

                            item.dataValues.stnkUrl = url;
                        } else {
                            item.dataValues.stnkUrl = null;
                        }

                        if (item.modelYear.picture) {
                            const url = await minio.getUrl(item.modelYear.picture).then(res => {
                                return res;
                            }).catch(err => {
                                res.status(422).json({
                                    success: false,
                                    errors: err
                                });
                            });

                            item.modelYear.dataValues.pictureUrl = url;
                        } else {
                            item.modelYear.dataValues.pictureUrl = null;
                        }

                        if (item.brand.logo) {
                            const url = await minio.getUrl(item.brand.logo).then(res => {
                                return res;
                            }).catch(err => {
                                res.status(422).json({
                                    success: false,
                                    errors: err
                                });
                            });

                            item.brand.dataValues.logoUrl = url;
                        } else {
                            item.brand.dataValues.logoUrl = null;
                        }

                        await Promise.all(
                            item.interiorGalery.map(async itemInteriorGalery => {
                                if (itemInteriorGalery.file.url) {
                                    const url = await minio.getUrl(itemInteriorGalery.file.url).then(res => {
                                        return res;
                                    }).catch(err => {
                                        res.status(422).json({
                                            success: false,
                                            errors: err
                                        });
                                    });

                                    itemInteriorGalery.file.dataValues.fileUrl = url;
                                } else {
                                    itemInteriorGalery.file.dataValues.fileUrl = null;
                                }
                            }),

                            item.exteriorGalery.map(async itemExteriorGalery => {
                                if (itemExteriorGalery.file.url) {
                                    const url = await minio.getUrl(itemExteriorGalery.file.url).then(res => {
                                        return res;
                                    }).catch(err => {
                                        res.status(422).json({
                                            success: false,
                                            errors: err
                                        });
                                    });

                                    itemExteriorGalery.file.dataValues.fileUrl = url;
                                } else {
                                    itemExteriorGalery.file.dataValues.fileUrl = null;
                                }
                            })
                        );
                    })
                );
            }

            res.json({
                success: true,
                pagination,
                data
            });
        })
        .catch(err => {
            res.status(422).json({
                success: false,
                errors: err.message
            });
        });
});

router.get('/car/bidList/:id', async (req, res) => {
    let {
        page,
        limit,
        sort
    } = req.query;

    const {
        id
    } = req.params;
    let offset = 0;

    if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
    if (parseInt(limit) > MAX_LIMIT) limit = MAX_LIMIT;
    if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
    else page = 1;

    let order = [
        ['createdAt', 'desc']
    ];
    if (!sort) sort = 'asc';
    else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';

    const whereBargain = {
        [Op.or]: [{
                bidType: 0
            },
            {
                bidType: 1
            }
        ],
        [Op.and]: [{
            userId: {
                [Op.eq]: models.sequelize.literal(
                    `(SELECT "userId" 
                            FROM "Dealers" 
                            WHERE "Dealers"."id" = ${id} 
                                AND "deletedAt" IS NULL
                        )`
                )
            }
        }]
    }

    const addAttributes = {
        fields: [
            'like',
            'view',
            'numberOfBidder',
            'bidAmount',
            'highestBidder'
        ],
        upperCase: true,
    };

    const addAttribute = await carHelper.customFields(addAttributes);
    return models.Dealer.findByPk(id, {
            raw: true,
            nest: true,
            include: [{
                model: models.User,
                as: 'user',
                attributes: {
                    exclude: ['password', 'createdAt', 'updatedAt', 'deletedAt']
                },
                include: [{
                        model: models.File,
                        as: 'file',
                        attributes: {
                            exclude: ['createdAt', 'updatedAt', 'deletedAt']
                        }
                    },
                    {
                        model: models.City,
                        as: 'city'
                    },
                    {
                        model: models.SubDistrict,
                        as: 'subdistrict'
                    }
                ]
            }]
        })
        .then(async data => {
            let count = 0;
            if (data) {
                countBargains = models.sequelize.literal(
                    `(SELECT COUNT("Bargains"."id") 
                        FROM "Bargains" 
                        WHERE "Bargains"."carId" = "Car"."id" 
                            AND "Bargains"."deletedAt" IS NULL
                    )`
                );

                let whereCar = {
                    [Op.and]: [
                        models.sequelize.where(countBargains, {
                            [Op.gt]: 0
                        }),
                        {
                            userId: data.userId
                        }
                    ]
                }

                const cars = await models.Car.findAll({
                    where: whereCar,
                    attributes: Object.keys(models.Car.attributes).concat(addAttribute),
                    include: [{
                            model: models.Bargain,
                            as: 'bargain',
                            where: whereBargain,
                            attributes: {
                                exclude: ['createdAt', 'updatedAt', 'deletedAt']
                            }
                        },
                        {
                            model: models.ExteriorGalery,
                            as: 'exteriorGalery',
                            attributes: {
                                exclude: ['createdAt', 'updatedAt', 'deletedAt']
                            },
                            include: {
                                model: models.File,
                                as: 'file',
                                attributes: ['type', 'url']
                            }
                        },
                        {
                            model: models.Brand,
                            as: 'brand',
                            attributes: {
                                exclude: ['createdAt', 'updatedAt', 'deletedAt']
                            }
                        },
                        {
                            model: models.Model,
                            as: 'model',
                            attributes: {
                                exclude: ['createdAt', 'updatedAt', 'deletedAt']
                            }
                        },
                        {
                            model: models.GroupModel,
                            as: 'groupModel',
                            attributes: {
                                exclude: ['createdAt', 'updatedAt', 'deletedAt']
                            }
                        },
                        {
                            model: models.ModelYear,
                            as: 'modelYear',
                            attributes: {
                                exclude: ['createdAt', 'updatedAt', 'deletedAt']
                            }
                        },
                        {
                            model: models.Color,
                            as: 'exteriorColor',
                            attributes: {
                                exclude: ['createdAt', 'updatedAt', 'deletedAt']
                            }
                        },
                        {
                            model: models.Color,
                            as: 'interiorColor',
                            attributes: {
                                exclude: ['createdAt', 'updatedAt', 'deletedAt']
                            }
                        }
                    ],
                    limit,
                    offset
                }).then(async resultCar => {
                    data.car = resultCar
                });

                count = await models.Car.count({
                    distinct: true,
                    col: 'id',
                    where: whereCar,
                    include: [{
                        model: models.Bargain,
                        as: 'bargain',
                        where: whereBargain
                    }]
                });
            }

            const pagination = paginator.paging(page, count, limit);

            if (data) {
                if (data.user.file.url) {
                    const url = await minio.getUrl(data.user.file.url).then(res => {
                        return res;
                    }).catch(err => {
                        res.status(422).json({
                            success: false,
                            errors: err
                        });
                    });

                    data.user.file.fileUrl = url;
                } else {
                    data.user.file.fileUrl = null;
                }

                await Promise.all(
                    data.car.map(async item => {
                        if (item.STNKphoto) {
                            const url = await minio.getUrl(item.STNKphoto).then(res => {
                                return res;
                            }).catch(err => {
                                res.status(422).json({
                                    success: false,
                                    errors: err
                                });
                            });

                            item.dataValues.stnkUrl = url;
                        } else {
                            item.dataValues.stnkUrl = null;
                        }

                        if (item.modelYear.picture) {
                            const url = await minio.getUrl(item.modelYear.picture).then(res => {
                                return res;
                            }).catch(err => {
                                res.status(422).json({
                                    success: false,
                                    errors: err
                                });
                            });

                            item.modelYear.dataValues.pictureUrl = url;
                        } else {
                            item.modelYear.dataValues.pictureUrl = null;
                        }

                        if (item.brand.logo) {
                            const url = await minio.getUrl(item.brand.logo).then(res => {
                                return res;
                            }).catch(err => {
                                res.status(422).json({
                                    success: false,
                                    errors: err
                                });
                            });

                            item.brand.dataValues.logoUrl = url;
                        } else {
                            item.brand.dataValues.logoUrl = null;
                        }

                        await Promise.all(
                            item.exteriorGalery.map(async itemExteriorGalery => {
                                if (itemExteriorGalery.file.url) {
                                    const url = await minio.getUrl(itemExteriorGalery.file.url).then(res => {
                                        return res;
                                    }).catch(err => {
                                        res.status(422).json({
                                            success: false,
                                            errors: err
                                        });
                                    });

                                    itemExteriorGalery.file.dataValues.fileUrl = url;
                                } else {
                                    itemExteriorGalery.file.dataValues.fileUrl = null;
                                }
                            })
                        );
                    })
                );
            }

            res.json({
                success: true,
                pagination,
                data
            });
        })
        .catch(err => {
            res.status(422).json({
                success: false,
                errors: err.message
            });
        });
});

router.get('/sellAndBuyBrand/:id', async (req, res) => {
    const {
        id
    } = req.params;
    return models.DealerSellAndBuyBrand.findAll({
            where: {
                dealerId: id
            },
            include: [{
                model: models.Brand,
                as: 'brand'
            }]
        })
        .then(async data => {
            await Promise.all(
                data.map(async item => {
                    if (item.brand.logo) {
                        const url = await minio.getUrl(item.brand.logo).then(res => {
                            return res;
                        }).catch(err => {
                            res.status(422).json({
                                success: false,
                                errors: err
                            });
                        });

                        item.brand.dataValues.logoUrl = url;
                    } else {
                        item.brand.dataValues.logoUrl = null;
                    }
                })
            );

            res.json({
                success: true,
                data
            });
        })
        .catch(err => {
            res.status(422).json({
                success: false,
                errors: err.message
            });
        });
});

module.exports = router;