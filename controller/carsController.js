const validator = require('validator');
const Sequelize = require('sequelize');
const models = require('../db/models');
const paginator = require('../helpers/paginator');

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
    'like'
  ];
  if (array.indexOf(by) < 0) by = 'createdAt';
  sort = ['asc', 'desc'].indexOf(sort) < 0 ? 'asc' : sort;
  const fieldArr = ['view', 'like'];
  const order = by == fieldArr.indexOf(by) < 0 ? [[by, sort]] : [[Sequelize.col(by), sort]];

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

    let distances = models.sequelize.literal(
      `(SELECT calculate_distance(${latitude}, ${longitude}, (SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude"), (SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude"), 'K'))`
    );
    Object.assign(where, {
      [Op.and]: [models.sequelize.where(distances, { [Op.lte]: radius })]
    });
  }

  const customFields = [
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
    ]
  ];
  if (auth) {
    const userId = req.user.id;
    customFields.push(
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
    );
  }

  return models.Car.findAll({
    attributes: Object.keys(models.Car.attributes).concat(customFields),
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

async function getCategory(req, res) {
  let { page, limit, by, sort } = req.query;
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  if (!by) by = 'id';
  const array = ['id', 'name', 'desctiption', 'createdAt'];
  if (array.indexOf(by) < 0) by = 'createdAt';
  sort = ['asc', 'desc'].indexOf(sort) < 0 ? 'asc' : sort;
  const order = [[Sequelize.col(by), sort]];
  const where = {};

  return models.CarCategory.findAll({
    attributes: {
      exclude: ['deletedAt']
    },
    where,
    order,
    offset,
    limit
  })
    .then(async data => {
      const count = await models.CarCategory.count({
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

async function editCategory(req, res) {
  const { id } = req.params;
  const { name, description } = req.body;
  const update = {};

  if (name) Object.assign(update, { name });
  if (description) Object.assign(update, { description });

  const categoryExists = await models.CarCategory.findByPk(id);
  if (!categoryExists)
    return res.status(404).json({ success: false, errors: 'category not found' });

  if (Object.keys(update).length < 1)
    return res.status(422).json({ success: false, errors: 'invalid parameter' });

  // return res.json({
  //   success: true,
  //   data: { message: 'parameter oke', update }
  // });
  return categoryExists
    .update(update)
    .then(async data => {
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

async function getCategoryById(req, res) {
  const { id } = req.params;

  const categoryExists = await models.CarCategory.findByPk(id);
  if (!categoryExists)
    return res.status(404).json({ success: false, errors: 'category not found' });

  return res.json({
    success: true,
    data: categoryExists
  });
}

async function addCategory(req, res) {
  const { name, description } = req.body;
  const create = {};

  if (name) Object.assign(create, { name });
  if (description) Object.assign(create, { description });

  if (Object.keys(create).length < 2)
    return res.status(422).json({ success: false, errors: 'invalid parameter' });

  // return res.json({
  //   success: true,
  //   data: { message: 'parameter oke', create }
  // });
  return models.CarCategory.create(create)
    .then(async data => {
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

async function delCategory(req, res) {
  const { id } = req.params;

  const categoryExists = await models.CarCategory.findByPk(id);
  if (!categoryExists)
    return res.status(404).json({ success: false, errors: 'category not found' });

  return categoryExists
    .destroy(id)
    .then(async data => {
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

module.exports = {
  carsGet,
  getCategory,
  editCategory,
  getCategoryById,
  addCategory,
  delCategory
};
