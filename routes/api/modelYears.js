/* eslint-disable linebreak-style */
const express = require('express');
const validator = require('validator');
const Sequelize = require('sequelize');
const passport = require('passport');
const models = require('../../db/models');
const paginator = require('../../helpers/paginator');
const carHelper = require('../../helpers/car');
const general = require('../../helpers/general');
const distanceHelper = require('../../helpers/distance');
const modelYearController = require('../../controller/modelYearController');

const { Op } = Sequelize;
const router = express.Router();

const DEFAULT_LIMIT = process.env.DEFAULT_LIMIT || 10;
const MAX_LIMIT = process.env.MAX_LIMIT || 50;

router.get('/', async (req, res) => {
  let { page, limit, sort } = req.query;
  const { modelId } = req.query;
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (parseInt(limit) > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  const order = [['createdAt', 'desc']];
  if (!sort) sort = 'asc';
  else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';

  const where = {};
  if (modelId) {
    Object.assign(where, {
      modelId: {
        [Op.eq]: modelId
      }
    });
  }

  const addAttribute = await carHelper.customFields({
    fields: ['numberOfPurchase'],
    upperCase: true,
    whereQuery: ''
  });
  return models.ModelYear.findAll({
    attributes: {
      include: addAttribute,
      exclude: ['deletedAt']
    },
    where,
    order,
    offset,
    limit
  })
    .then(async data => {
      const count = await models.ModelYear.count({ where });
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

  return models.ModelYear.findOne({
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

router.get('/listingAll', async (req, res) => await modelYearController.listingAll(req, res));

router.get('/listingAllNew', async (req, res) => await modelYearController.listingAllNew(req, res));

router.get(
  '/listingAllNewRefactor',
  async (req, res) => await modelYearController.listingAllNewRefactor(req, res)
);

router.get(
  '/countAllNewRefactor',
  async (req, res) => await modelYearController.countAllNewRefactor(req, res)
);

router.get('/listingType', async (req, res) => {
  const {
    by,
    condition,
    brandId,
    groupModelId,
    modelId,
    minPrice,
    maxPrice,
    minYear,
    maxYear,
    typeId
  } = req.query;
  let { page, limit, sort } = req.query;
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (parseInt(limit) > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  let order = [['createdAt', 'desc']];
  if (!sort) sort = 'asc';
  else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';
  if (by === 'year' || by === 'id') order = [[by, sort]];

  const where = {};
  if (minYear && maxYear) {
    Object.assign(where, {
      year: {
        [Op.and]: [{ [Op.gte]: minYear }, { [Op.lte]: maxYear }]
      }
    });
  }

  let whereQuery = ' AND ("Cars"."status" = 0 OR "Cars"."status" = 1)';
  const whereInclude = { [Op.or]: [{ status: 0 }, { status: 1 }] };
  if (condition) {
    Object.assign(whereInclude, {
      condition
    });

    whereQuery += ` AND "Cars"."condition" = ${condition}`;
  }

  if (brandId) {
    Object.assign(whereInclude, {
      brandId
    });

    whereQuery += ` AND "Cars"."brandId" = ${brandId}`;
  }

  if (modelId) {
    Object.assign(whereInclude, {
      modelId
    });

    whereQuery += ` AND "Cars"."modelId" = ${modelId}`;
  }

  if (groupModelId) {
    Object.assign(whereInclude, {
      groupModelId
    });

    whereQuery += ` AND "Cars"."groupModelId" = ${groupModelId}`;
  }

  if (minPrice && maxPrice) {
    Object.assign(whereInclude, {
      price: {
        [Op.and]: [{ [Op.gte]: minPrice }, { [Op.lte]: maxPrice }]
      }
    });

    whereQuery += ` AND ("Cars"."price" >= ${minPrice} AND "Cars"."price" <= ${maxPrice})`;
  }

  const whereModelGroup = {};
  if (typeId) {
    const groupModelExist = tableName => `EXISTS(SELECT "GroupModels"."typeId" 
        FROM "GroupModels" 
        WHERE "GroupModels"."id" = "${tableName}"."groupModelId" 
          AND "GroupModels"."typeId" = ${typeId} 
          AND "GroupModels"."deletedAt" IS NULL
      )`;

    Object.assign(whereInclude, {
      [Op.and]: models.sequelize.literal(groupModelExist('car'))
    });

    whereQuery += ` AND ${groupModelExist('Cars')}`;
  }

  const addAttribute = await carHelper.customFields({
    fields: [
      'maxPrice',
      'minPrice',
      'numberOfCar',
      'numberOfBidderModelYear',
      'highestBidderModelYear',
      'highestBidderCarId',
      'purchase'
    ],
    upperCase: true,
    whereQuery: general.customReplace(whereQuery, `Cars`, `Car`)
  });

  const includeCar = [
    {
      model: models.User,
      as: 'user',
      attributes: ['id', 'name', 'email', 'phone', 'type', 'companyType'],
      include: [
        {
          model: models.Purchase,
          as: 'purchase',
          attributes: {
            exclude: ['deletedAt']
          },
          order: [['id', 'desc']],
          limit: 1
        }
      ]
    },
    {
      model: models.Brand,
      as: 'brand',
      attributes: ['id', 'name', 'logo', 'status']
    },
    {
      model: models.Model,
      as: 'model',
      attributes: ['id', 'name', 'groupModelId']
    },
    {
      model: models.GroupModel,
      as: 'groupModel',
      attributes: ['id', 'name', 'brandId']
    },
    {
      model: models.Color,
      as: 'interiorColor',
      attributes: ['id', 'name', 'hex']
    },
    {
      model: models.Color,
      as: 'exteriorColor',
      attributes: ['id', 'name', 'hex']
    },
    {
      model: models.MeetingSchedule,
      as: 'meetingSchedule',
      attributes: ['id', 'carId', 'day', 'startTime', 'endTime']
    },
    {
      model: models.InteriorGalery,
      as: 'interiorGalery',
      attributes: ['id', 'fileId', 'carId'],
      include: {
        model: models.File,
        as: 'file',
        attributes: ['type', 'url']
      }
    },
    {
      model: models.ExteriorGalery,
      as: 'exteriorGalery',
      attributes: ['id', 'fileId', 'carId'],
      include: {
        model: models.File,
        as: 'file',
        attributes: ['type', 'url']
      }
    }
  ];
  return models.ModelYear.findAll({
    attributes: Object.keys(models.ModelYear.attributes).concat(addAttribute),
    include: [
      {
        model: models.Model,
        as: 'model',
        attributes: {
          exclude: ['createdAt', 'updatedAt', 'deletedAt']
        },
        include: [
          {
            model: models.GroupModel,
            as: 'groupModel',
            attributes: {
              exclude: ['createdAt', 'updatedAt', 'deletedAt']
            },
            include: [
              {
                model: models.Brand,
                as: 'brand',
                attributes: {
                  exclude: ['createdAt', 'updatedAt', 'deletedAt']
                }
              }
            ]
          }
        ]
      },
      {
        model: models.Car,
        as: 'car',
        attributes: {
          include: await carHelper.customFields({
            fields: [
              'bidAmountModelYears',
              'highestBidder',
              'like',
              'view',
              'latitude',
              'longitude'
            ]
          })
        },
        include: includeCar,
        where: whereInclude
      }
    ],
    where,
    order,
    offset,
    limit
  })
    .then(async data => {
      const count = await models.ModelYear.count({
        distinct: true,
        col: 'id',
        include: [
          {
            model: models.Car,
            as: 'car',
            where: whereInclude,
            include: [
              {
                model: models.GroupModel,
                as: 'groupModel',
                where: whereModelGroup
              }
            ]
          }
        ],
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

router.get('/listingCar/:id', async (req, res) => await modelYearController.listingCar(req, res));

router.get(
  '/listingCarLogon/:id',
  passport.authenticate('user', { session: false }),
  async (req, res) => await modelYearController.listingCar(req, res, true)
);

router.get('/luxuryCar', async (req, res) => await modelYearController.luxuryCar(req, res));

module.exports = router;
