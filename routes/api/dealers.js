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
                        `( SELECT COUNT ( "Cars"."id" ) FROM "Cars" WHERE "Cars"."brandId" = "Dealer"."authorizedBrandId" ${whereCondition} AND "Cars"."userId" = "Dealer"."userId" )`
                    ),
                    'countListing'
                ],
                [
                    models.sequelize.literal(
                        `( SELECT "GroupModels"."name" FROM "GroupModels" WHERE "GroupModels"."brandId" = "Dealer"."authorizedBrandId" ORDER BY ( SELECT COUNT ( "Cars"."id" ) FROM "Cars" WHERE "Cars"."brandId" = "Dealer"."authorizedBrandId" ${whereCondition} AND "Cars"."userId" = "Dealer"."userId" ) DESC LIMIT 1 )`
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

    return models.Brand.findAll({
            attributes: Object.keys(models.Brand.attributes).concat([
                [
                    models.sequelize.literal(
                        `( SELECT COUNT ( "Cars"."id" ) FROM "Cars" WHERE "Cars"."brandId" = "Brand"."id" AND "Cars"."condition" = ${condition} )`
                    ),
                    'countListing'
                ],
                [
                    models.sequelize.literal(
                        '( SELECT COUNT ( "Dealers"."id" ) FROM "Dealers" WHERE "Dealers"."authorizedBrandId" = "Brand"."id" AND "Dealers"."isPartner" = true )'
                    ),
                    'countPartner'
                ],
                [
                    models.sequelize.literal(
                        `( SELECT "GroupModels"."name" FROM "GroupModels" WHERE "GroupModels"."brandId" = "Brand"."id" ORDER BY ( SELECT COUNT ( "Cars"."id" ) FROM "Cars" WHERE "Cars"."groupModelId" = "GroupModels"."id" AND "Cars"."status" = 0 ) DESC LIMIT 1 )`
                    ),
                    'groupModelMostListing'
                ],
                [
                    models.sequelize.literal(
                        `( SELECT ( SELECT COUNT ( "Cars"."id" ) FROM "Cars" WHERE "Cars"."groupModelId" = "GroupModels"."id" AND "Cars"."status" = 0 ) groupModelMaxListing FROM "GroupModels" WHERE "GroupModels"."brandId" = "Brand"."id" ORDER BY groupModelMaxListing DESC LIMIT 1 )`
                    ),
                    'groupModelCountListing'
                ]
            ]),
            include: [{
                model: models.Car,
                as: 'car',
                where: {
                    condition
                },
                attributes: {
                    exclude: ['createdAt', 'updatedAt', 'deletedAt']
                }
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

    const whereCar = {
        userId: {
            [Op.eq]: models.sequelize.literal(`(SELECT "userId" FROM "Dealers" WHERE "Dealers"."id" = ${id})`)
        }
    };

    return models.Dealer.findByPk(id, {
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
                        include: [
                            [
                                models.sequelize.literal(
                                    '(SELECT MAX("Bargains"."bidAmount") FROM "Bargains" WHERE "Bargains"."carId" = "Car"."id")'
                                ),
                                'bidAmount'
                            ],
                            [
                                models.sequelize.literal(
                                    '(SELECT COUNT("Bargains"."id") FROM "Bargains" WHERE "Bargains"."carId" = "Car"."id")'
                                ),
                                'numberOfBidder'
                            ],
                            [
                                Sequelize.literal(
                                    '(SELECT COUNT("Likes"."id") FROM "Likes" WHERE "Likes"."carId" = "Car"."id" AND "Likes"."status" IS TRUE)'
                                ),
                                'like'
                            ],
                            [
                                models.sequelize.literal(
                                    '(SELECT COUNT("Views"."id") FROM "Views" WHERE "Views"."carId" = "Car"."id" AND "Views"."deletedAt" IS NULL)'
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
            const count = await models.Dealer.findAndCountAll({
            	where: {id},
            	include: [{
                 	model: models.Car,
                 	as: 'car',
                 	where: whereCar,
             	}]
            });
            const pagination = paginator.paging(page, count.count, limit);

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

router.get('/car/buyList/:id', async (req, res) => {
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
    	bidType: {
      		[Op.eq]: 0
    	}
    } 

    return models.Dealer.findByPk(id, {
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
                    model: models.Bargain,
                    as: 'bargain',
                    where: whereBargain,
                    // separate: false,
                    // required: true,
                    attributes: {
                        exclude: ['createdAt', 'updatedAt', 'deletedAt']
                    },
                    include: [
                    	{
		                    model: models.Car,
		                    as: 'car',
		                    attributes: {
		                        include: [
		                            [
		                                models.sequelize.literal(
		                                    '(SELECT MAX("Bargains"."bidAmount") FROM "Bargains" WHERE "Bargains"."carId" = "bargain->car"."id")'
		                                ),
		                                'bidAmount'
		                            ],
		                            [
		                                models.sequelize.literal(
		                                    '(SELECT COUNT("Bargains"."id") FROM "Bargains" WHERE "Bargains"."carId" = "bargain->car"."id")'
		                                ),
		                                'numberOfBidder'
		                            ],
		                            [
		                                Sequelize.literal(
		                                    '(SELECT COUNT("Likes"."id") FROM "Likes" WHERE "Likes"."carId" = "bargain->car"."id" AND "Likes"."status" IS TRUE)'
		                                ),
		                                'like'
		                            ],
		                            [
		                                models.sequelize.literal(
		                                    '(SELECT COUNT("Views"."id") FROM "Views" WHERE "Views"."carId" = "bargain->car"."id" AND "Views"."deletedAt" IS NULL)'
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
		                    ]
		                }
                    ],
                    // limit,
		    		// offset
                }
            ]
        })
        .then(async data => {
            const count = await models.Dealer.findAndCountAll({
            	where: {id},
            	include: [{
                 	model: models.Bargain,
                 	as: 'bargain',
                 	where: whereBargain
             	}]
            });
            const pagination = paginator.paging(page, count.count, limit);

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