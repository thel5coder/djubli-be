/* eslint-disable linebreak-style */
const express = require('express');
const validator = require('validator');
const Sequelize = require('sequelize');
const models = require('../../db/models');
const paginator = require('../../helpers/paginator');

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
        sort,
        brandId,
        condition
    } = req.query;
    let offset = 0;

    if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;
    if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
    else page = 1;

    let order = [
        ['createdAt', 'desc']
    ];
    if (!sort) sort = 'asc';
    else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';

    const where = {
        isPartner: true
    };

    if (brandId) {
        Object.assign(where, {
            authorizedBrandId: brandId
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

        whereCondition = `AND "Cars"."condition" = ${condition}`
    }

    return models.Dealer.findAll({
            attributes: Object.keys(models.Dealer.attributes).concat([
                [
                    models.sequelize.literal(
                        `( SELECT COUNT ( "Cars"."id" ) FROM "Cars" WHERE "Cars"."brandId" = "Dealer"."authorizedBrandId" ${whereCondition} AND "Cars"."userId" = "Dealer"."userId" AND "Cars"."deletedAt" IS NULL )`
                    ),
                    'countListing'
                ],
                [
                    models.sequelize.literal(
                        `( SELECT "GroupModels"."name" FROM "GroupModels" WHERE "GroupModels"."brandId" = "Dealer"."authorizedBrandId" AND "GroupModels"."deletedAt" IS NULL ORDER BY ( SELECT COUNT ( "Cars"."id" ) FROM "Cars" WHERE "Cars"."brandId" = "Dealer"."authorizedBrandId" ${whereCondition} AND "Cars"."userId" = "Dealer"."userId" AND "Cars"."deletedAt" IS NULL ) DESC LIMIT 1 )`
                    ),
                    'groupModelMostListing'
                ]
            ]),
            include: [
            	{
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
                    }]
                },
                {
                    model: models.Car,
                    as: 'car',
                    where: whereCar,
                    attributes: {
                        exclude: ['createdAt', 'updatedAt', 'deletedAt']
                    }
                }
            ],
            where,
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
                    where: whereCar
                }],
                where
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

router.get('/id/:id', async (req, res) => {
  const { id } = req.params;

  return models.Dealer.findOne({
    include: [
    	{
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
            }]
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
    .then(data => {
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
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;
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
            `( SELECT "GroupModels"."${field}" 
                FROM "GroupModels" 
                WHERE "GroupModels"."brandId" = "Brand"."id" 
                AND "GroupModels"."deletedAt" IS NULL 
                AND ( SELECT COUNT ( "Cars"."id" ) 
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
                    ( SELECT COUNT ( "Cars"."id" ) 
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
                        `( SELECT COUNT ( "Cars"."id" ) 
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
                        `( SELECT COUNT ( "Dealers"."id" ) 
                            FROM "Dealers" 
                            WHERE "Dealers"."authorizedBrandId" = "Brand"."id" 
                            AND "Dealers"."isPartner" = true 
                            AND ( SELECT COUNT ( "Cars"."id" ) 
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
                [ groupModelMostListing("name"), 'groupModelMostListing' ],
                [ groupModelMostListing("id"), 'groupModelMostListingId' ],
                [
                    models.sequelize.literal(
                        `( SELECT 
                            ( SELECT COUNT ( "Cars"."id" ) 
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
            include: [
                {
                    model: models.Dealer,
                    as: 'dealer',
                    attributes: {
                        exclude: ['createdAt', 'updatedAt', 'deletedAt']
                    },
                    include: [
                        {
                            required: false,
                            model: models.Car,
                            as: 'car',
                            where: whereCar,
                            attributes: {
                                exclude: ['createdAt', 'updatedAt', 'deletedAt']
                            }
                        }
                    ]
                }
            ],
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
    const { id } = req.params;
    let {
        page,
        limit,
        sort,
        condition,
        groupModelId
    } = req.query;
    let offset = 0;

    if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;
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
            [Op.in]: models.sequelize.literal(`(SELECT "Dealers"."userId" FROM "Dealers" WHERE "Dealers"."deletedAt" IS NULL AND "Dealers"."authorizedBrandId" = ${id})`)
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

    return models.Brand.findByPk(id, {
            attributes: Object.keys(models.Brand.attributes).concat([
                [
                    models.sequelize.literal(
                        `( SELECT COUNT ( "Cars"."id" ) 
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
                        '( SELECT COUNT ( "Dealers"."id" ) FROM "Dealers" WHERE "Dealers"."authorizedBrandId" = "Brand"."id" AND "Dealers"."isPartner" = true AND "Dealers"."deletedAt" IS NULL )'
                    ),
                    'countPartner'
                ],
                [
                    models.sequelize.literal(
                        `( SELECT "GroupModels"."name" 
                            FROM "GroupModels" 
                            WHERE "GroupModels"."brandId" = "Brand"."id" 
                            AND "GroupModels"."deletedAt" IS NULL 
                            AND ( SELECT COUNT ( "Cars"."id" ) 
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
                                ( SELECT COUNT ( "Cars"."id" ) 
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
                        `( SELECT 
                            ( SELECT COUNT ( "Cars"."id" ) 
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
            include: [
                {
                    required: false,
                    model: models.Car,
                    as: 'car',
                    where: whereCar,
                    subQuery: true,
                    attributes: {
                        include: [
                            [
                                models.sequelize.literal(
                                    `(SELECT MAX("Bargains"."bidAmount") FROM "Bargains" WHERE "Bargains"."carId" = "Car"."id" AND "Bargains"."deletedAt" IS NULL)`
                                ),
                                'bidAmount'
                            ],
                            [
                                models.sequelize.literal(
                                    `(SELECT COUNT("Bargains"."id") FROM "Bargains" WHERE "Bargains"."carId" = "Car"."id" AND "Bargains"."deletedAt" IS NULL)`
                                ),
                                'numberOfBidder'
                            ],
                            [
                                models.sequelize.literal(
                                    `(SELECT COUNT("Likes"."id") FROM "Likes" WHERE "Likes"."carId" = "Car"."id" AND "Likes"."status" IS TRUE AND "Likes"."deletedAt" IS NULL)`
                                ),
                                'like'
                            ],
                            [
                                models.sequelize.literal(
                                    `(SELECT COUNT("Views"."id") FROM "Views" WHERE "Views"."carId" = "Car"."id" AND "Views"."deletedAt" IS NULL)`
                                ),
                                'view'
                            ]
                        ]
                    },
                    include: [
                        {
                            model: models.User,
                            as: 'user',
                            include: [
                                {
                                    model: models.Dealer,
                                    as: 'dealer',
                                    attributes: {
                                        exclude: ['createdAt', 'updatedAt', 'deletedAt']
                                    }
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
                }
            ]
        })
        .then(async data => {
            const count = await models.Brand.count({
                where: { id },
                include: [{
                    model: models.Car,
                    as: 'car',
                    where: whereCar
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
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;
    if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
    else page = 1;

    let order = [
        ['createdAt', 'desc']
    ];
    if (!sort) sort = 'asc';
    else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';

    return models.Dealer.findByPk(id, {
            raw: true,
            nest: true,
            include: [
            	{
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
                    }]
                }
            ]
        })
        .then(async data => {
            const userId = models.sequelize.literal(`(SELECT "userId" FROM "Dealers" WHERE "Dealers"."id" = ${id} AND "deletedAt" IS NULL)`);
            const whereCar = {
                userId: { 
                    [Op.eq]: userId
                }
            };

            if(data) {
                const cars = await models.Car.findAll({
                    where: whereCar,
                    attributes: {
                        include: [
                            [
                                models.sequelize.literal(
                                    `(SELECT MAX("Bargains"."bidAmount") FROM "Bargains" WHERE "Bargains"."carId" = "Car"."id" AND "Bargains"."deletedAt" IS NULL)`
                                ),
                                'bidAmount'
                            ],
                            [
                                models.sequelize.literal(
                                    `(SELECT COUNT("Bargains"."id") FROM "Bargains" WHERE "Bargains"."carId" = "Car"."id" AND "Bargains"."deletedAt" IS NULL)`
                                ),
                                'numberOfBidder'
                            ],
                            [
                                models.sequelize.literal(
                                  '(SELECT MAX("Bargains"."bidAmount") FROM "Bargains" WHERE "Bargains"."carId" = "Car"."id" AND "Bargains"."deletedAt" IS NULL)'
                                ),
                                'highestBidder'
                            ],
                            [
                                models.sequelize.literal(
                                    `(SELECT COUNT("Likes"."id") FROM "Likes" WHERE "Likes"."carId" = "Car"."id" AND "Likes"."status" IS TRUE AND "Likes"."deletedAt" IS NULL)`
                                ),
                                'like'
                            ],
                            [
                                models.sequelize.literal(
                                    `(SELECT COUNT("Views"."id") FROM "Views" WHERE "Views"."carId" = "Car"."id" AND "Views"."deletedAt" IS NULL)`
                                ),
                                'view'
                            ]
                        ]
                    },
                    include: [
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
                            model: models.InteriorGalery,
                            as: 'interiorGalery',
                            attributes: ['id', 'fileId', 'carId'],
                            include: [
                                {
                                    model: models.File,
                                    as: 'file',
                                    attributes: {
                                        exclude: ['createdAt', 'updatedAt', 'deletedAt']
                                    }
                                }
                            ]
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
                    data.car = resultCar
                });
            }
            
            const count = await models.Car.count({
                distinct: true,
                col: 'id',
                where: whereCar
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
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;
    if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
    else page = 1;

    let order = [
        ['createdAt', 'desc']
    ];
    if (!sort) sort = 'asc';
    else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';

    const whereBargain = { 
    	[Op.or]: [
    		{ bidType: 0 }, 
    		{ bidType: 1 }
    	],
    	[Op.and]: [
    		{ 
    			userId: { 
    				[Op.eq]: models.sequelize.literal(`(SELECT "userId" FROM "Dealers" WHERE "Dealers"."id" = ${id} AND "deletedAt" IS NULL)`)
        		}
        	}
    	]
    }

    countBargains =  models.sequelize.literal(
        `(SELECT COUNT("Bargains"."id") FROM "Bargains" WHERE "Bargains"."carId" = "Car"."id" AND "Bargains"."deletedAt" IS NULL)`
    );

    let whereCar = {
	    [Op.and]: [models.sequelize.where(countBargains, { [Op.gte]: 1 })]
    }

    return models.Dealer.findByPk(id, {
            raw: true,
            nest: true,
            include: [
            	{
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
                    }]
                }
            ]
        })
        .then(async data => {
            const userId = models.sequelize.literal(`(SELECT "userId" FROM "Dealers" WHERE "Dealers"."id" = ${id} AND "deletedAt" IS NULL)`);

            if(data) {
                const cars = await models.Car.findAll({
                    where: whereCar,
                    attributes: {
                        include: [
                            [
                                models.sequelize.literal(
                                    `(SELECT MAX("Bargains"."bidAmount") FROM "Bargains" WHERE "Bargains"."carId" = "Car"."id" AND "Bargains"."deletedAt" IS NULL)`
                                ),
                                'bidAmount'
                            ],
                            [
                                models.sequelize.literal(
                                    `(SELECT COUNT("Bargains"."id") FROM "Bargains" WHERE "Bargains"."carId" = "Car"."id" AND "Bargains"."deletedAt" IS NULL)`
                                ),
                                'numberOfBidder'
                            ],
                            [
                                models.sequelize.literal(
                                    `(SELECT COUNT("Likes"."id") FROM "Likes" WHERE "Likes"."carId" = "Car"."id" AND "Likes"."status" IS TRUE AND "Likes"."deletedAt" IS NULL)`
                                ),
                                'like'
                            ],
                            [
                                models.sequelize.literal(
                                    `(SELECT COUNT("Views"."id") FROM "Views" WHERE "Views"."carId" = "Car"."id" AND "Views"."deletedAt" IS NULL)`
                                ),
                                'view'
                            ]
                        ]
                    },
                    include: [
                        {
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
            }

            const count = await models.Car.count({
                distinct: true,
                col: 'id',
            	where: whereCar,
            	include: [{
                    model: models.Bargain,
                    as: 'bargain',
                    where: whereBargain
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

module.exports = router;