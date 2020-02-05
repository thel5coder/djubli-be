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
    radius,
    latitude,
    longitude,
    cityId,
    subdistrictId,
    typeId
  } = req.query;

  let { page, limit, sort } = req.query;
  let offset = 0;
  const countDataPage = 0;
  let distances = {};

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  let order = [['createdAt', 'desc']];
  let subQuery = true;

  if (!sort) sort = 'asc';
  else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';

  if (by === 'year' || by === 'id') order = [[by, sort]];
  else if (by === 'numberOfCar') order = [[models.sequelize.col('numberOfCar'), sort]];
  else if (by === 'highestBidder') order = [[models.sequelize.col('highestBidder'), sort]];
  else if (by === 'like') {
    subQuery = false;
    order = [[models.sequelize.literal('"car.like"'), sort]];
  } else if (by === 'condition')
    order = [[{ model: models.Car, as: 'car' }, models.sequelize.col('condition'), sort]];
  else if (by === 'price')
    order = [[{ model: models.Car, as: 'car' }, models.sequelize.col('price'), sort]];
  else if (by === 'listingDate')
    order = [
      [models.sequelize.col('createdAt'), sort],
      [{ model: models.Car, as: 'car' }, models.sequelize.col('createdAt'), sort]
    ];
  else if (by === 'km')
    order = [[{ model: models.Car, as: 'car' }, models.sequelize.col('km'), sort]];
  else if (by === 'roleUser')
    order = [
      [
        { model: models.Car, as: 'car' },
        { model: models.User, as: 'user' },
        models.sequelize.col('type'),
        sort
      ],
      [
        { model: models.Car, as: 'car' },
        { model: models.User, as: 'user' },
        models.sequelize.col('companyType'),
        sort
      ]
    ];
  else if (by === 'location')
    distances = Sequelize.literal(
      `(SELECT calculate_distance(${latitude}, ${longitude}, (SELECT CAST(COALESCE(NULLIF((SELECT split_part("car"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude"), (SELECT CAST(COALESCE(NULLIF((SELECT split_part("car"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude"), 'K'))`
    );

  // Search by City, Subdistrict/Area & Radius
  if (by === 'area') {
    if (cityId) {
      const city = await models.City.findByPk(cityId);
      if (!city) {
        return res.status(400).json({
          success: false,
          errors: 'City not found!'
        });
      }

      // If subdistrictId Not Null
      if (subdistrictId) {
        const subdistrict = await models.SubDistrict.findOne({
          where: { id: subdistrictId, cityId }
        });

        if (!subdistrict) {
          return res.status(400).json({
            success: false,
            errors: 'Subdistrict not found!'
          });
        }

        if (city && subdistrict) {
          distances = Sequelize.literal(
            `(SELECT calculate_distance(${subdistrict.latitude}, ${subdistrict.longitude}, (SELECT CAST(COALESCE(NULLIF((SELECT split_part("car"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude"), (SELECT CAST(COALESCE(NULLIF((SELECT split_part("car"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude"), 'K'))`
          );
        }
      } else {
        // If subdistrictId Null (Search By City & Radius)
        // eslint-disable-next-line no-lonely-if
        if (city) {
          distances = Sequelize.literal(
            `(SELECT calculate_distance(${city.latitude}, ${city.longitude}, (SELECT CAST(COALESCE(NULLIF((SELECT split_part("car"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude"), (SELECT CAST(COALESCE(NULLIF((SELECT split_part("car"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude"), 'K'))`
          );
        }
      }
    } else {
      return res.status(400).json({
        success: false,
        errors: 'Please Select City!'
      });
    }
  }

  const where = {};

  if (minYear && maxYear) {
    Object.assign(where, {
      year: {
        [Op.and]: [{ [Op.gte]: minYear }, { [Op.lte]: maxYear }]
      }
    });
  }

  const whereInclude = { [Op.or]: [{ status: 0 }, { status: 1 }] };
  if (condition) {
    Object.assign(whereInclude, {
      condition: {
        [Op.eq]: condition
      }
    });
  }

  if (brandId) {
    Object.assign(whereInclude, {
      brandId: {
        [Op.eq]: brandId
      }
    });
  }

  if (modelId) {
    Object.assign(whereInclude, {
      modelId: {
        [Op.eq]: modelId
      }
    });
  }

  if (groupModelId) {
    Object.assign(whereInclude, {
      groupModelId: {
        [Op.eq]: groupModelId
      }
    });
  }

  if (minPrice && maxPrice) {
    Object.assign(whereInclude, {
      price: {
        [Op.and]: [{ [Op.gte]: minPrice }, { [Op.lte]: maxPrice }]
      }
    });
  }

  if (by === 'highestBidder') {
    Object.assign(whereInclude, {
      id: {
        [Op.eq]: models.sequelize.literal(
          '(SELECT "Bargains"."carId" FROM "Bargains" LEFT JOIN "Cars" ON "Bargains"."carId" = "Cars"."id" WHERE "Cars"."modelYearId" = "ModelYear"."id" ORDER BY "Bargains"."bidAmount" DESC LIMIT 1)'
        )
      }
    });
  }

  if (by === 'location' || by === 'area') {
    Object.assign(whereInclude, {
      [Op.and]: [Sequelize.where(distances, { [Op.lte]: radius })]
    });
  }

  if (typeId) {
    Object.assign(whereInclude, {
      [Op.and]: models.sequelize.literal(`EXISTS(SELECT "GroupModels"."typeId" FROM "GroupModels" WHERE "GroupModels"."id" = "car"."groupModelId" AND "GroupModels"."typeId" = ${typeId})`)
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
          '(SELECT COUNT("Cars"."id") FROM "Cars" WHERE "Cars"."modelYearId" = "ModelYear"."id" AND "Cars"."deletedAt" IS NULL AND ("Cars"."status" = 0 OR "Cars"."status" = 1))'
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
      ],
      [
        models.sequelize.literal(
          '(SELECT "Bargains"."carId" FROM "Bargains" LEFT JOIN "Cars" ON "Bargains"."carId" = "Cars"."id" WHERE "Cars"."modelYearId" = "ModelYear"."id" ORDER BY "Bargains"."bidAmount" DESC LIMIT 1)'
        ),
        'highestBidderCarId'
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
        attributes: {
          include: [
            [
              models.sequelize.literal(
                '(SELECT MAX("Bargains"."bidAmount") FROM "Bargains" WHERE "Bargains"."carId" = "car"."id")'
              ),
              'bidAmount'
            ],
            [
              models.sequelize.literal(
                '(SELECT COUNT("Bargains"."id") FROM "Bargains" WHERE "Bargains"."carId" = "car"."id")'
              ),
              'numberOfBidder'
            ],
            [
              Sequelize.literal(
                '(SELECT COUNT("Likes"."id") FROM "Likes" WHERE "Likes"."carId" = "car"."id" AND "Likes"."status" IS TRUE)'
              ),
              'like'
            ],
            [
              models.sequelize.literal(
                '(SELECT COUNT("Views"."id") FROM "Views" WHERE "Views"."carId" = "car"."id" AND "Views"."deletedAt" IS NULL)'
              ),
              'view'
            ],
            // [
            //   models.sequelize.literal(
            //     '(SELECT "GroupModels"."name" FROM "GroupModels" WHERE "GroupModels"."id" = "car"."groupModelId")'
            //   ),
            //   'groupModelName'
            // ],
            [
              models.sequelize.literal(
                '(SELECT "GroupModels"."typeId" FROM "GroupModels" WHERE "GroupModels"."id" = "car"."groupModelId")'
              ),
              'groupModelTypeId'
            ],
            [models.sequelize.literal(`(SELECT split_part("car"."location", ',', 1))`), 'latitude'],
            [models.sequelize.literal(`(SELECT split_part("car"."location", ',', 2))`), 'longitude']
          ]
        },
        include: [
          {
            model: models.User,
            as: 'user',
            attributes: ['name', 'type', 'companyType']
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
        ]
      }
    ],
    where,
    order,
    offset,
    limit,
    // subQuery
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
                attributes: {
                  exclude: ['createdAt', 'updatedAt', 'deletedAt']
                }
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
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
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

  const whereInclude = { [Op.or]: [{ status: 0 }, { status: 1 }] };
  if (condition) {
    Object.assign(whereInclude, {
      condition: {
        [Op.eq]: condition
      }
    });
  }

  if (brandId) {
    Object.assign(whereInclude, {
      brandId: {
        [Op.eq]: brandId
      }
    });
  }

  if (modelId) {
    Object.assign(whereInclude, {
      modelId: {
        [Op.eq]: modelId
      }
    });
  }

  if (groupModelId) {
    Object.assign(whereInclude, {
      groupModelId: {
        [Op.eq]: groupModelId
      }
    });
  }

  if (minPrice && maxPrice) {
    Object.assign(whereInclude, {
      price: {
        [Op.and]: [{ [Op.gte]: minPrice }, { [Op.lte]: maxPrice }]
      }
    });
  }

  const whereModelGroup = {};
  if (typeId) {
    Object.assign(whereModelGroup, {
      typeId
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
          '(SELECT COUNT("Cars"."id") FROM "Cars" WHERE "Cars"."modelYearId" = "ModelYear"."id" AND "Cars"."deletedAt" IS NULL AND ("Cars"."status" = 0 OR "Cars"."status" = 1))'
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
      ],
      [
        models.sequelize.literal(
          '(SELECT "Bargains"."carId" FROM "Bargains" LEFT JOIN "Cars" ON "Bargains"."carId" = "Cars"."id" WHERE "Cars"."modelYearId" = "ModelYear"."id" ORDER BY "Bargains"."bidAmount" DESC LIMIT 1)'
        ),
        'highestBidderCarId'
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
        attributes: {
          include: [
            [
              models.sequelize.literal(
                '(SELECT MAX("Bargains"."bidAmount") FROM "Bargains" WHERE "Bargains"."carId" = "car"."id")'
              ),
              'bidAmount'
            ],
            [
              models.sequelize.literal(
                '(SELECT COUNT("Bargains"."id") FROM "Bargains" WHERE "Bargains"."carId" = "car"."id")'
              ),
              'numberOfBidder'
            ],
            [
              Sequelize.literal(
                '(SELECT COUNT("Likes"."id") FROM "Likes" WHERE "Likes"."carId" = "car"."id" AND "Likes"."status" IS TRUE)'
              ),
              'like'
            ],
            [
              models.sequelize.literal(
                '(SELECT COUNT("Views"."id") FROM "Views" WHERE "Views"."carId" = "car"."id" AND "Views"."deletedAt" IS NULL)'
              ),
              'view'
            ],
            [models.sequelize.literal(`(SELECT split_part("car"."location", ',', 1))`), 'latitude'],
            [models.sequelize.literal(`(SELECT split_part("car"."location", ',', 2))`), 'longitude']
          ]
        },
        include: [
          {
            model: models.User,
            as: 'user',
            attributes: ['name', 'type', 'companyType']
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
            where: whereModelGroup,
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
    where,
    order,
    offset
    // limit
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

  if (by === 'price' || by === 'id' || by === 'km' || by === 'condition') order = [[by, sort]];
  else if (by === 'like') order = [[models.sequelize.col('like'), sort]];
  else if (by === 'userType')
    order = [[{ model: models.User, as: 'user' }, models.sequelize.col('type'), sort]];

  const where = {
    [Op.or]: [{ status: 0 }, { status: 1 }],
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

    if (by === 'price' || by === 'id' || by === 'km' || by === 'condition') order = [[by, sort]];
    else if (by === 'like') order = [[models.sequelize.col('like'), sort]];
    else if (by === 'userType')
      order = [[{ model: models.User, as: 'user' }, models.sequelize.col('type'), sort]];

    const where = {
      [Op.or]: [{ status: 0 }, { status: 1 }],
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

  const whereInclude = {
    [Op.or]: [{ status: 0 }, { status: 1 }]
  };
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

  Object.assign(whereInclude, {
    id: {
      [Op.eq]: models.sequelize.literal(
        '(SELECT "Bargains"."carId" FROM "Bargains" LEFT JOIN "Cars" ON "Bargains"."carId" = "Cars"."id" WHERE "Cars"."modelYearId" = "ModelYear"."id" ORDER BY "Bargains"."bidAmount" DESC LIMIT 1)'
      )
    }
  });

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
          `(SELECT COUNT("Cars"."id") FROM "Cars" WHERE "Cars"."modelYearId" = "ModelYear"."id" AND "ModelYear"."price" >= ${minPrice} AND "ModelYear"."price" <= ${maxPrice} AND "Cars"."deletedAt" IS NULL AND ("Cars"."status" = 0 OR "Cars"."status" = 1))`
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
      },
      {
        model: models.Car,
        as: 'car',
        where: whereInclude,
        order: [['bidAmount', 'desc']],
        attributes: Object.keys(models.Car.attributes).concat([
          [
            models.sequelize.literal(
              '(SELECT MAX("Bargains"."bidAmount") FROM "Bargains" WHERE "Bargains"."carId" = "car"."id")'
            ),
            'bidAmount'
          ],
          [
            models.sequelize.literal(
              '(SELECT COUNT("Bargains"."id") FROM "Bargains" WHERE "Bargains"."carId" = "car"."id")'
            ),
            'numberOfBidder'
          ],
          [
            models.sequelize.literal(
              '(SELECT COUNT("Likes"."id") FROM "Likes" WHERE "Likes"."carId" = "car"."id" AND "Likes"."status" IS TRUE)'
            ),
            'like'
          ],
          [
            models.sequelize.literal(
              '(SELECT COUNT("Views"."id") FROM "Views" WHERE "Views"."carId" = "car"."id" AND "Views"."deletedAt" IS NULL)'
            ),
            'view'
          ]
        ]),
        include: [
          {
            model: models.User,
            as: 'user',
            attributes: ['name', 'type', 'companyType']
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

module.exports = router;
