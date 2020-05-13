/* eslint-disable linebreak-style */
const moment = require('moment');
const express = require('express');
const validator = require('validator');
const randomize = require('randomatic');
const passport = require('passport');
const Sequelize = require('sequelize');
const models = require('../../db/models');
const imageHelper = require('../../helpers/s3');
const general = require('../../helpers/general');
const paginator = require('../../helpers/paginator');
const carsController = require('../../controller/carsController');
const apiResponse = require('../../helpers/apiResponse');
const carHelper = require('../../helpers/car');
const calculateDistance = require('../../helpers/calculateDistance');
const notification = require('../../helpers/notification');

const { Op } = Sequelize;
const router = express.Router();

const DEFAULT_LIMIT = process.env.DEFAULT_LIMIT || 10;
const MAX_LIMIT = process.env.MAX_LIMIT || 50;

router.get('/', async (req, res) => {
  return carsController.carsGet(req, res);
});

router.get('/logon', passport.authenticate('user', { session: false }), async (req, res) => {
  return carsController.carsGet(req, res, true);
});

router.get('/user/:id', async (req, res) => {
  const { id } = req.params;
  const {
    condition,
    profile,
    km,
    price,
    // djubleeReport,
    radius,
    year,
    // kota,
    // area,
    latitude,
    longitude,
    groupModelId,
    modelId,
    brandId,
    modelYearId,
    minPrice,
    maxPrice,
    minYear,
    maxYear
  } = req.query;
  let { page, limit, by, sort } = req.query;
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  if (!by) by = 'id';
  const array = ['id', 'condition', 'price', 'km', 'createdAt', 'view', 'like', 'profile'];
  if (array.indexOf(by) < 0) by = 'createdAt';
  sort = ['asc', 'desc'].indexOf(sort) < 0 ? 'asc' : sort;
  const order = [];
  switch (by) {
    case 'view':
    case 'like':
      order.push([Sequelize.col(by), sort]);
      break;
    case 'profile':
      order.push([{ model: models.User, as: 'user' }, 'type', sort]);
      break;
    default:
      order.push([by, sort]);
      break;
  }
  const where = {};

  Object.assign(where, {
    userId: {
      [Op.eq]: id
    }
  });

  if (modelYearId) {
    Object.assign(where, {
      modelYearId: {
        [Op.eq]: modelYearId
      }
    });
  }

  if (groupModelId) {
    Object.assign(where, {
      groupModelId: {
        [Op.eq]: groupModelId
      }
    });
  }

  if (modelId) {
    Object.assign(where, {
      modelId: {
        [Op.eq]: modelId
      }
    });
  }

  if (brandId) {
    Object.assign(where, {
      brandId: {
        [Op.eq]: brandId
      }
    });
  }

  if (minPrice && maxPrice) {
    Object.assign(where, {
      price: {
        [Op.and]: [{ [Op.gte]: minPrice }, { [Op.lte]: maxPrice }]
      }
    });
  } else if (minPrice) {
    Object.assign(where, {
      price: {
        [Op.gte]: minPrice
      }
    });
  } else if (maxPrice) {
    Object.assign(where, {
      price: {
        [Op.lte]: maxPrice
      }
    });
  }

  const whereYear = {};
  if (minYear && maxYear) {
    Object.assign(whereYear, {
      year: {
        [Op.and]: [{ [Op.gte]: minYear }, { [Op.lte]: maxYear }]
      }
    });
  } else if (minYear) {
    Object.assign(whereYear, {
      year: {
        [Op.gte]: minYear
      }
    });
  } else if (maxYear) {
    Object.assign(whereYear, {
      year: {
        [Op.lte]: maxYear
      }
    });
  }

  const whereModelYear = {};
  const whereProfile = {};
  const customFields = {
    fields: ['islike', 'isBidFromLike', 'like', 'view', 'numberOfBidder', 'highestBidder'],
    id,
    upperCase: true
  };

  if (condition) {
    const arrCondition = [0, 1];
    if (arrCondition.indexOf(Number(condition)) < 0)
      return apiResponse._error({ res, errors: 'invalid condition' });
    Object.assign(where, { condition: { [Op.eq]: condition } });
  }
  if (km) {
    if (km.length < 2) return apiResponse._error({ res, errors: 'invalid km' });
    if (validator.isInt(km[0] ? km[0].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid km[0]' });
    if (validator.isInt(km[1] ? km[1].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid km[1]' });
    Object.assign(where, { km: { [Op.between]: [Number(km[0]), Number(km[1])] } });
  }
  if (price) {
    if (price.length < 2) return apiResponse._error({ res, errors: 'invalid price' });
    if (validator.isInt(price[0] ? price[0].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid price[0]' });
    if (validator.isInt(price[1] ? price[1].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid price[1]' });
    Object.assign(where, { price: { [Op.between]: [Number(price[0]), Number(price[1])] } });
  }
  if (year) {
    if (year.length < 2) return apiResponse._error({ res, errors: 'invalid year' });
    if (validator.isInt(year[0] ? year[0].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid year[0]' });
    if (validator.isInt(year[1] ? year[1].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid year[1]' });
    Object.assign(whereModelYear, {
      [Op.and]: [{ year: { [Op.gte]: year[0] } }, { year: { [Op.lte]: year[1] } }]
    });
  }
  if (radius) {
    if (radius.length < 2) return apiResponse._error({ res, errors: 'invalid radius' });
    if (validator.isInt(radius[0] ? radius[0].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid radius[0]' });
    if (validator.isInt(radius[1] ? radius[1].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid radius[1]' });
    if (!latitude) return apiResponse._error({ res, errors: 'invalid latitude' });
    if (!longitude) return apiResponse._error({ res, errors: 'invalid longitude' });

    customFields.fields.push('distance');
    Object.assign(customFields, { latitude, longitude });
    await calculateDistance.CreateOrReplaceCalculateDistance();
    const distances = Sequelize.literal(
      `(SELECT calculate_distance(${latitude}, ${longitude}, (SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude"), (SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude"), 'K'))`
    );
    // Object.assign(where, { where: Sequelize.where(distances, { [Op.lte]: 10 }) });
    Object.assign(where, {
      where: {
        [Op.and]: [
          Sequelize.where(distances, { [Op.gte]: Number(radius[0]) }),
          Sequelize.where(distances, { [Op.lte]: Number(radius[1]) })
        ]
      }
    });
  }
  if (profile) {
    const arrprofile = ['end user', 'dealer'];
    if (arrprofile.indexOf(profile) < 0)
      return apiResponse._error({ res, errors: 'invalid profile' });
    Object.assign(whereProfile, { type: profile === 'dealer' ? 1 : 0 });
  }

  const includes = [
    {
      model: models.ModelYear,
      as: 'modelYear',
      attributes: ['id', 'year', 'modelId'],
      where: whereModelYear
    },
    {
      model: models.User,
      as: 'user',
      attributes: ['id', 'name', 'email', 'phone', 'type', 'companyType']
    },
    {
      model: models.User,
      as: 'profile',
      attributes: ['id', 'type', 'companyType'],
      where: whereProfile
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
  return models.Car.findAll({
    attributes: Object.keys(models.Car.attributes).concat(
      await carHelper.customFields(customFields)
    ),
    include: includes,
    where,
    order,
    offset,
    limit
  })
    .then(async data => {
      const count = await models.Car.count({
        include: includes,
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

router.get('/user/:userId', passport.authenticate('user', { session: false }), async (req, res) => {
  const {
    groupModelId,
    modelId,
    brandId,
    condition,
    modelYearId,
    minPrice,
    maxPrice,
    minYear,
    maxYear
  } = req.query;
  let { page, limit, by, sort } = req.query;
  const { userId } = req.params;
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  let order = [['createdAt', 'desc']];
  if (!sort) sort = 'asc';
  else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';

  if (by === 'price' || by === 'id') order = [[by, sort]];

  const where = {
    userId,
    [Op.or]: [{ status: 0 }, { status: 1 }]
  };
  if (modelYearId) {
    Object.assign(where, {
      modelYearId: {
        [Op.eq]: modelYearId
      }
    });
  }

  if (groupModelId) {
    Object.assign(where, {
      groupModelId: {
        [Op.eq]: groupModelId
      }
    });
  }

  if (condition) {
    Object.assign(where, {
      condition: {
        [Op.eq]: condition
      }
    });
  }

  if (modelId) {
    Object.assign(where, {
      modelId: {
        [Op.eq]: modelId
      }
    });
  }

  if (brandId) {
    Object.assign(where, {
      brandId: {
        [Op.eq]: brandId
      }
    });
  }

  if (minPrice && maxPrice) {
    Object.assign(where, {
      price: {
        [Op.and]: [{ [Op.gte]: minPrice }, { [Op.lte]: maxPrice }]
      }
    });
  } else if (minPrice) {
    Object.assign(where, {
      price: {
        [Op.gte]: minPrice
      }
    });
  } else if (maxPrice) {
    Object.assign(where, {
      price: {
        [Op.lte]: maxPrice
      }
    });
  }

  const whereYear = {};
  if (minYear && maxYear) {
    Object.assign(whereYear, {
      year: {
        [Op.and]: [{ [Op.gte]: minYear }, { [Op.lte]: maxYear }]
      }
    });
  } else if (minYear) {
    Object.assign(whereYear, {
      year: {
        [Op.gte]: minYear
      }
    });
  } else if (maxYear) {
    Object.assign(whereYear, {
      year: {
        [Op.lte]: maxYear
      }
    });
  }

  return models.Car.findAll({
    attributes: Object.keys(models.Car.attributes).concat([
      [
        models.sequelize.literal(
          `(SELECT COUNT("Likes"."id") 
            FROM "Likes" 
            WHERE "Likes"."carId" = "Car"."id" 
              AND "Likes"."status" IS TRUE 
              AND "Likes"."deletedAt" IS NULL
          )`
        ),
        'like'
      ],
      [
        models.sequelize.literal(
          `(SELECT COUNT("Views"."id") 
            FROM "Views" 
            WHERE "Views"."carId" = "Car"."id" 
              AND "Views"."deletedAt" IS NULL
          )`
        ),
        'view'
      ]
    ]),
    include: [
      {
        model: models.ModelYear,
        as: 'modelYear',
        attributes: ['id', 'year', 'modelId'],
        where: whereYear
      },
      {
        model: models.User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'phone', 'type', 'companyType']
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
        attributes: ['id', 'fileId', 'carId']
      },
      {
        model: models.ExteriorGalery,
        as: 'exteriorGalery',
        attributes: ['id', 'fileId', 'carId']
      }
    ],
    where,
    order,
    offset,
    limit
  })
    .then(async data => {
      const count = await models.Car.count({
        include: [
          {
            model: models.ModelYear,
            as: 'modelYear',
            attributes: ['id', 'year', 'modelId'],
            where: whereYear
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

// Get By Status
router.get('/status/:status', async (req, res) => {
  const { status } = req.params;
  const {
    groupModelId,
    modelId,
    brandId,
    condition,
    modelYearId,
    minPrice,
    maxPrice,
    minYear,
    maxYear,
    by
  } = req.query;
  let { page, limit, sort } = req.query;
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  let order = [['createdAt', 'desc']];
  if (!sort) sort = 'asc';
  else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';

  if (by === 'price' || by === 'id') order = [[by, sort]];

  const where = {};

  Object.assign(where, {
    status: {
      [Op.eq]: status
    }
  });

  if (modelYearId) {
    Object.assign(where, {
      modelYearId: {
        [Op.eq]: modelYearId
      }
    });
  }

  if (groupModelId) {
    Object.assign(where, {
      groupModelId: {
        [Op.eq]: groupModelId
      }
    });
  }

  if (condition) {
    Object.assign(where, {
      condition: {
        [Op.eq]: condition
      }
    });
  }

  if (modelId) {
    Object.assign(where, {
      modelId: {
        [Op.eq]: modelId
      }
    });
  }

  if (brandId) {
    Object.assign(where, {
      brandId: {
        [Op.eq]: brandId
      }
    });
  }

  if (minPrice && maxPrice) {
    Object.assign(where, {
      price: {
        [Op.and]: [{ [Op.gte]: minPrice }, { [Op.lte]: maxPrice }]
      }
    });
  } else if (minPrice) {
    Object.assign(where, {
      price: {
        [Op.gte]: minPrice
      }
    });
  } else if (maxPrice) {
    Object.assign(where, {
      price: {
        [Op.lte]: maxPrice
      }
    });
  }

  const whereYear = {};
  if (minYear && maxYear) {
    Object.assign(whereYear, {
      year: {
        [Op.and]: [{ [Op.gte]: minYear }, { [Op.lte]: maxYear }]
      }
    });
  } else if (minYear) {
    Object.assign(whereYear, {
      year: {
        [Op.gte]: minYear
      }
    });
  } else if (maxYear) {
    Object.assign(whereYear, {
      year: {
        [Op.lte]: maxYear
      }
    });
  }

  return models.Car.findAll({
    attributes: Object.keys(models.Car.attributes).concat([
      [
        models.sequelize.literal(
          `(SELECT COUNT("Likes"."id") 
            FROM "Likes" 
            WHERE "Likes"."carId" = "Car"."id" 
              AND "Likes"."status" IS TRUE 
              AND "Likes"."deletedAt" IS NULL
          )`
        ),
        'like'
      ],
      [
        models.sequelize.literal(
          `(SELECT COUNT("Views"."id") 
            FROM "Views" 
            WHERE "Views"."carId" = "Car"."id" 
              AND "Views"."deletedAt" IS NULL
          )`
        ),
        'view'
      ]
    ]),
    include: [
      {
        model: models.ModelYear,
        as: 'modelYear',
        attributes: ['id', 'year', 'modelId'],
        where: whereYear
      },
      {
        model: models.User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'phone', 'type', 'companyType']
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
        attributes: ['id', 'fileId', 'carId']
      },
      {
        model: models.ExteriorGalery,
        as: 'exteriorGalery',
        attributes: ['id', 'fileId', 'carId']
      }
    ],
    where,
    order,
    offset,
    limit
  })
    .then(async data => {
      const count = await models.Car.count({
        include: [
          {
            model: models.ModelYear,
            as: 'modelYear',
            attributes: ['id', 'year', 'modelId'],
            where: whereYear
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

router.get(
  '/purchase_list/status/:status',
  passport.authenticate('user', { session: false }),
  async (req, res) => {
    const { id } = req.user;
    const { status } = req.params;
    const {
      groupModelId,
      modelId,
      brandId,
      condition,
      modelYearId,
      minPrice,
      maxPrice,
      minYear,
      maxYear,
      by
    } = req.query;
    let { page, limit, sort } = req.query;
    let offset = 0;

    if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;
    if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
    else page = 1;

    let order = [['createdAt', 'desc']];
    if (!sort) sort = 'asc';
    else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';

    if (by === 'price' || by === 'id') order = [[by, sort]];

    const where = {};

    const whereCar = {
      status: {
        [Op.eq]: status
      }
    };

    Object.assign(where, {
      userId: {
        [Op.eq]: id
      }
    });

    if (modelYearId) {
      Object.assign(where, {
        modelYearId: {
          [Op.eq]: modelYearId
        }
      });
    }

    if (groupModelId) {
      Object.assign(where, {
        groupModelId: {
          [Op.eq]: groupModelId
        }
      });
    }

    if (condition) {
      Object.assign(where, {
        condition: {
          [Op.eq]: condition
        }
      });
    }

    if (modelId) {
      Object.assign(where, {
        modelId: {
          [Op.eq]: modelId
        }
      });
    }

    if (brandId) {
      Object.assign(where, {
        brandId: {
          [Op.eq]: brandId
        }
      });
    }

    if (minPrice && maxPrice) {
      Object.assign(where, {
        price: {
          [Op.and]: [{ [Op.gte]: minPrice }, { [Op.lte]: maxPrice }]
        }
      });
    } else if (minPrice) {
      Object.assign(where, {
        price: {
          [Op.gte]: minPrice
        }
      });
    } else if (maxPrice) {
      Object.assign(where, {
        price: {
          [Op.lte]: maxPrice
        }
      });
    }

    const whereYear = {};
    if (minYear && maxYear) {
      Object.assign(whereYear, {
        year: {
          [Op.and]: [{ [Op.gte]: minYear }, { [Op.lte]: maxYear }]
        }
      });
    } else if (minYear) {
      Object.assign(whereYear, {
        year: {
          [Op.gte]: minYear
        }
      });
    } else if (maxYear) {
      Object.assign(whereYear, {
        year: {
          [Op.lte]: maxYear
        }
      });
    }

    return models.Bargain.findAll({
      include: [
        {
          model: models.Car,
          as: 'car',
          where: whereCar,
          attributes: {
            exclude: ['createdAt', 'updatedAt', 'deletedAt']
          },
          include: [
            {
              model: models.ModelYear,
              as: 'modelYear',
              attributes: ['id', 'year', 'modelId'],
              where: whereYear
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
              attributes: ['id', 'fileId', 'carId']
            },
            {
              model: models.ExteriorGalery,
              as: 'exteriorGalery',
              attributes: ['id', 'fileId', 'carId']
            }
          ]
        },
        {
          model: models.User,
          as: 'user',
          attributes: {
            exclude: ['password', 'createdAt', 'updatedAt', 'deletedAt']
          }
        }
      ],
      where,
      order,
      offset,
      limit
    })
      .then(async data => {
        const count = await models.Bargain.count({
          include: [
            {
              model: models.Car,
              as: 'car',
              where: whereCar
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
  }
);

async function bidList(req, res) {
  const { id } = req.user;
  const { status } = req.params;
  const {
    condition,
    profile,
    km,
    price,
    // djubleeReport,
    radius,
    year,
    // kota,
    // area,
    latitude,
    longitude,
    groupModelId,
    modelId,
    brandId,
    // condition,
    modelYearId,
    minPrice,
    maxPrice,
    minYear,
    maxYear
  } = req.query;
  let { page, limit, sort, by } = req.query;
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  if (!by) by = 'id';
  const array = [
    'id',
    'userId',
    'carId',
    'bidAmount',
    'haveSeenCar',
    'paymentMethod',
    'expiredAt',
    'comment',
    'bidType',
    'negotiationType',
    'condition',
    'price',
    'km',
    'createdAt',
    'view',
    'like',
    'profile'
  ];
  if (array.indexOf(by) < 0) by = 'createdAt';
  sort = ['asc', 'desc'].indexOf(sort) < 0 ? 'asc' : sort;
  const order = [];
  switch (by) {
    case 'condition':
    case 'price':
    case 'km':
    case 'view':
    case 'like':
      order.push([Sequelize.literal(`"car.${by}" ${sort}`)]);
      break;
    case 'profile':
      order.push([{ model: models.User, as: 'user' }, 'type', sort]);
      break;
    default:
      order.push([by, sort]);
      break;
  }

  const where = {
    userId: {
      [Op.eq]: id
    },
    bidType: {
      [Op.eq]: 0
    }
  };

  if (modelYearId) {
    Object.assign(where, {
      modelYearId: {
        [Op.eq]: modelYearId
      }
    });
  }

  if (groupModelId) {
    Object.assign(where, {
      groupModelId: {
        [Op.eq]: groupModelId
      }
    });
  }

  if (modelId) {
    Object.assign(where, {
      modelId: {
        [Op.eq]: modelId
      }
    });
  }

  if (brandId) {
    Object.assign(where, {
      brandId: {
        [Op.eq]: brandId
      }
    });
  }

  if (minPrice && maxPrice) {
    Object.assign(where, {
      price: {
        [Op.and]: [{ [Op.gte]: minPrice }, { [Op.lte]: maxPrice }]
      }
    });
  } else if (minPrice) {
    Object.assign(where, {
      price: {
        [Op.gte]: minPrice
      }
    });
  } else if (maxPrice) {
    Object.assign(where, {
      price: {
        [Op.lte]: maxPrice
      }
    });
  }

  const whereYear = {};
  if (minYear && maxYear) {
    Object.assign(whereYear, {
      year: {
        [Op.and]: [{ [Op.gte]: minYear }, { [Op.lte]: maxYear }]
      }
    });
  } else if (minYear) {
    Object.assign(whereYear, {
      year: {
        [Op.gte]: minYear
      }
    });
  } else if (maxYear) {
    Object.assign(whereYear, {
      year: {
        [Op.lte]: maxYear
      }
    });
  }

  const whereCar = {};
  const whereModelYear = {};
  const whereProfile = {};
  const customFields = {
    fields: ['highestBidder', 'numberOfBidder', 'like', 'view', 'islike', 'isBid'],
    id
  };

  if (condition) {
    const arrCondition = [0, 1];
    if (arrCondition.indexOf(Number(condition)) < 0)
      return apiResponse._error({ res, errors: 'invalid condition' });
    Object.assign(whereCar, { condition: { [Op.eq]: condition } });
  }
  if (km) {
    if (km.length < 2) return apiResponse._error({ res, errors: 'invalid km' });
    if (validator.isInt(km[0] ? km[0].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid km[0]' });
    if (validator.isInt(km[1] ? km[1].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid km[1]' });
    Object.assign(whereCar, { km: { [Op.between]: [Number(km[0]), Number(km[1])] } });
  }
  if (price) {
    if (price.length < 2) return apiResponse._error({ res, errors: 'invalid price' });
    if (validator.isInt(price[0] ? price[0].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid price[0]' });
    if (validator.isInt(price[1] ? price[1].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid price[1]' });
    Object.assign(whereCar, { price: { [Op.between]: [Number(price[0]), Number(price[1])] } });
  }
  if (year) {
    if (year.length < 2) return apiResponse._error({ res, errors: 'invalid year' });
    if (validator.isInt(year[0] ? year[0].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid year[0]' });
    if (validator.isInt(year[1] ? year[1].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid year[1]' });
    Object.assign(whereModelYear, {
      [Op.and]: [{ year: { [Op.gte]: year[0] } }, { year: { [Op.lte]: year[1] } }]
    });
  }
  if (radius) {
    if (radius.length < 2) return apiResponse._error({ res, errors: 'invalid radius' });
    if (validator.isInt(radius[0] ? radius[0].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid radius[0]' });
    if (validator.isInt(radius[1] ? radius[1].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid radius[1]' });
    if (!latitude) return apiResponse._error({ res, errors: 'invalid latitude' });
    if (!longitude) return apiResponse._error({ res, errors: 'invalid longitude' });

    customFields.fields.push('distance');
    Object.assign(customFields, { latitude, longitude });
    await calculateDistance.CreateOrReplaceCalculateDistance();
    const distances = Sequelize.literal(
      `(SELECT calculate_distance(${latitude}, ${longitude}, (SELECT CAST(COALESCE(NULLIF((SELECT split_part("car"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude"), (SELECT CAST(COALESCE(NULLIF((SELECT split_part("car"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude"), 'K'))`
    );
    // Object.assign(whereCar, { where: Sequelize.where(distances, { [Op.lte]: 10 }) });
    Object.assign(whereCar, {
      where: {
        [Op.and]: [
          Sequelize.where(distances, { [Op.gte]: Number(radius[0]) }),
          Sequelize.where(distances, { [Op.lte]: Number(radius[1]) })
        ]
      }
    });
  }
  if (profile) {
    const arrprofile = ['end user', 'dealer'];
    if (arrprofile.indexOf(profile) < 0)
      return apiResponse._error({ res, errors: 'invalid profile' });
    Object.assign(whereProfile, { type: profile === 'dealer' ? 1 : 0 });
  }

  const includes = [
    {
      model: models.Car,
      as: 'car',
      attributes: {
        include: await carHelper.customFields(customFields),
        exclude: ['deletedAt']
      },
      where: whereCar,
      include: [
        {
          model: models.ModelYear,
          as: 'modelYear',
          attributes: ['id', 'year', 'modelId'],
          where: whereModelYear
        },
        {
          model: models.User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'phone', 'type', 'companyType']
        },
        {
          model: models.User,
          as: 'profile',
          attributes: ['id', 'type', 'companyType'],
          where: whereProfile
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
      ]
    }
  ];

  return models.Bargain.findAll({
    include: includes,
    where,
    order,
    offset,
    limit
  })
    .then(async data => {
      const count = await models.Bargain.count({
        include: includes,
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
}
router.get('/bid_list', passport.authenticate('user', { session: false }), async (req, res) => {
  return bidList(req, res);
});
router.get('/bid/list', passport.authenticate('user', { session: false }), async (req, res) => {
  return bidList(req, res);
});

async function sellList(req, res) {
  // const { id } = req.user;
  const id =(req.user)? req.user.id:null;
  const { status } = req.params;
  const {
    condition,
    profile,
    km,
    price,
    // djubleeReport,
    radius,
    year,
    // kota,
    // area,
    latitude,
    longitude
  } = req.query;
  const {
    groupModelId,
    modelId,
    brandId,
    modelYearId,
    minPrice,
    maxPrice,
    minYear,
    maxYear
  } = req.query;
  let { page, limit, by, sort } = req.query;
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  if (!by) by = 'id';
  const array = ['id', 'condition', 'price', 'km', 'createdAt', 'view', 'like', 'profile'];
  if (array.indexOf(by) < 0) by = 'createdAt';
  sort = ['asc', 'desc'].indexOf(sort) < 0 ? 'asc' : sort;
  const order = [];
  switch (by) {
    case 'view':
    case 'like':
      order.push([Sequelize.col(by), sort]);
      break;
    case 'profile':
      order.push([{ model: models.User, as: 'user' }, 'type', sort]);
      break;
    default:
      order.push([by, sort]);
      break;
  }
  const where = {};

  // Object.assign(where, {
  //   status: {
  //     [Op.eq]: status
  //   },
  //   userId: {
  //     [Op.eq]: id
  //   }
  // });

  if (status) Object.assign(where, { status });
  if (id) Object.assign(where, { userId: id });
  if (modelYearId) Object.assign(where, { modelYearId });
  if (groupModelId) Object.assign(where, { groupModelId });
  if (modelId) Object.assign(where, { modelId });
  if (brandId) Object.assign(where, { brandId });

  if (minPrice && maxPrice) {
    Object.assign(where, {
      price: {
        [Op.and]: [{ [Op.gte]: minPrice }, { [Op.lte]: maxPrice }]
      }
    });
  } else if (minPrice) {
    Object.assign(where, {
      price: {
        [Op.gte]: minPrice
      }
    });
  } else if (maxPrice) {
    Object.assign(where, {
      price: {
        [Op.lte]: maxPrice
      }
    });
  }

  const whereYear = {};
  if (minYear && maxYear) {
    Object.assign(whereYear, {
      year: {
        [Op.and]: [{ [Op.gte]: minYear }, { [Op.lte]: maxYear }]
      }
    });
  } else if (minYear) {
    Object.assign(whereYear, {
      year: {
        [Op.gte]: minYear
      }
    });
  } else if (maxYear) {
    Object.assign(whereYear, {
      year: {
        [Op.lte]: maxYear
      }
    });
  }

  const whereModelYear = {};
  const whereProfile = {};
  const customFields = {
    fields: ['numberOfBidder', 'like', 'view', 'islike', 'isBid'],
    id,
    upperCase: true
  };

  if (condition) {
    const arrCondition = [0, 1];
    if (arrCondition.indexOf(Number(condition)) < 0)
      return apiResponse._error({ res, errors: 'invalid condition' });
    Object.assign(where, { condition: { [Op.eq]: condition } });
  }
  if (km) {
    if (km.length < 2) return apiResponse._error({ res, errors: 'invalid km' });
    if (validator.isInt(km[0] ? km[0].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid km[0]' });
    if (validator.isInt(km[1] ? km[1].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid km[1]' });
    Object.assign(where, { km: { [Op.between]: [Number(km[0]), Number(km[1])] } });
  }
  if (price) {
    if (price.length < 2) return apiResponse._error({ res, errors: 'invalid price' });
    if (validator.isInt(price[0] ? price[0].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid price[0]' });
    if (validator.isInt(price[1] ? price[1].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid price[1]' });
    Object.assign(where, { price: { [Op.between]: [Number(price[0]), Number(price[1])] } });
  }
  if (year) {
    if (year.length < 2) return apiResponse._error({ res, errors: 'invalid year' });
    if (validator.isInt(year[0] ? year[0].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid year[0]' });
    if (validator.isInt(year[1] ? year[1].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid year[1]' });
    Object.assign(whereModelYear, {
      [Op.and]: [{ year: { [Op.gte]: year[0] } }, { year: { [Op.lte]: year[1] } }]
    });
  }
  if (radius) {
    if (radius.length < 2) return apiResponse._error({ res, errors: 'invalid radius' });
    if (validator.isInt(radius[0] ? radius[0].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid radius[0]' });
    if (validator.isInt(radius[1] ? radius[1].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid radius[1]' });
    if (!latitude) return apiResponse._error({ res, errors: 'invalid latitude' });
    if (!longitude) return apiResponse._error({ res, errors: 'invalid longitude' });

    customFields.fields.push('distance');
    Object.assign(customFields, { latitude, longitude });
    await calculateDistance.CreateOrReplaceCalculateDistance();
    const distances = Sequelize.literal(
      `(SELECT calculate_distance(${latitude}, ${longitude}, (SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude"), (SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude"), 'K'))`
    );
    // Object.assign(where, { where: Sequelize.where(distances, { [Op.lte]: 10 }) });
    Object.assign(where, {
      where: {
        [Op.and]: [
          Sequelize.where(distances, { [Op.gte]: Number(radius[0]) }),
          Sequelize.where(distances, { [Op.lte]: Number(radius[1]) })
        ]
      }
    });
  }
  if (profile) {
    const arrprofile = ['end user', 'dealer'];
    if (arrprofile.indexOf(profile) < 0)
      return apiResponse._error({ res, errors: 'invalid profile' });
    Object.assign(whereProfile, { type: profile === 'dealer' ? 1 : 0 });
  }

  const includes = [
    {
      model: models.ModelYear,
      as: 'modelYear',
      attributes: ['id', 'year', 'modelId'],
      where: whereModelYear
    },
    {
      model: models.User,
      as: 'user',
      attributes: ['id', 'name', 'email', 'phone', 'type', 'companyType']
    },
    {
      model: models.User,
      as: 'profile',
      attributes: ['id', 'type', 'companyType'],
      where: whereProfile
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

  return models.Car.findAll({
    attributes: Object.keys(models.Car.attributes).concat(
      await carHelper.customFields(customFields)
    ),
    include: includes,
    where,
    order,
    offset,
    limit
  })
    .then(async data => {
      const count = await models.Car.count({
        include: includes,
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
}
router.get(
  '/sell_list/status/:status',
  passport.authenticate('user', { session: false }),
  async (req, res) => {
    return sellList(req, res);
  }
);
router.get(
  '/sell/list/status/:status',
  // passport.authenticate('user', { session: false }),
  async (req, res) => {
    return sellList(req, res);
  }
);

// Update Status
router.put('/status/:id', passport.authenticate('user', { session: false }), async (req, res) => {
  const { id } = req.params;
  if (validator.isInt(id ? id.toString() : '') === false) {
    return res.status(400).json({
      success: false,
      errors: 'Invalid Parameter'
    });
  }

  const data = await models.Car.findByPk(id);
  if (!data) {
    return res.status(400).json({
      success: false,
      errors: 'Transaksi not found'
    });
  }

  const { status } = req.body;

  if (!status) {
    return res.status(400).json({
      success: false,
      errors: 'status is mandatory'
    });
  }

  return data
    .update({
      status
    })
    .then(() => {
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

router.get('/id/:id', async (req, res) => {
  const { id } = req.params;

  // FOR isLike & isBid
  const { userId } = req.query;
  let attributes = [
    [
      models.sequelize.literal(
        `(SELECT COUNT("Likes"."id") 
          FROM "Likes" 
          WHERE "Likes"."carId" = "Car"."id" 
            AND "Likes"."status" IS TRUE 
            AND "Likes"."deletedAt" IS NULL
        )`
      ),
      'like'
    ],
    [
      models.sequelize.literal(
        `(SELECT COUNT("Views"."id") 
          FROM "Views" 
          WHERE "Views"."carId" = "Car"."id" 
            AND "Views"."deletedAt" IS NULL
        )`
      ),
      'view'
    ],
    [
      models.sequelize.literal(
        `(SELECT COUNT("Bargains"."id") 
          FROM "Bargains" 
          WHERE "Bargains"."carId" = "Car"."id" 
            AND "Bargains"."deletedAt" IS NULL
            AND "Bargains"."bidType" = 0
        )`
      ),
      'numberOfBidder'
    ],
    [
      models.sequelize.literal(
        `(SELECT MAX("Bargains"."bidAmount") 
          FROM "Bargains" 
          WHERE "Bargains"."carId" = "Car"."id" 
            AND "Bargains"."deletedAt" IS NULL
            AND "Bargains"."bidType" = 0
        )`
      ),
      'highestBidder'
    ]
  ];

  if (userId) {
    attributes.push(
      [
        models.sequelize.literal(
          `(SELECT COUNT("Likes"."id") 
            FROM "Likes" 
            WHERE "Likes"."carId" = "Car"."id" AND "Likes"."status" IS TRUE 
              AND "Likes"."userId" = ${userId} 
              AND "Likes"."deletedAt" IS NULL
          )`
        ),
        'islike'
      ],
      [
        models.sequelize.literal(
          `(SELECT COUNT("Bargains"."id") 
            FROM "Bargains" 
            WHERE "Bargains"."userId" = ${userId} 
              AND "Bargains"."carId" = "Car"."id" 
              AND "Bargains"."expiredAt" >= (SELECT NOW()) 
              AND "Bargains"."deletedAt" IS NULL
              AND "Bargains"."bidType" = 0
          )`
        ),
        'isBid'
      ]
    );
  }

  console.log(attributes);
  console.log();
  console.log();
  console.log();
  console.log();
  console.log();

  return models.Car.findOne({
    attributes: Object.keys(models.Car.attributes).concat(attributes),
    include: [
      {
        model: models.User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'phone', 'type', 'companyType']
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
        model: models.ExteriorGalery,
        as: 'exteriorGalery',
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
    .catch(err => {
      res.status(422).json({
        success: false,
        errors: err.message
      });
    });
});

router.get('/like/:id', async (req, res) => {
  const { id } = req.params;
  const {
    condition,
    profile,
    km,
    price,
    // djubleeReport,
    radius,
    year,
    // kota,
    // area,
    latitude,
    longitude
  } = req.query;
  let { page, limit, by, sort } = req.query;
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  if (!by) by = 'id';
  const array = ['id', 'condition', 'price', 'km', 'createdAt', 'view', 'like', 'profile'];
  if (array.indexOf(by) < 0) by = 'createdAt';
  sort = ['asc', 'desc'].indexOf(sort) < 0 ? 'asc' : sort;
  const order = [];
  switch (by) {
    case 'view':
    case 'like':
    case 'km':
    case 'price':
    case 'condition':
      order.push([Sequelize.literal(`"car.${by}" ${sort}`)]);
      break;
    case 'profile':
      order.push([
        { model: models.Car, as: 'car' },
        { model: models.User, as: 'user' },
        'type',
        'asc'
      ]);
      break;
    default:
      order.push([by, sort]);
      break;
  }

  const where = {
    userId: id,
    status: true
  };

  const whereCar = {};
  const whereModelYear = {};
  const whereProfile = {};
  const customFields = {
    fields: [
      'islike',
      'isBidFromLike',
      'like',
      'view',
      'numberOfBidder',
      'highestBidder',
      'bidAmount'
    ],
    id
  };

  if (condition) {
    const arrCondition = [0, 1];
    if (arrCondition.indexOf(Number(condition)) < 0)
      return apiResponse._error({ res, errors: 'invalid condition' });
    Object.assign(whereCar, { condition: { [Op.eq]: condition } });
  }
  if (km) {
    if (km.length < 2) return apiResponse._error({ res, errors: 'invalid km' });
    if (validator.isInt(km[0] ? km[0].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid km[0]' });
    if (validator.isInt(km[1] ? km[1].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid km[1]' });
    Object.assign(whereCar, { km: { [Op.between]: [Number(km[0]), Number(km[1])] } });
  }
  if (price) {
    if (price.length < 2) return apiResponse._error({ res, errors: 'invalid price' });
    if (validator.isInt(price[0] ? price[0].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid price[0]' });
    if (validator.isInt(price[1] ? price[1].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid price[1]' });
    Object.assign(whereCar, { price: { [Op.between]: [Number(price[0]), Number(price[1])] } });
  }
  if (year) {
    if (year.length < 2) return apiResponse._error({ res, errors: 'invalid year' });
    if (validator.isInt(year[0] ? year[0].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid year[0]' });
    if (validator.isInt(year[1] ? year[1].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid year[1]' });
    Object.assign(whereModelYear, {
      [Op.and]: [{ year: { [Op.gte]: year[0] } }, { year: { [Op.lte]: year[1] } }]
    });
  }
  if (radius) {
    if (radius.length < 2) return apiResponse._error({ res, errors: 'invalid radius' });
    if (validator.isInt(radius[0] ? radius[0].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid radius[0]' });
    if (validator.isInt(radius[1] ? radius[1].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid radius[1]' });
    if (!latitude) return apiResponse._error({ res, errors: 'invalid latitude' });
    if (!longitude) return apiResponse._error({ res, errors: 'invalid longitude' });

    customFields.fields.push('distance');
    Object.assign(customFields, { latitude, longitude });
    await calculateDistance.CreateOrReplaceCalculateDistance();
    const distances = Sequelize.literal(
      `(SELECT calculate_distance(${latitude}, ${longitude}, (SELECT CAST(COALESCE(NULLIF((SELECT split_part("car"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude"), (SELECT CAST(COALESCE(NULLIF((SELECT split_part("car"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude"), 'K'))`
    );
    // Object.assign(whereCar, { where: Sequelize.where(distances, { [Op.lte]: 10 }) });
    Object.assign(whereCar, {
      where: {
        [Op.and]: [
          Sequelize.where(distances, { [Op.gte]: Number(radius[0]) }),
          Sequelize.where(distances, { [Op.lte]: Number(radius[1]) })
        ]
      }
    });
  }
  if (profile) {
    const arrprofile = ['end user', 'dealer'];
    if (arrprofile.indexOf(profile) < 0)
      return apiResponse._error({ res, errors: 'invalid profile' });
    Object.assign(whereProfile, { type: profile === 'dealer' ? 1 : 0 });
  }

  const includes = [
    {
      model: models.Car,
      as: 'car',
      attributes: {
        include: await carHelper.customFields(customFields),
        exclude: ['deletedAt']
      },
      where: whereCar,
      include: [
        {
          model: models.ModelYear,
          as: 'modelYear',
          attributes: ['id', 'year', 'modelId'],
          where: whereModelYear
        },
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
          model: models.User,
          as: 'profile',
          attributes: ['id', 'type', 'companyType'],
          where: whereProfile
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
        },
        {
          required: false,
          model: models.Bargain,
          as: 'bargain',
          attributes: ['id', 'userId', 'carId', 'haveSeenCar', 'paymentMethod', 'expiredAt'],
          limit: 1,
          order: [['id', 'desc']]
        }
      ]
    }
  ];
  return models.Like.findAll({
    attributes: {
      exclude: ['deletedAt']
    },
    include: includes,
    where,
    order,
    offset,
    limit
  })
    .then(async data => {
      const count = await models.Like.count({
        where,
        include: includes
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
        errors: err.message,
        backEnd: err
      });
    });
});

router.get('/view/:id', async (req, res) => {
  const { id } = req.params;
  const {
    condition,
    profile,
    km,
    price,
    // djubleeReport,
    radius,
    year,
    // kota,
    // area,
    latitude,
    longitude
  } = req.query;
  let { page, limit, by, sort } = req.query;
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  if (!by) by = 'id';
  const array = ['id', 'condition', 'price', 'km', 'createdAt', 'view', 'like', 'profile'];
  if (array.indexOf(by) < 0) by = 'createdAt';
  sort = ['asc', 'desc'].indexOf(sort) < 0 ? 'asc' : sort;
  const order = [];
  switch (by) {
    case 'view':
    case 'like':
    case 'km':
    case 'price':
    case 'condition':
      order.push([Sequelize.literal(`"car.${by}" ${sort}`)]);
      break;
    case 'profile':
      order.push([
        { model: models.Car, as: 'car' },
        { model: models.User, as: 'user' },
        'type',
        'asc'
      ]);
      break;
    default:
      order.push([by, sort]);
      break;
  }

  const where = {
    userId: id,
    id: {
      [Op.in]: models.sequelize.literal(
        `(SELECT "id" FROM (SELECT *, row_number() OVER (partition BY "carId" ORDER BY "id") AS row_number FROM "Views" WHERE "userId" = ${id} AND "deletedAt" IS NULL) AS rows WHERE row_number = 1)`
      )
    }
  };

  const whereCar = {};
  const whereModelYear = {};
  const whereProfile = {};
  const customFields = {
    fields: [
      'islike',
      'isBidFromLike',
      'like',
      'view',
      'numberOfBidder',
      'highestBidder',
      'bidAmount'
    ],
    id
  };

  if (condition) {
    const arrCondition = [0, 1];
    if (arrCondition.indexOf(Number(condition)) < 0)
      return apiResponse._error({ res, errors: 'invalid condition' });
    Object.assign(whereCar, { condition: { [Op.eq]: condition } });
  }
  if (km) {
    if (km.length < 2) return apiResponse._error({ res, errors: 'invalid km' });
    if (validator.isInt(km[0] ? km[0].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid km[0]' });
    if (validator.isInt(km[1] ? km[1].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid km[1]' });
    Object.assign(whereCar, { km: { [Op.between]: [Number(km[0]), Number(km[1])] } });
  }
  if (price) {
    if (price.length < 2) return apiResponse._error({ res, errors: 'invalid price' });
    if (validator.isInt(price[0] ? price[0].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid price[0]' });
    if (validator.isInt(price[1] ? price[1].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid price[1]' });
    Object.assign(whereCar, { price: { [Op.between]: [Number(price[0]), Number(price[1])] } });
  }
  if (year) {
    if (year.length < 2) return apiResponse._error({ res, errors: 'invalid year' });
    if (validator.isInt(year[0] ? year[0].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid year[0]' });
    if (validator.isInt(year[1] ? year[1].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid year[1]' });
    Object.assign(whereModelYear, {
      [Op.and]: [{ year: { [Op.gte]: year[0] } }, { year: { [Op.lte]: year[1] } }]
    });
  }
  if (radius) {
    if (radius.length < 2) return apiResponse._error({ res, errors: 'invalid radius' });
    if (validator.isInt(radius[0] ? radius[0].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid radius[0]' });
    if (validator.isInt(radius[1] ? radius[1].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid radius[1]' });
    if (!latitude) return apiResponse._error({ res, errors: 'invalid latitude' });
    if (!longitude) return apiResponse._error({ res, errors: 'invalid longitude' });

    customFields.fields.push('distance');
    Object.assign(customFields, { latitude, longitude });
    await calculateDistance.CreateOrReplaceCalculateDistance();
    const distances = Sequelize.literal(
      `(SELECT calculate_distance(${latitude}, ${longitude}, (SELECT CAST(COALESCE(NULLIF((SELECT split_part("car"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude"), (SELECT CAST(COALESCE(NULLIF((SELECT split_part("car"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude"), 'K'))`
    );
    // Object.assign(whereCar, { where: Sequelize.where(distances, { [Op.lte]: 10 }) });
    Object.assign(whereCar, {
      where: {
        [Op.and]: [
          Sequelize.where(distances, { [Op.gte]: Number(radius[0]) }),
          Sequelize.where(distances, { [Op.lte]: Number(radius[1]) })
        ]
      }
    });
  }
  if (profile) {
    const arrprofile = ['end user', 'dealer'];
    if (arrprofile.indexOf(profile) < 0)
      return apiResponse._error({ res, errors: 'invalid profile' });
    Object.assign(whereProfile, { type: profile === 'dealer' ? 1 : 0 });
  }

  const includes = [
    {
      model: models.Car,
      as: 'car',
      attributes: {
        include: await carHelper.customFields(customFields),
        exclude: ['deletedAt']
      },
      where: whereCar,
      include: [
        {
          model: models.ModelYear,
          as: 'modelYear',
          attributes: ['id', 'year', 'modelId'],
          where: whereModelYear
        },
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
          model: models.User,
          as: 'profile',
          attributes: ['id', 'type', 'companyType'],
          where: whereProfile
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
        },
        {
          required: false,
          model: models.Bargain,
          as: 'bargain',
          attributes: ['id', 'userId', 'carId', 'haveSeenCar', 'paymentMethod', 'expiredAt'],
          limit: 1,
          order: [['id', 'desc']]
        }
      ]
    }
  ];
  return models.View.findAll({
    include: includes,
    where,
    order,
    offset,
    limit
  })
    .then(async data => {
      const count = await models.View.count({
        where,
        include: includes
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

router.post('/', passport.authenticate('user', { session: false }), async (req, res) => {
  const {
    userId,
    brandId,
    groupModelId,
    modelId,
    modelYearId,
    exteriorColorId,
    interiorColorId,
    price,
    condition,
    usedFrom,
    frameNumber,
    engineNumber,
    STNKnumber,
    location,
    status,
    interior,
    exterior,
    day,
    startTime,
    endTime,
    km,
    address,
    cityId,
    subdistrictId
  } = req.body;
  const { images } = req.files;

  if (!userId) return res.status(400).json({ success: false, errors: 'user is mandatory' });
  if (!brandId) return res.status(400).json({ success: false, errors: 'brand is mandatory' });
  if (!groupModelId) return res.status(400).json({ success: false, errors: 'groupModel is mandatory' });
  if (!modelId) return res.status(400).json({ success: false, errors: 'model is mandatory' });
  if (!modelYearId) return res.status(400).json({ success: false, errors: 'model year is mandatory' });
  if (!location) {
    return res.status(400).json({ success: false, errors: 'location is mandatory' });
  } else {
    let locations = location.split(',');
    locations[0] = general.customReplace(locations[0], ' ', '');
    locations[1] = general.customReplace(locations[1], ' ', '');
    if (validator.isNumeric(locations[0] ? locations[0].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid latitude' });
    if (validator.isNumeric(locations[1] ? locations[1].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid longitude' });
  }
  if (km) {
    if (validator.isInt(km) === false)
      return res.status(422).json({ success: false, errors: 'km is number' });
  }

  let STNKphoto = null;
  const result = {};
  if (images) {
    const tname = randomize('0', 4);
    result.name = `djublee/images/car/${tname}${moment().format('x')}${unescape(
      images[0].originalname
    ).replace(/\s/g, '')}`;
    result.mimetype = images[0].mimetype;
    result.data = images[0].buffer;
    STNKphoto = result.name;
    // imageHelper.uploadToS3(result);
  }
  const errors = [];
  const insert = {
    userId,
    brandId,
    modelId,
    groupModelId,
    modelYearId,
    exteriorColorId,
    interiorColorId,
    price,
    condition,
    usedFrom,
    frameNumber,
    engineNumber,
    STNKnumber,
    STNKphoto,
    location: location.replace(/\s/g, ''),
    status,
    km,
    oldPrice:price
  };

  if (address) Object.assign(insert, { address });
  if (cityId) {
    const cityExist = await models.City.findByPk(cityId);
    if (!cityExist) return res.status(404).json({ success: false, errors: 'city not found' });
    Object.assign(insert, { cityId });
  }
  if (subdistrictId) {
    const subDistrictExist = await models.SubDistrict.findOne({
      where: {
        id: subdistrictId,
        cityId
      }
    });
    if (!subDistrictExist)
      return res.status(404).json({ success: false, errors: 'sub district not found' });
    Object.assign(insert, { subdistrictId });
  }

  const userNotifs = [];
  const otherBidders = await models.Bargain.aggregate('Bargain.userId', 'DISTINCT', {
    plain: false,
    include:[
      {
        model: models.Car,
        as: 'car',
        attributes: [],
        where: {
          brandId,
          modelId,
          groupModelId
        }
      }
    ],
    where: {
      userId: {
        [Op.ne]: req.user.id
      }
    }
  });  
  otherBidders.map(async otherBidder => {
    userNotifs.push({
      userId: otherBidder.DISTINCT,
      collapseKey: null,
      notificationTitle: `Notifikasi Beli`,
      notificationBody: `mobil sejenis`,
      notificationClickAction: `similiarCarBeli`,
      dataReferenceId: 123,
      category: 2,
      status: 1,
      tab: `tabBeli`
    });
  });

  const otherCarSells = await models.Car.aggregate('userId', 'DISTINCT', {
    plain: false,
    where: {
      brandId,
      modelId,
      groupModelId,
      userId: {
        [Op.ne]: req.user.id
      }
    }
  });
  otherCarSells.map(async otherCarSell => {
    userNotifs.push({
      userId: otherCarSell.DISTINCT,
      collapseKey: null,
      notificationTitle: `Notifikasi Jual`,
      notificationBody: `mobil sejenis`,
      notificationClickAction: `similiarCarSell`,
      dataReferenceId: 123,
      category: 1,
      status: 2,
      tab: `tabJual`
    });
  });
  
  // return apiResponse._success({
  //   res,
  //   data: {otherBidders, userNotifs}
  // });

  const trans = await models.sequelize.transaction();
  const data = await models.Car.create(insert, {
    transaction: trans
  }).catch(err => {
    trans.rollback();
    return res.status(422).json({
      success: false,
      errors: err.message
    });
  });

  if (Object.keys(result).length > 0) imageHelper.uploadToS3(result);

  if (interior) {
    let { interiorGalery } = [];
    interiorGalery = await general.mapping(interior);
    await Promise.all(
      interiorGalery.map(async interiorData => {
        await models.InteriorGalery.create(
          {
            carId: data.id,
            fileId: interiorData
          },
          {
            transaction: trans
          }
        ).catch(err => {
          errors.push(err);
        });
      })
    );
  }

  if (exterior) {
    let { exteriorGalery } = [];
    exteriorGalery = await general.mapping(exterior);
    await Promise.all(
      exteriorGalery.map(async exteriorData => {
        await models.ExteriorGalery.create(
          {
            carId: data.id,
            fileId: exteriorData
          },
          {
            transaction: trans
          }
        ).catch(err => {
          errors.push(err);
        });
      })
    );
  }

  if (day && startTime && endTime) {
    let { dayTemp, startTimeTemp, endTimeTemp } = [];
    dayTemp = general.mapping(day);
    startTimeTemp = general.mapping(startTime);
    endTimeTemp = general.mapping(endTime);

    const schedule = [];
    for (let i = 0; i < dayTemp.length; i += 1) {
      schedule.push({
        carId: data.id,
        day: dayTemp[i],
        startTime: startTimeTemp[i],
        endTime: endTimeTemp[i]
      });
    }

    await models.MeetingSchedule.bulkCreate(schedule, { transaction: trans }).catch(err => {
      errors.push(err);
    });
  }

  if (errors.length > 0) {
    trans.rollback();
    return res.status(422).json({
      success: false,
      errors
    });
  }
  trans.commit();

  userNotifs.map(async userNotif => {
    Object.assign(userNotif, {
      dataReferenceId: data.id
    });
    const emit = await notification.insertNotification(userNotif);
    req.io.emit(`${userNotif.tab}-${userNotif.userId}`, emit);
    notification.userNotif(userNotif);
    console.log(userNotif);
  });

  return res.json({
    success: true,
    data
  });
});

router.put('/:id', passport.authenticate('user', { session: false }), async (req, res) => {
  const { id } = req.params;
  const { price, location, km, meetingSchedules, address, cityId, subdistrictId } = req.body;
  const { images } = req.files;
  const update = {};

  if (validator.isInt(id ? id.toString() : '') === false)
    return res.status(400).json({ success: false, errors: 'invalid id' });
  if (price) {
    if (validator.isInt(price ? price.toString() : '') === false)
      return res.status(422).json({ success: false, errors: 'invalid price' });

    Object.assign(update, { price });
  }
  if (location) {
    let locations = location.split(',');
    locations[0] = general.customReplace(locations[0], ' ', '');
    locations[1] = general.customReplace(locations[1], ' ', '');
    if (validator.isNumeric(locations[0] ? locations[0].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid latitude' });
    if (validator.isNumeric(locations[1] ? locations[1].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid longitude' });

    Object.assign(update, { location });
  }
  if (km) {
    if (validator.isInt(km ? km.toString() : '') === false)
      return res.status(422).json({ success: false, errors: 'invalid km' });

    Object.assign(update, { km });
  }
  if (address) Object.assign(update, { address });

  const result = {};
  let isUpload = false;
  if (images) {
    const tname = randomize('0', 4);
    result.name = `djublee/images/car/${tname}${moment().format('x')}${unescape(
      images[0].originalname
    ).replace(/\s/g, '')}`;
    result.mimetype = images[0].mimetype;
    result.data = images[0].buffer;
    isUpload = true;
    Object.assign(update, { STNKphoto: result.name });
  }

  let checkDetails = { status: true, message: `ingredient oke` };
  if (meetingSchedules) {
    meetingSchedules.map(d => {
      if (validator.isInt(d.id ? d.id.toString() : '') === false) {
        Object.assign(checkDetails, { status: false, message: `invalid id ${d.id}` });
        return;
      }
      if (validator.isInt(d.day ? d.day.toString() : '') === false) {
        Object.assign(checkDetails, { status: false, message: `invalid day ${d.id}` });
        return;
      }
      // if (validator.isInt(d.startTime ? d.startTime.toString() : '') === false) {
      if (!d.startTime) {
        Object.assign(checkDetails, { status: false, message: `invalid startTime ${d.id}` });
        return;
      }
      if (!d.endTime) {
        Object.assign(checkDetails, { status: false, message: `invalid endTime ${d.id}` });
        return;
      }
    });
    if (!checkDetails.status)
      return apiResponse._error({
        res,
        status: checkDetails.status,
        errors: checkDetails.message,
        data: null
      });
  }

  if (cityId) {
    const cityExist = await models.City.findByPk(cityId);
    if (!cityExist) return res.status(404).json({ success: false, errors: 'city not found' });
    Object.assign(update, { cityId });
  }
  if (subdistrictId) {
    const subDistrictExist = await models.SubDistrict.findOne({
      where: {
        id: subdistrictId,
        cityId
      }
    });
    if (!subDistrictExist)
      return res.status(404).json({ success: false, errors: 'sub district not found' });
    Object.assign(update, { subdistrictId });
  }

  const carExists = await models.Car.findByPk(id);
  if (!carExists) return apiResponse._error({ res, errors: `car not found` });
  Object.assign(update, { oldPrice: carExists.price });

  let isCheaper = false;
  const userNotifs = [];
  if (price) {
    isCheaper = price < carExists.price ? true : isCheaper;
    if (isCheaper) {
      // notif ke penyuka
      const likers = await models.Like.aggregate('userId', 'DISTINCT', {
        plain: false,
        where: { carId: id }
      });
      likers.map(async liker => {
        userNotifs.push({
          userId: liker.DISTINCT,
          collapseKey: null,
          notificationTitle: `Harga mobil turun`,
          notificationBody: `Mobil yang anda suka menurunkan harga`,
          notificationClickAction: `carPriceDiskon`,
          dataReferenceId: id,
          category: 3, // like
          status: 1, // menurunkan harga
          tab: `tabLike`
        });
      });

      const bidders = await models.Bargain.aggregate('userId', 'DISTINCT', {
        plain: false,
        where: { carId: id }
      });
      bidders.map(async bidder => {
        userNotifs.push({
          userId: bidder.DISTINCT,
          collapseKey: null,
          notificationTitle: `Harga mobil turun`,
          notificationBody: `Mobil yang anda tawar menurunkan harga`,
          notificationClickAction: `carPriceDiskon`,
          dataReferenceId: id,
          category: 2, // bid
          status: 2, // menurunkan harga
          tab: `tabBeli`
        });
      });
    }
  }

  // console.log(userNotifs.length);
  // return res
  //   .status(200)
  //   .json({
  //     success: true,
  //     userNotifs,
  //     price,
  //     status: price < carExists.price ? `lebih murah` : `tidak`,
  //     data: carExists
  //   });

  const trans = await models.sequelize.transaction();
  const errors = [];

  await carExists
    .update(update, {
      transaction: trans
    })
    .then(async () => {
      if (meetingSchedules) {
        meetingSchedules.map(async d => {
          if (d.id > 0) {
            return models.MeetingSchedule.update(
              {
                day: d.day,
                startTime: d.startTime,
                endTime: d.endTime
              },
              {
                where: { id: d.id }
              }
            );
          } else {
            return models.MeetingSchedule.create({
              carId: carExists.id,
              day: d.day,
              startTime: d.startTime,
              endTime: d.endTime
            });
          }
        });
      }
    })
    .catch(async err => {
      trans.rollback();
      return res.status(422).json({
        success: false,
        errors: err.message
      });
    });

  if (errors.length > 0) {
    trans.rollback();
    return res.status(422).json({
      success: false,
      errors
    });
  }

  trans.commit();
  if (isUpload) imageHelper.uploadToS3(result);

  if (userNotifs.length > 0) {
    userNotifs.map(async userNotif => {
      const emit = await notification.insertNotification(userNotif);
      req.io.emit(`${userNotif.tab}-${userNotif.userId}`, emit);
      notification.userNotif(userNotif);
      console.log(userNotif);
    });
  }

  const data = await models.Car.findByPk(id, {
    include: [
      {
        model: models.MeetingSchedule,
        as: 'meetingSchedule',
        attributes: ['id', 'carId', 'day', 'startTime', 'endTime']
      }
    ]
  });

  return res.status(200).json({ success: true, data });
});

router.post('/like/:id', passport.authenticate('user', { session: false }), async (req, res) => {
  const { id } = req.params;
  const car = await models.Car.findOne({
    where: {
      id
    }
  });

  if (!car) {
    return res.status(404).json({
      success: false,
      errors: 'data not found'
    });
  }

  const user = await models.Like.findOne({
    where: {
      [Op.and]: [{ userId: req.user.id }, { carId: id }]
    }
  });
  if (user) {
    if (user.status === true) {
      return user
        .update({
          status: false
        })
        .then(data => {
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
    }
    return user
      .update({
        status: true
      })
      .then(data => {
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
  }

  return models.Like.create({
    userId: req.user.id,
    carId: car.id,
    status: true
  })
    .then(data => {
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

router.post('/view/:id', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  const car = await models.Car.findOne({
    where: {
      id
    }
  });

  if (!car) {
    return res.status(404).json({
      success: false,
      errors: 'data not found'
    });
  }

  let user = null;
  if (userId) {
    user = userId;
  }

  return models.View.create({
    userId: user,
    carId: car.id
  })
    .then(data => {
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

router.delete('/id/:id', passport.authenticate('user', { session: false }), async (req, res) => {
  const { id } = req.params;
  if (validator.isInt(id ? id.toString() : '') === false) {
    return res.status(400).json({
      success: false,
      errors: 'Invalid Parameter'
    });
  }

  const data = await models.Car.findByPk(id);
  if (!data) {
    return res.status(400).json({
      success: false,
      errors: 'Car not found'
    });
  }

  const bargainData = await models.Bargain.findAll({
    where: {
      carId: id
    }
  });
  const bargains = [];
  if (bargainData) {
    bargainData.map(dataB => {
      bargains.push(dataB.id.toString());
    });
    console.log(bargains);
  }

  // like
  const likeData = await models.Like.findAll({
    where: {
      carId: id
    }
  });
  const likes = [];
  if (likeData) {
    likeData.map(dataL => {
      likes.push(dataL.id.toString());
    });
    console.log(likes);
  }

  // view
  const viewData = await models.View.findAll({
    where: {
      carId: id
    }
  });
  const views = [];
  if (viewData) {
    viewData.map(dataV => {
      views.push(dataV.id.toString());
    });
    console.log(views);
  }

  const trans = await models.sequelize.transaction();

  models.Car.destroy({ where: { id } }, { transaction: trans }).catch(err => {
    trans.rollback();
    return res.status(422).json({
      success: false,
      errors: err.message
    });
  });

  if (bargains !== []) {
    models.Bargain.destroy(
      {
        where: {
          id: { $in: bargains }
        }
      },
      {
        transaction: trans
      }
    ).catch(err => {
      trans.rollback();
      return res.status(422).json({
        success: false,
        errors: err.message
      });
    });
  }

  if (likes !== []) {
    models.Like.destroy(
      {
        where: {
          id: { $in: likes }
        }
      },
      {
        transaction: trans
      }
    ).catch(err => {
      trans.rollback();
      return res.status(422).json({
        success: false,
        errors: err.message
      });
    });
  }

  if (views !== []) {
    models.View.destroy(
      {
        where: {
          id: { $in: views }
        }
      },
      {
        transaction: trans
      }
    ).catch(err => {
      trans.rollback();
      return res.status(422).json({
        success: false,
        errors: err.message
      });
    });
  }

  trans.commit();
  return res.json({
    success: true,
    data
  });
});

router.delete('/meet/schedules/:id', passport.authenticate('user', { session: false }), async (req, res) => {
  const { id } = req.params;
  if (validator.isInt(id ? id.toString() : '') === false) return res.status(400).json({ success: false, errors: 'Invalid Parameter' });
  
  const data = await models.MeetingSchedule.findByPk(id);
  if (!data) return res.status(400).json({ success: false, errors: 'Schedule not found' });

  return data
    .destroy(id)
    .then(async data => {
      return apiResponse._success({ res, data });
    })
    .catch(err => {
      return apiResponse._error({ res, errors: err });
    });
});

async function viewLike(req, res) {
  const {
    condition,
    profile,
    km,
    price,
    // djubleeReport,
    radius,
    year,
    // kota,
    // area,
    latitude,
    longitude
  } = req.query;
  let { page, limit, by, sort } = req.query;
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  if (!by) by = 'jumlahLike';
  const array = [
    'id',
    'condition',
    'price',
    'km',
    'createdAt',
    'jumlahView',
    'jumlahLike',
    'profile'
  ];
  if (array.indexOf(by) < 0) by = 'createdAt';
  sort = ['asc', 'desc'].indexOf(sort) < 0 ? 'asc' : sort;
  const order = [];
  switch (by) {
    case 'jumlahView':
    case 'jumlahLike':
      order.push([Sequelize.col(by), sort]);
      break;
    case 'profile':
      order.push([{ model: models.User, as: 'user' }, 'type', sort]);
      break;
    default:
      order.push([by, sort]);
      break;
  }

  const where = {
    [Op.and]: [
      models.sequelize.literal(
        `((SELECT COUNT("Likes"."carId") FROM "Likes" WHERE "Likes"."carId" = "Car"."id" AND "Likes"."status" IS TRUE AND "Likes"."deletedAt" IS NULL) > 0)`
      )
    ]
  };

  const whereModelYear = {};
  const whereProfile = {};
  const customFields = {
    fields: ['Brands', 'Model', 'jumlahLike', 'jumlahView', 'highestBidder', 'numberOfBidder'],
    upperCase: true
  };

  if (condition) {
    const arrCondition = [0, 1];
    if (arrCondition.indexOf(Number(condition)) < 0)
      return apiResponse._error({ res, errors: 'invalid condition' });
    Object.assign(where, { condition: { [Op.eq]: condition } });
  }
  if (km) {
    if (km.length < 2) return apiResponse._error({ res, errors: 'invalid km' });
    if (validator.isInt(km[0] ? km[0].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid km[0]' });
    if (validator.isInt(km[1] ? km[1].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid km[1]' });
    Object.assign(where, { km: { [Op.between]: [Number(km[0]), Number(km[1])] } });
  }
  if (price) {
    if (price.length < 2) return apiResponse._error({ res, errors: 'invalid price' });
    if (validator.isInt(price[0] ? price[0].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid price[0]' });
    if (validator.isInt(price[1] ? price[1].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid price[1]' });
    Object.assign(where, { price: { [Op.between]: [Number(price[0]), Number(price[1])] } });
  }
  if (year) {
    if (year.length < 2) return apiResponse._error({ res, errors: 'invalid year' });
    if (validator.isInt(year[0] ? year[0].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid year[0]' });
    if (validator.isInt(year[1] ? year[1].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid year[1]' });
    Object.assign(whereModelYear, {
      [Op.and]: [{ year: { [Op.gte]: year[0] } }, { year: { [Op.lte]: year[1] } }]
    });
  }
  if (radius) {
    if (radius.length < 2) return apiResponse._error({ res, errors: 'invalid radius' });
    if (validator.isInt(radius[0] ? radius[0].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid radius[0]' });
    if (validator.isInt(radius[1] ? radius[1].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid radius[1]' });
    if (!latitude) return apiResponse._error({ res, errors: 'invalid latitude' });
    if (!longitude) return apiResponse._error({ res, errors: 'invalid longitude' });

    customFields.fields.push('distance');
    Object.assign(customFields, { latitude, longitude });
    await calculateDistance.CreateOrReplaceCalculateDistance();
    const distances = Sequelize.literal(
      `(SELECT calculate_distance(${latitude}, ${longitude}, (SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude"), (SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude"), 'K'))`
    );
    // Object.assign(where, { where: Sequelize.where(distances, { [Op.lte]: 10 }) });
    Object.assign(where, {
      where: {
        [Op.and]: [
          Sequelize.where(distances, { [Op.gte]: Number(radius[0]) }),
          Sequelize.where(distances, { [Op.lte]: Number(radius[1]) })
        ]
      }
    });
  }
  if (profile) {
    const arrprofile = ['end user', 'dealer'];
    if (arrprofile.indexOf(profile) < 0)
      return apiResponse._error({ res, errors: 'invalid profile' });
    Object.assign(whereProfile, { type: profile === 'dealer' ? 1 : 0 });
  }

  const includes = [
    {
      model: models.ModelYear,
      as: 'modelYear',
      attributes: ['id', 'year', 'modelId'],
      where: whereModelYear
    },
    {
      model: models.User,
      as: 'user',
      attributes: ['id', 'name', 'email', 'phone', 'type', 'companyType'],
      include: [
        {
          model: models.File,
          as: 'file',
          attributes: {
            exclude: ['createdAt', 'updatedAt', 'deletedAt']
          }
        },
        {
          model: models.Dealer,
          as: 'dealer',
          attributes: {
            exclude: ['createdAt', 'updatedAt', 'deletedAt']
          }
        },
        {
          model: models.Company,
          as: 'company',
          attributes: {
            exclude: ['createdAt', 'updatedAt', 'deletedAt']
          }
        },
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
      model: models.User,
      as: 'profile',
      attributes: ['id', 'type', 'companyType'],
      where: whereProfile
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
    },
    {
      required: false,
      model: models.Bargain,
      as: 'bargain',
      attributes: ['id', 'userId', 'carId', 'haveSeenCar', 'paymentMethod', 'expiredAt'],
      limit: 1,
      order: [['id', 'desc']]
    }
  ];
  return models.Car.findAll({
    attributes: Object.keys(models.Car.attributes).concat(
      await carHelper.customFields(customFields)
    ),
    include: includes,
    where,
    order,
    offset,
    limit
  })
    .then(async data => {
      const count = await models.Car.count({ include: includes, where });
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
}
router.get('/viewLike', async (req, res) => {
  return viewLike(req, res);
});
router.get('/views/like', async (req, res) => {
  return viewLike(req, res);
});

// router get list car by like(Login)
router.get(
  '/viewLikeLogon',
  passport.authenticate('user', { session: false }),
  async (req, res) => {
    let { condition, page, limit, sort } = req.query;
    const userId = await req.user.id;
    let offset = 0;

    if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;
    if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
    else page = 1;

    const order = [
      // ['createdAt', 'desc'],
      [
        models.sequelize.literal(`(
        SELECT COUNT("Likes"."carId") 
        FROM "Likes" 
        WHERE "Likes"."carId" = "Car"."id" 
          AND "Likes"."status" IS TRUE
          AND "Likes"."deletedAt" IS NULL
      )`),
        'DESC'
      ]
    ];

    if (!sort) sort = 'asc';
    else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';

    const where = {
      [Op.and]: [
        models.sequelize.literal(`(
          (SELECT COUNT("Likes"."carId") 
            FROM "Likes" 
            WHERE "Likes"."carId" = "Car"."id"
              AND "Likes"."status" IS TRUE
              AND "Likes"."deletedAt" IS NULL
          ) > 0 
        )`)
      ]
    };

    if (condition) {
      Object.assign(where, {
        condition: {
          [Op.eq]: condition
        }
      });
    }

    return models.Car.findAll({
      attributes: Object.keys(models.Car.attributes).concat([
        [
          models.sequelize.literal(
            `(SELECT COUNT("Likes"."id") 
            FROM "Likes" 
            WHERE "Likes"."carId" = "Car"."id" 
              AND "Likes"."status" IS TRUE 
              AND "Likes"."userId" = ${userId} 
              AND "Likes"."deletedAt" IS NULL
          )`
          ),
          'islike'
        ],
        [
          models.sequelize.literal(
            `(SELECT COUNT("Bargains"."id") 
            FROM "Bargains" 
            WHERE "Bargains"."userId" = ${userId} 
              AND "Bargains"."carId" = "Car"."id" 
              AND "Bargains"."expiredAt" >= (SELECT NOW()) 
              AND "Bargains"."deletedAt" IS NULL
              AND "Bargains"."bidType" = 0
          )`
          ),
          'isBid'
        ],
        [
          models.sequelize.literal(
            `(SELECT "Brands"."name" 
            FROM "Brands" 
            WHERE "Brands"."id" = "Car"."brandId" 
              AND "Brands"."deletedAt" IS NULL
          )`
          ),
          'Brands'
        ],
        [
          models.sequelize.literal(
            `(SELECT "Models"."name" 
            FROM "Models" 
            WHERE "Models"."id" = "Car"."modelId" 
              AND "Models"."deletedAt" IS NULL
          )`
          ),
          'Model'
        ],
        [
          models.sequelize.literal(
            `(SELECT COUNT("Likes"."carId") 
            FROM "Likes" 
            WHERE "Likes"."carId" = "Car"."id" 
              AND "Likes"."status" IS TRUE 
              AND "Likes"."deletedAt" IS NULL
          )`
          ),
          'jumlahLike'
        ],
        [
          models.sequelize.literal(
            `(SELECT COUNT("Views"."carId") 
            FROM "Views" 
            WHERE "Views"."carId" = "Car"."id" 
              AND "Views"."deletedAt" IS NULL
          )`
          ),
          'jumlahView'
        ],
        [
          models.sequelize.literal(
            `(SELECT MAX("Bargains"."bidAmount") 
            FROM "Bargains" 
            WHERE "Bargains"."carId" = "Car"."id" 
              AND "Bargains"."deletedAt" IS NULL
              AND "Bargains"."bidType" = 0
          )`
          ),
          'highestBidder'
        ],
        [
          models.sequelize.literal(
            `(SELECT COUNT("Bargains"."id") 
            FROM "Bargains" 
            WHERE "Bargains"."carId" = "Car"."id" 
              AND "Bargains"."deletedAt" IS NULL
              AND "Bargains"."bidType" = 0
          )`
          ),
          'numberOfBidder'
        ],
        [
          models.sequelize.literal(
            `(SELECT MAX("Bargains"."bidAmount") 
            FROM "Bargains" 
            WHERE "Bargains"."carId" = "Car"."id" 
              AND "Bargains"."deletedAt" IS NULL
              AND "Bargains"."bidType" = 0
              AND "Bargains"."userId" = ${userId}
          )`
          ),
          'bidAmount'
        ]
      ]),
      include: [
        {
          model: models.User,
          as: 'user',
          attributes: {
            exclude: ['password', 'createdAt', 'updatedAt', 'deletedAt']
          },
          include: [
            {
              model: models.File,
              as: 'file',
              attributes: {
                exclude: ['createdAt', 'updatedAt', 'deletedAt']
              }
            },
            {
              model: models.Dealer,
              as: 'dealer',
              attributes: {
                exclude: ['createdAt', 'updatedAt', 'deletedAt']
              }
            },
            {
              model: models.Company,
              as: 'company',
              attributes: {
                exclude: ['createdAt', 'updatedAt', 'deletedAt']
              }
            },
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
        },
        {
          model: models.ModelYear,
          as: 'modelYear',
          attributes: {
            exclude: ['createdAt', 'updatedAt', 'deletedAt']
          }
        },
        {
          required: false,
          model: models.Bargain,
          as: 'bargain',
          attributes: ['id', 'userId', 'carId', 'haveSeenCar', 'paymentMethod', 'expiredAt'],
          limit: 1,
          order: [['id', 'desc']]
        }
      ],
      where,
      order,
      offset,
      limit
    })
      .then(async data => {
        const count = await models.Car.count({ where });
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
  }
);

router.get(
  '/categories',
  /*passport.authenticate('user', { session: false }),*/ async (req, res) => {
    return carsController.getCategory(req, res);
  }
);

module.exports = router;
