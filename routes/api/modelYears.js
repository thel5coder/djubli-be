/* eslint-disable linebreak-style */
const express = require('express');
const validator = require('validator');
const Sequelize = require('sequelize');
const passport = require('passport');
const models = require('../../db/models');
const paginator = require('../../helpers/paginator');

const { Op } = Sequelize;
const router = express.Router();

const DEFAULT_LIMIT = process.env.DEFAULT_LIMIT || 10;
const MAX_LIMIT = process.env.MAX_LIMIT || 50;

router.get('/', async (req, res) => {
  let { page, limit, sort } = req.query;
  const { modelId } = req.query;
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
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

  return models.ModelYear.findAll({
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

router.get('/listingAll', async (req, res) => {
  const { by, condition } = req.query;
  let { page, limit, sort } = req.query;
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  let order = [['createdAt', 'desc']];
  if (!sort) sort = 'asc';
  else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';

  if (by === 'year' || by === 'id') order = [[by, sort]];
  else if (by === 'numberOfCar') order = [[models.sequelize.col('numberOfCar'), sort]];
  else if (by === 'highestBidder') order = [[models.sequelize.col('highestBidder'), sort]];

  const where = {};
  const whereInclude = {};

  if (condition) {
    Object.assign(whereInclude, {
      condition: {
        [Op.eq]: condition
      }
    });
  }

  return models.ModelYear.findAll({
    attributes: Object.keys(models.ModelYear.attributes).concat([
      [
        models.sequelize.literal(
          '(SELECT MAX("Cars"."price") FROM "Cars" WHERE "Cars"."modelYearId" = "ModelYear"."id" AND "Cars"."deletedAt" IS NULL)'
        ),
        'maxPrice'
      ],
      [
        models.sequelize.literal(
          '(SELECT MIN("Cars"."price") FROM "Cars" WHERE "Cars"."modelYearId" = "ModelYear"."id" AND "Cars"."deletedAt" IS NULL)'
        ),
        'minPrice'
      ],
      [
        models.sequelize.literal(
          '(SELECT COUNT("Cars"."id") FROM "Cars" WHERE "Cars"."modelYearId" = "ModelYear"."id" AND "Cars"."deletedAt" IS NULL)'
        ),
        'numberOfCar'
      ],
      [
        models.sequelize.literal(
          '(SELECT COUNT("Bargains"."id") FROM "Bargains" LEFT JOIN "Cars" ON "Bargains"."carId" = "Cars"."id" WHERE "Cars"."modelYearId" = "ModelYear"."id")'
        ),
        'numberOfBidder'
      ],
      [
        models.sequelize.literal(
          '(SELECT MAX("Bargains"."bidAmount") FROM "Bargains" LEFT JOIN "Cars" ON "Bargains"."carId" = "Cars"."id" WHERE "Cars"."modelYearId" = "ModelYear"."id")'
        ),
        'highestBidder'
      ]
    ]),
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
        where: whereInclude,
        order: [['bidAmount', 'desc']],
        attributes: {
          exclude: ['createdAt', 'updatedAt', 'deletedAt']
        },
        attributes: Object.keys(models.Car.attributes).concat([
          [
            models.sequelize.literal(
              '(SELECT MAX("Bargains"."bidAmount") FROM "Bargains" WHERE "Bargains"."carId" = "car"."id")'
            ),
            'bidAmount'
          ]
        ]),
        include: [
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
        // attributes: ['condition']
      }
    ],
    where,
    order,
    offset,
    limit
  })
    .then(async data => {
      const count = await models.ModelYear.count({
        include: [
          {
            model: models.Car,
            as: 'car',
            where: whereInclude
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

router.get('/listingCar/:id', async (req, res) => {
  const { by, year, maxPrice, minPrice, condition } = req.query;
  const { id } = req.params;
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
    modelYearId: id
  };

  const inludeWhere = {};

  if (year) {
    Object.assign(inludeWhere, {
      year: {
        [Op.eq]: year
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

  if (maxPrice && minPrice) {
    Object.assign(where, {
      price: {
        [Op.and]: [{ [Op.lte]: maxPrice }, { [Op.gte]: minPrice }]
      }
    });
  }

  return models.Car.findAll({
    attributes: Object.keys(models.Car.attributes).concat([
      [
        models.sequelize.literal(
          '(SELECT COUNT("Likes"."id") FROM "Likes" WHERE "Likes"."carId" = "Car"."id" AND "Likes"."status" IS TRUE)'
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
        model: models.ModelYear,
        as: 'modelYear',
        where: inludeWhere,
        include: [
          {
            model: models.Model,
            as: 'model',
            attributes: ['name'],
            include: [
              {
                model: models.GroupModel,
                as: 'groupModel',
                attributes: ['name'],
                include: [
                  {
                    model: models.Brand,
                    as: 'brand',
                    attributes: ['name']
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        model: models.User,
        as: 'user',
        attributes: ['name', 'type', 'companyType']
      },
      {
        model: models.Color,
        as: 'interiorColor',
        attributes: ['name']
      },
      {
        model: models.Color,
        as: 'exteriorColor',
        attributes: ['name']
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
            where: inludeWhere
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
  '/listingCarLogon/:id',
  passport.authenticate('user', { session: false }),
  async (req, res) => {
    const { by, year, maxPrice, minPrice, condition } = req.query;
    const { id } = req.params;
    const userId = await req.user.id;
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
      modelYearId: id
    };

    const inludeWhere = {};

    if (year) {
      Object.assign(inludeWhere, {
        year: {
          [Op.eq]: year
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

    if (maxPrice && minPrice) {
      Object.assign(where, {
        price: {
          [Op.and]: [{ [Op.lte]: maxPrice }, { [Op.gte]: minPrice }]
        }
      });
    }

    return models.Car.findAll({
      attributes: Object.keys(models.Car.attributes).concat([
        [
          models.sequelize.literal(
            `(SELECT COUNT("Likes"."id") FROM "Likes" WHERE "Likes"."carId" = "Car"."id" AND "Likes"."status" IS TRUE AND "Likes"."userId" = ${userId})`
          ),
          'islike'
        ],
        [
          models.sequelize.literal(
            '(SELECT COUNT("Likes"."id") FROM "Likes" WHERE "Likes"."carId" = "Car"."id" AND "Likes"."status" IS TRUE)'
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
          model: models.ModelYear,
          as: 'modelYear',
          where: inludeWhere,
          include: [
            {
              model: models.Model,
              as: 'model',
              attributes: ['name'],
              include: [
                {
                  model: models.GroupModel,
                  as: 'groupModel',
                  attributes: ['name'],
                  include: [
                    {
                      model: models.Brand,
                      as: 'brand',
                      attributes: ['name']
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          model: models.User,
          as: 'user',
          attributes: ['name']
        },
        {
          model: models.Color,
          as: 'interiorColor',
          attributes: ['name']
        },
        {
          model: models.Color,
          as: 'exteriorColor',
          attributes: ['name']
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
              where: inludeWhere
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

router.get('/luxuryCar', async (req, res) => {
  const { minPrice, maxPrice, condition } = req.query;
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

  if (by === 'year' || by === 'id') order = [[by, sort]];
  else if (by === 'numberOfCar') order = [[models.sequelize.col('numberOfCar'), sort]];

  const where = {};

  const whereInclude = {};
  if (minPrice && maxPrice) {
    Object.assign(where, {
      price: {
        [Op.and]: [{ [Op.gte]: minPrice }, { [Op.lte]: maxPrice }]
      }
    });
  }

  if (condition) {
    Object.assign(whereInclude, {
      condition: {
        [Op.eq]: condition
      }
    });
  }

  return models.ModelYear.findAll({
    attributes: Object.keys(models.ModelYear.attributes).concat([
      [
        models.sequelize.literal(
          `(SELECT COUNT("Bargains"."id") FROM "Bargains" LEFT JOIN "Cars" ON "Bargains"."carId" = "Cars"."id" WHERE "Cars"."modelYearId" = "ModelYear"."id" AND "ModelYear"."price" >= ${minPrice} AND "ModelYear"."price" <= ${maxPrice})`
        ),
        'numberOfBidder'
      ],
      [
        models.sequelize.literal(
          `(SELECT MAX("Bargains"."bidAmount") FROM "Bargains" LEFT JOIN "Cars" ON "Bargains"."carId" = "Cars"."id" WHERE "Cars"."modelYearId" = "ModelYear"."id" AND "ModelYear"."price" >= ${minPrice} AND "ModelYear"."price" <= ${maxPrice})`
        ),
        'highestBidder'
      ],
      [
        models.sequelize.literal(
          `(SELECT COUNT("Cars"."id") FROM "Cars" WHERE "Cars"."modelYearId" = "ModelYear"."id" AND "ModelYear"."price" >= ${minPrice} AND "ModelYear"."price" <= ${maxPrice} AND "Cars"."deletedAt" IS NULL)`
        ),
        'numberOfCar'
      ],
      [
        models.sequelize.literal(
          `(SELECT MAX("Cars"."price") FROM "Cars" WHERE "Cars"."modelYearId" = "ModelYear"."id" AND "ModelYear"."price" >= ${minPrice} AND "ModelYear"."price" <= ${maxPrice} AND "Cars"."deletedAt" IS NULL)`
        ),
        'maxPrice'
      ],
      [
        models.sequelize.literal(
          `(SELECT MIN("Cars"."price") FROM "Cars" WHERE "Cars"."modelYearId" = "ModelYear"."id" AND "ModelYear"."price" >= ${minPrice} AND "ModelYear"."price" <= ${maxPrice} AND "Cars"."deletedAt" IS NULL)`
        ),
        'minPrice'
      ]
    ]),
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
      }
    ],
    where,
    order,
    offset,
    limit
  })
    .then(async data => {
      const count = await models.ModelYear.count({
        include: [
          {
            model: models.Car,
            as: 'car',
            where: whereInclude
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

module.exports = router;
