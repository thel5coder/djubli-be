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

const { Op } = Sequelize;
const router = express.Router();

const DEFAULT_LIMIT = process.env.DEFAULT_LIMIT || 10;
const MAX_LIMIT = process.env.MAX_LIMIT || 50;

router.get('/', async (req, res) => {
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
    by,
    radius,
    latitude,
    longitude
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

  // Search By Location (Latitude, Longitude & Radius) (For Pin Map)
  if (by === 'location') {
    if (!latitude) {
      return res.status(400).json({
        success: false,
        errors: 'Latitude not found!'
      });
    }

    if (!longitude) {
      return res.status(400).json({
        success: false,
        errors: 'Longitude not found!'
      });
    }

    if (!radius) {
      return res.status(400).json({
        success: false,
        errors: 'Radius not found!'
      });
    }

    let distances = models.sequelize.literal(`(SELECT calculate_distance(${latitude}, ${longitude}, (SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude"), (SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude"), 'K'))`);
    Object.assign(where, {
      [Op.and]: [models.sequelize.where(distances, { [Op.lte]: radius })]
    });
  }

  return models.Car.findAll({
    attributes: Object.keys(models.Car.attributes).concat([
      [
        models.sequelize.literal(
          '(SELECT COUNT("Likes"."id") FROM "Likes" WHERE "Likes"."carId" = "Car"."id" AND "Likes"."deletedAt" IS NULL)'
        ),
        'like'
      ],
      [
        models.sequelize.literal(
          '(SELECT COUNT("Views"."id") FROM "Views" WHERE "Views"."carId" = "Car"."id" AND "Views"."deletedAt" IS NULL)'
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
        attributes: ['id', 'name', 'email', 'phone']
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

router.get('/user/:id', async (req, res) => {
  const { id } = req.params;
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
  else if (by === 'like') order = [[models.sequelize.col('like'), sort]];
  else if (by === 'view') order = [[models.sequelize.col('view'), sort]];

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
          '(SELECT COUNT("Likes"."id") FROM "Likes" WHERE "Likes"."carId" = "Car"."id" AND "Likes"."status" IS TRUE AND "Likes"."deletedAt" IS NULL)'
        ),
        'like'
      ],
      [
        models.sequelize.literal(
          '(SELECT COUNT("Views"."id") FROM "Views" WHERE "Views"."carId" = "Car"."id" AND "Views"."deletedAt" IS NULL AND "Views"."deletedAt" IS NULL)'
        ),
        'view'
      ],
      [
        models.sequelize.literal(
          '(SELECT COUNT("Bargains"."id") FROM "Bargains" WHERE "Bargains"."carId" = "Car"."id" AND "Bargains"."deletedAt" IS NULL)'
        ),
        'numberOfBidder'
      ],
      [
        models.sequelize.literal(
          '(SELECT MAX("Bargains"."bidAmount") FROM "Bargains" WHERE "Bargains"."carId" = "Car"."id" AND "Bargains"."deletedAt" IS NULL)'
        ),
        'highestBidder'
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
    maxYear,
    by
  } = req.query;
  let { page, limit, sort } = req.query;
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
          '(SELECT COUNT("Likes"."id") FROM "Likes" WHERE "Likes"."carId" = "Car"."id" AND "Likes"."deletedAt" IS NULL)'
        ),
        'like'
      ],
      [
        models.sequelize.literal(
          '(SELECT COUNT("Views"."id") FROM "Views" WHERE "Views"."carId" = "Car"."id" AND "Views"."deletedAt" IS NULL)'
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
        attributes: ['id', 'name', 'email', 'phone']
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
          '(SELECT COUNT("Likes"."id") FROM "Likes" WHERE "Likes"."carId" = "Car"."id" AND "Likes"."deletedAt" IS NULL)'
        ),
        'like'
      ],
      [
        models.sequelize.literal(
          '(SELECT COUNT("Views"."id") FROM "Views" WHERE "Views"."carId" = "Car"."id" AND "Views"."deletedAt" IS NULL)'
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
        attributes: ['id', 'name', 'email', 'phone']
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

router.get('/bid_list', passport.authenticate('user', { session: false }), async (req, res) => {
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

  let order = [
    ['createdAt', 'desc'],
    [
      { model: models.Car, as: 'car' },
      { model: models.Bargain, as: 'bargain' },
      'createdAt',
      'desc'
    ]
  ];

  if (!sort) sort = 'asc';
  else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';
  if (by === 'price' || by === 'id') order = [[by, sort]];

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
        attributes: {
          exclude: ['createdAt', 'updatedAt', 'deletedAt'],
          include: [
            [
              models.sequelize.literal(
                '(SELECT MAX("Bargains"."bidAmount") FROM "Bargains" WHERE "Bargains"."carId" = "car"."id" AND "Bargains"."deletedAt" IS NULL)'
              ),
              'highestBidder'
            ],
            [
              models.sequelize.literal(
                '(SELECT COUNT("Bargains"."id") FROM "Bargains" WHERE "Bargains"."carId" = "car"."id" AND "Bargains"."deletedAt" IS NULL)'
              ),
              'numberOfBidder'
            ],
            [
              models.sequelize.literal(
                '(SELECT COUNT("Likes"."id") FROM "Likes" WHERE "Likes"."carId" = "car"."id" AND "Likes"."status" IS TRUE AND "Likes"."deletedAt" IS NULL)'
              ),
              'like'
            ],
            [
              models.sequelize.literal(
                '(SELECT COUNT("Views"."id") FROM "Views" WHERE "Views"."carId" = "car"."id" AND "Views"."deletedAt" IS NULL)'
              ),
              'view'
            ]
          ]
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
            model: models.Bargain,
            as: 'bargain',
            attributes: ['createdAt']
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

// Get sell car By Status
router.get(
  '/sell_list/status/:status',
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

    Object.assign(where, {
      status: {
        [Op.eq]: status
      },
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

    return models.Car.findAll({
      attributes: Object.keys(models.Car.attributes).concat([
        [
          models.sequelize.literal(
            '(SELECT COUNT("Bargains"."id") FROM "Bargains" WHERE "Bargains"."carId" = "Car"."id" AND "Bargains"."deletedAt" IS NULL)'
          ),
          'numberOfBidder'
        ],
        [
          models.sequelize.literal(
            '(SELECT COUNT("Likes"."id") FROM "Likes" WHERE "Likes"."carId" = "Car"."id" AND "Likes"."deletedAt" IS NULL)'
          ),
          'like'
        ],
        [
          models.sequelize.literal(
            '(SELECT COUNT("Views"."id") FROM "Views" WHERE "Views"."carId" = "Car"."id" AND "Views"."deletedAt" IS NULL)'
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
          attributes: ['id', 'name', 'email', 'phone']
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

  return models.Car.findOne({
    attributes: Object.keys(models.Car.attributes).concat([
      [
        models.sequelize.literal(
          '(SELECT COUNT("Likes"."id") FROM "Likes" WHERE "Likes"."carId" = "Car"."id" AND "Likes"."deletedAt" IS NULL)'
        ),
        'like'
      ],
      [
        models.sequelize.literal(
          '(SELECT COUNT("Views"."id") FROM "Views" WHERE "Views"."carId" = "Car"."id" AND "Views"."deletedAt" IS NULL)'
        ),
        'view'
      ],
      [
        models.sequelize.literal(
          '(SELECT COUNT("Bargains"."id") FROM "Bargains" WHERE "Bargains"."carId" = "Car"."id" AND "Bargains"."deletedAt" IS NULL)'
        ),
        'numberOfBidder'
      ],
      [
        models.sequelize.literal(
          '(SELECT MAX("Bargains"."bidAmount") FROM "Bargains" WHERE "Bargains"."carId" = "Car"."id" AND "Bargains"."deletedAt" IS NULL)'
        ),
        'highestBidder'
      ]
    ]),
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
  const { by } = req.query;
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

  const where = {
    userId: id,
    status: true
  };

  return models.Like.findAll({
    include: [
      {
        model: models.Car,
        as: 'car',
        attributes: {
          include: [
            [
              models.sequelize.literal(
                `(SELECT COUNT("Likes"."id") FROM "Likes" WHERE "Likes"."carId" = "car"."id" AND "Likes"."status" IS TRUE AND "Likes"."userId" = ${id} AND "Likes"."deletedAt" IS NULL)`
              ),
              'islike'
            ],
            [
              models.sequelize.literal(
                `(SELECT COUNT("Bargains"."id") FROM "Bargains" WHERE "Bargains"."userId" = ${id} AND "Bargains"."carId" = "car"."id" AND "Bargains"."expiredAt" >= (SELECT NOW()) AND "Bargains"."deletedAt" IS NULL)`
              ),
              'isBid'
            ],
            [
              models.sequelize.literal(
                '(SELECT COUNT("Likes"."id") FROM "Likes" WHERE "Likes"."carId" = "car"."id" AND "Likes"."deletedAt" IS NULL)'
              ),
              'like'
            ],
            [
              models.sequelize.literal(
                '(SELECT COUNT("Views"."id") FROM "Views" WHERE "Views"."carId" = "car"."id" AND "Views"."deletedAt" IS NULL)'
              ),
              'view'
            ],
            [
              models.sequelize.literal(
                '(SELECT COUNT("Bargains"."id") FROM "Bargains" WHERE "Bargains"."carId" = "car"."id" AND "Bargains"."deletedAt" IS NULL)'
              ),
              'numberOfBidder'
            ],
            [
              models.sequelize.literal(
                '(SELECT MAX("Bargains"."bidAmount") FROM "Bargains" WHERE "Bargains"."carId" = "car"."id" AND "Bargains"."deletedAt" IS NULL)'
              ),
              'highestBidder'
            ]
          ],
          exclude: ['createdAt', 'updatedAt', 'deletedAt']
        },
        include: [
          {
            model: models.ModelYear,
            as: 'modelYear',
            attributes: ['id', 'year', 'modelId']
          },
          {
            model: models.User,
            as: 'user',
            attributes: ['id', 'name', 'email', 'phone']
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
    ],
    where,
    order,
    offset,
    limit
  })
    .then(async data => {
      const count = await models.Like.count({
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

router.get('/view/:id', async (req, res) => {
  const { id } = req.params;
  const { by } = req.query;
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

  const where = {
    userId: id,
    id: {
      [Op.in]: models.sequelize.literal(`(SELECT "id"
        FROM (
          SELECT *, row_number() OVER (
            partition BY "carId" 
            ORDER BY "id"
          ) AS row_number
          FROM "Views" 
          WHERE "userId" = ${id}
          AND "deletedAt" IS NULL
        ) AS rows
        WHERE row_number = 1)`
      )
    }
  };

  return models.View.findAll({
    include: [
      {
        model: models.Car,
        as: 'car',
        attributes: {
          include: [
            [
              models.sequelize.literal(
                `(SELECT COUNT("Likes"."id") FROM "Likes" WHERE "Likes"."carId" = "car"."id" AND "Likes"."status" IS TRUE AND "Likes"."userId" = ${id} AND "Likes"."deletedAt" IS NULL)`
              ),
              'islike'
            ],
            [
              models.sequelize.literal(
                `(SELECT COUNT("Bargains"."id") FROM "Bargains" WHERE "Bargains"."userId" = ${id} AND "Bargains"."carId" = "car"."id" AND "Bargains"."expiredAt" >= (SELECT NOW()) AND "Bargains"."deletedAt" IS NULL)`
              ),
              'isBid'
            ],
            [
              models.sequelize.literal(
                '(SELECT COUNT("Likes"."id") FROM "Likes" WHERE "Likes"."carId" = "car"."id" AND "Likes"."deletedAt" IS NULL)'
              ),
              'like'
            ],
            [
              models.sequelize.literal(
                '(SELECT COUNT("Views"."id") FROM "Views" WHERE "Views"."carId" = "car"."id" AND "Views"."deletedAt" IS NULL)'
              ),
              'view'
            ],
            [
              models.sequelize.literal(
                '(SELECT COUNT("Bargains"."id") FROM "Bargains" WHERE "Bargains"."carId" = "car"."id" AND "Bargains"."deletedAt" IS NULL)'
              ),
              'numberOfBidder'
            ],
            [
              models.sequelize.literal(
                '(SELECT MAX("Bargains"."bidAmount") FROM "Bargains" WHERE "Bargains"."carId" = "car"."id" AND "Bargains"."deletedAt" IS NULL)'
              ),
              'highestBidder'
            ]
          ],
          exclude: ['createdAt', 'updatedAt', 'deletedAt']
        },
        include: [
          {
            model: models.ModelYear,
            as: 'modelYear',
            attributes: ['id', 'year', 'modelId']
          },
          {
            model: models.User,
            as: 'user',
            attributes: ['id', 'name', 'email', 'phone']
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
    ],
    where,
    order,
    offset,
    limit
  })
    .then(async data => {
      const count = await models.View.count({
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
    status
  } = req.body;
  const { interior, exterior, day, startTime, endTime } = req.body;
  const { images } = req.files;

  if (!userId) {
    return res.status(400).json({
      success: false,
      errors: 'user is mandatory'
    });
  }
  if (!brandId) {
    return res.status(400).json({
      success: false,
      errors: 'brand is mandatory'
    });
  }

  if (!groupModelId) {
    return res.status(400).json({
      success: false,
      errors: 'groupModel is mandatory'
    });
  }

  if (!modelId) {
    return res.status(400).json({
      success: false,
      errors: 'model is mandatory'
    });
  }

  if (!modelYearId) {
    return res.status(400).json({
      success: false,
      errors: 'model year is mandatory'
    });
  }

  if (!location) {
    return res.status(400).json({
      success: false,
      errors: 'location is mandatory'
    });
  }

  let STNKphoto = null;
  if (images) {
    const result = {};
    const tname = randomize('0', 4);
    result.name = `djublee/images/clientCompany/${tname}${moment().format('x')}${unescape(
      images[0].originalname
    ).replace(/\s/g, '')}`;
    result.mimetype = images[0].mimetype;
    result.data = images[0].buffer;
    STNKphoto = result.name;
    imageHelper.uploadToS3(result);
  }

  const trans = await models.sequelize.transaction();
  const errors = [];

  const data = await models.Car.create(
    {
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
      status
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

  return res.json({
    success: true,
    data
  });
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

  // const user = await models.View.findOne({
  //   where: {
  //     userId: req.user.id
  //   }
  // });
  // if (user) {
  //   return res.status(422).json({
  //     success: false,
  //     errors: 'user has already viewed this car'
  //   });
  // }

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

// router get list car by like
router.get('/viewLike', async (req, res) => {
  let { page, limit, sort } = req.query;
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
            AND "Likes"."deletedAt" IS NULL
          ) > 0 
        )`)
    ]
  };

  return models.Car.findAll({
    attributes: Object.keys(models.Car.attributes).concat([
      [
        models.sequelize.literal(
          '(SELECT "Brands"."name" FROM "Brands" WHERE "Brands"."id" = "Car"."brandId" AND "Brands"."deletedAt" IS NULL)'
        ),
        'Brands'
      ],
      [
        models.sequelize.literal(
          '(SELECT "Models"."name" FROM "Models" WHERE "Models"."id" = "Car"."modelId" AND "Models"."deletedAt" IS NULL)'
        ),
        'Model'
      ],
      [
        models.sequelize.literal(
          '(SELECT COUNT("Likes"."carId") FROM "Likes" WHERE "Likes"."carId" = "Car"."id" AND "Likes"."deletedAt" IS NULL)'
        ),
        'jumlahLike'
      ],
      [
        models.sequelize.literal(
          '(SELECT COUNT("Views"."carId") FROM "Views" WHERE "Views"."carId" = "Car"."id" AND "Views"."deletedAt" IS NULL)'
        ),
        'jumlahView'
      ],
      [
        models.sequelize.literal(
          '(SELECT MAX("Bargains"."bidAmount") FROM "Bargains" WHERE "Bargains"."carId" = "Car"."id" AND "Bargains"."deletedAt" IS NULL)'
        ),
        'highestBidder'
      ],
      [
        models.sequelize.literal(
          '(SELECT COUNT("Bargains"."id") FROM "Bargains" WHERE "Bargains"."carId" = "Car"."id" AND "Bargains"."deletedAt" IS NULL)'
        ),
        'numberOfBidder'
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
});

// router get list car by like(Login)
router.get('/viewLikeLogon', passport.authenticate('user', { session: false }), async (req, res) => {
  let { page, limit, sort } = req.query;
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
            AND "Likes"."deletedAt" IS NULL
          ) > 0 
        )`)
    ]
  };

  return models.Car.findAll({
    attributes: Object.keys(models.Car.attributes).concat([
      [
        models.sequelize.literal(
          `(SELECT COUNT("Likes"."id") FROM "Likes" WHERE "Likes"."carId" = "Car"."id" AND "Likes"."status" IS TRUE AND "Likes"."userId" = ${userId} AND "Likes"."deletedAt" IS NULL)`
        ),
        'islike'
      ],
      [
        models.sequelize.literal(
          `(SELECT COUNT("Bargains"."id") FROM "Bargains" WHERE "Bargains"."userId" = ${userId} AND "Bargains"."carId" = "Car"."id" AND "Bargains"."expiredAt" >= (SELECT NOW()) AND "Bargains"."deletedAt" IS NULL)`
        ),
        'isBid'
      ],
      [
        models.sequelize.literal(
          '(SELECT "Brands"."name" FROM "Brands" WHERE "Brands"."id" = "Car"."brandId" AND "Brands"."deletedAt" IS NULL)'
        ),
        'Brands'
      ],
      [
        models.sequelize.literal(
          '(SELECT "Models"."name" FROM "Models" WHERE "Models"."id" = "Car"."modelId" AND "Models"."deletedAt" IS NULL)'
        ),
        'Model'
      ],
      [
        models.sequelize.literal(
          '(SELECT COUNT("Likes"."carId") FROM "Likes" WHERE "Likes"."carId" = "Car"."id" AND "Likes"."deletedAt" IS NULL)'
        ),
        'jumlahLike'
      ],
      [
        models.sequelize.literal(
          '(SELECT COUNT("Views"."carId") FROM "Views" WHERE "Views"."carId" = "Car"."id" AND "Views"."deletedAt" IS NULL)'
        ),
        'jumlahView'
      ],
      [
        models.sequelize.literal(
          '(SELECT MAX("Bargains"."bidAmount") FROM "Bargains" WHERE "Bargains"."carId" = "Car"."id" AND "Bargains"."deletedAt" IS NULL)'
        ),
        'highestBidder'
      ],
      [
        models.sequelize.literal(
          '(SELECT COUNT("Bargains"."id") FROM "Bargains" WHERE "Bargains"."carId" = "Car"."id" AND "Bargains"."deletedAt" IS NULL)'
        ),
        'numberOfBidder'
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
});

module.exports = router;
