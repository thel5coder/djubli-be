const validator = require('validator');
const Sequelize = require('sequelize');
const models = require('../db/models');
const paginator = require('../helpers/paginator');
const calculateDistance = require('../helpers/calculateDistance');
const carHelper = require('../helpers/car');

const { Op } = Sequelize;

const DEFAULT_LIMIT = process.env.DEFAULT_LIMIT || 10;
const MAX_LIMIT = process.env.MAX_LIMIT || 50;

async function carsGet(req, res, auth = false) {
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
    radius,
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
  const array = [
    'id',
    'userId',
    'brandId',
    'modelId',
    'groupModelId',
    'modelYearId',
    'exteriorColorId',
    'interiorColorId',
    'price',
    'condition',
    'usedFrom',
    'frameNumber',
    'engineNumber',
    'STNKnumber',
    'STNKphoto',
    'location',
    'status',
    'km',
    'createdAt',
    'view',
    'like',
    'profile',
    'area'
  ];
  if (array.indexOf(by) < 0) by = 'createdAt';
  sort = ['asc', 'desc'].indexOf(sort) < 0 ? 'asc' : sort;
  const order = [];
  switch (by) {
    case 'view':
    case 'like':
      order.push([Sequelize.col(by), sort]);
      break;
    case 'area':
      order.push([Sequelize.col(`distance`), sort]);
      break;
    case 'profile':
      order.push([{ model: models.User, as: 'user' }, 'type', sort]);
      break;
    default:
      order.push([by, sort]);
      break;
  }

  const userId = auth ? req.user.id : null;
  const addAttributes = {
    fields: [
      'like',
      'islike',
      'isBid',
      'view',
      'highestBidder',
      'numberOfBidder',
      'sumBargains',
      'bidAmount'
    ],
    upperCase: true,
    id: userId
  };
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

    await calculateDistance.CreateOrReplaceCalculateDistance();
    let distances = models.sequelize.literal(
      `(SELECT calculate_distance(${latitude}, ${longitude}, (SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude"), (SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude"), 'K'))`
    );
    Object.assign(where, {
      [Op.and]: [models.sequelize.where(distances, { [Op.lte]: radius })]
    });
  }

  if (by === 'area') {
    if (!latitude) return res.status(400).json({ success: false, errors: 'Latitude not found!' });
    if (!longitude) return res.status(400).json({ success: false, errors: 'Longitude not found!' });
    if (!radius) return res.status(422).json({ success: false, errors: 'invalid radius' });

    await calculateDistance.CreateOrReplaceCalculateDistance();
    const distances = Sequelize.literal(
      `(SELECT calculate_distance(${latitude}, ${longitude}, (SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude"), (SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude"), 'K'))`
    );

    Object.assign(where, {
      where: {
        [Op.and]: [Sequelize.where(distances, { [Op.lte]: Number(radius) })]
      }
    });

    addAttributes.fields.push('distance');
    Object.assign(addAttributes, {
      latitude,
      longitude
    });
  }
  const addAttribute = await carHelper.customFields(addAttributes);

  return models.Car.findAll({
    attributes: Object.keys(models.Car.attributes).concat(addAttribute),
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
        include: [
          {
            model: models.File,
            as: 'file'
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
            as: 'file'
          }
        ]
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

module.exports = {
  carsGet
};
