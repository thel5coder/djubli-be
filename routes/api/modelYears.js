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

router.get('/listingAll', async (req, res) => {
  const {
    by,
    condition,
    brandId,
    groupModelId,
    modelId,
    minPrice,
    maxPrice,
    minKm,
    maxKm,
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
  let rawDistances = '';

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  let order = [['createdAt', 'desc']];
  let orderCar = [];

  let separate = false;
  let modelCarName = 'car';

  if (!sort) sort = 'asc';
  else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';

  if (by === 'year' || by === 'id') order = [[by, sort]];
  else if (by === 'numberOfCar') order = [[models.sequelize.col('numberOfCar'), sort]];
  else if (by === 'highestBidder') order = [[models.sequelize.col('highestBidder'), sort]];
  else if (by === 'like') {
    separate = true;
    orderCar = [[models.sequelize.col('like'), sort]];
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

  // Search By Location (Latitude, Longitude & Radius)
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

    const rawDistancesFunc = (tableName = 'Cars') => {
      const calDistance = `(SELECT calculate_distance(${latitude}, ${longitude}, (SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude"), (SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude"), 'K'))`;
      rawDistances = calDistance;
      return calDistance;
    };

    distances = models.sequelize.literal(rawDistancesFunc("car"));
    rawDistancesFunc();
  }

  // Search by City, Subdistrict/Area & Radius
  if (by === 'area') {
    if (!radius) {
      return res.status(400).json({
        success: false,
        errors: 'Radius not found!'
      });
    }

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
          const rawDistancesFunc = (tableName = 'Cars') => {
            const calDistance = `(SELECT calculate_distance(${subdistrict.latitude}, ${subdistrict.longitude}, (SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude"), (SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude"), 'K'))`;
            rawDistances = calDistance;
            return calDistance;
          };

          distances = models.sequelize.literal(rawDistancesFunc("car"));
          rawDistancesFunc();
        }
      } else {
        // If subdistrictId Null (Search By City & Radius)
        // eslint-disable-next-line no-lonely-if
        if (city) {
          const rawDistancesFunc = (tableName = 'Cars') => {
            const calDistance = `(SELECT calculate_distance(${city.latitude}, ${city.longitude}, (SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude"), (SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude"), 'K'))`;
            rawDistances = calDistance;
            return calDistance;
          };

          distances = models.sequelize.literal(rawDistancesFunc("car"));
          rawDistancesFunc();
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

  let whereQuery = ' AND ("Cars"."status" = 0 OR "Cars"."status" = 1)';
  const whereInclude = { [Op.or]: [{ status: 0 }, { status: 1 }] };
  if (condition) {
    Object.assign(whereInclude, {
      condition: {
        [Op.eq]: condition
      }
    });

    whereQuery += ` AND "Cars"."condition" = ${condition}`
  }

  if (brandId) {
    Object.assign(whereInclude, {
      brandId: {
        [Op.eq]: brandId
      }
    });

    whereQuery += ` AND "Cars"."brandId" = ${brandId}`
  }

  if (modelId) {
    Object.assign(whereInclude, {
      modelId: {
        [Op.eq]: modelId
      }
    });

    whereQuery += ` AND "Cars"."modelId" = ${modelId}`
  }

  if (groupModelId) {
    Object.assign(whereInclude, {
      groupModelId: {
        [Op.eq]: groupModelId
      }
    });

    whereQuery += ` AND "Cars"."groupModelId" = ${groupModelId}`
  }

  if (minKm && maxKm) {
    Object.assign(whereInclude, {
      km: {
        [Op.and]: [{ [Op.gte]: minKm }, { [Op.lte]: maxKm }]
      }
    });

    whereQuery += ` AND ("Cars"."km" >= ${minKm} AND "Cars"."km" <= ${maxKm})`
  }

  if (minPrice && maxPrice) {
    Object.assign(whereInclude, {
      price: {
        [Op.and]: [{ [Op.gte]: minPrice }, { [Op.lte]: maxPrice }]
      }
    });

    whereQuery += ` AND ("Cars"."price" >= ${minPrice} AND "Cars"."km" <= ${maxPrice})`
  }

  if (by === 'highestBidder') {
    const highestBidder = `(SELECT "Bargains"."carId" 
      FROM "Bargains" 
      LEFT JOIN "Cars" 
        ON "Bargains"."carId" = "Cars"."id" 
      WHERE "Cars"."modelYearId" = "ModelYear"."id" 
        AND "Bargains"."deletedAt" IS NULL 
        AND "Bargains"."bidType" = 0
      ORDER BY "Bargains"."bidAmount" 
      DESC LIMIT 1
    )`;

    Object.assign(whereInclude, {
      id: {
        [Op.eq]: models.sequelize.literal(highestBidder)
      }
    });

    whereQuery += ` AND ("Cars"."id" = ${highestBidder})`
  }

  if (by === 'location' || by === 'area') {
    Object.assign(whereInclude, {
      [Op.and]: [models.sequelize.where(distances, { [Op.lte]: radius })]
    });

    whereQuery += ` AND ${rawDistances} <= ${radius}`
  }

  if (typeId) {
    const groupModelExist = (tableName) => {
      return `EXISTS(SELECT "GroupModels"."typeId" 
        FROM "GroupModels" 
        WHERE "GroupModels"."id" = "${tableName}"."groupModelId" 
          AND "GroupModels"."typeId" = ${typeId} 
          AND "GroupModels"."deletedAt" IS NULL
      )`;
    };

    Object.assign(whereInclude, {
      [Op.and]: models.sequelize.literal(groupModelExist("car"))
    });

    whereQuery += ` AND ${groupModelExist("Cars")}`;
  }

  if (by === 'like') {
    modelCarName = 'Car';
    Object.assign(where, {
      [Op.and]: [models.sequelize.where(countCar, { [Op.gte]: 1 })]
    });
  }
    
  return models.ModelYear.findAll({
    attributes: Object.keys(models.ModelYear.attributes).concat([
      [ 
        models.sequelize.literal(
          `(SELECT COUNT("Cars"."id") 
            FROM "Cars" 
            WHERE "Cars"."modelYearId" = "ModelYear"."id" 
              AND "Cars"."deletedAt" IS NULL 
              ${whereQuery}
          )`
        ),
        'numberOfCar' 
      ],
      [
        models.sequelize.literal(
          `(SELECT MAX("Cars"."price") 
            FROM "Cars" 
            WHERE "Cars"."modelYearId" = "ModelYear"."id" 
              AND "Cars"."deletedAt" IS NULL 
              ${whereQuery}
          )`
        ),
        'maxPrice'
      ],
      [
        models.sequelize.literal(
          `(SELECT MIN("Cars"."price") 
            FROM "Cars" 
            WHERE "Cars"."modelYearId" = "ModelYear"."id" 
              AND "Cars"."deletedAt" IS NULL 
              ${whereQuery}
          )`
        ),
        'minPrice'
      ],
      [
        models.sequelize.literal(
          `(SELECT COUNT("Bargains"."id") 
            FROM "Bargains" 
              LEFT JOIN "Cars" 
              ON "Bargains"."carId" = "Cars"."id" 
            WHERE "Cars"."modelYearId" = "ModelYear"."id" 
              AND "Bargains"."deletedAt" IS NULL 
              AND "Bargains"."bidType" = 0
              ${whereQuery}
          )`
        ),
        'numberOfBidder'
      ],
      [
        models.sequelize.literal(
          `(SELECT MAX("Bargains"."bidAmount") 
            FROM "Bargains" 
              LEFT JOIN "Cars" 
              ON "Bargains"."carId" = "Cars"."id" 
            WHERE "Cars"."modelYearId" = "ModelYear"."id" 
              AND "Bargains"."deletedAt" IS NULL 
              AND "Bargains"."bidType" = 0
              ${whereQuery}
          )`
        ),
        'highestBidder'
      ],
      [
        models.sequelize.literal(
          `(SELECT "Bargains"."carId" 
            FROM "Bargains" 
              LEFT JOIN "Cars" 
              ON "Bargains"."carId" = "Cars"."id" 
            WHERE "Cars"."modelYearId" = "ModelYear"."id" 
              AND "Bargains"."deletedAt" IS NULL 
              AND "Bargains"."bidType" = 0
              ${whereQuery} 
            ORDER BY "Bargains"."bidAmount" DESC 
            LIMIT 1
          )`
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
        separate,
        order: orderCar,
        attributes: {
          include: [
            [
              models.sequelize.literal(
                `(SELECT MAX("Bargains"."bidAmount") 
                  FROM "Bargains" 
                  WHERE "Bargains"."carId" = "${modelCarName}"."id" 
                    AND "Bargains"."deletedAt" IS NULL
                    AND "Bargains"."bidType" = 0
                )`
              ),
              'bidAmount'
            ],
            [
              models.sequelize.literal(
                `(SELECT COUNT("Bargains"."id") 
                  FROM "Bargains" 
                  WHERE "Bargains"."carId" = "${modelCarName}"."id" 
                    AND "Bargains"."deletedAt" IS NULL
                    AND "Bargains"."bidType" = 0
                )`
              ),
              'numberOfBidder'
            ],
            [
              models.sequelize.literal(
                `(SELECT COUNT("Likes"."id") 
                  FROM "Likes" 
                  WHERE "Likes"."carId" = "${modelCarName}"."id" 
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
                  WHERE "Views"."carId" = "${modelCarName}"."id" 
                    AND "Views"."deletedAt" IS NULL
                )`
              ),
              'view'
            ],
            [
              models.sequelize.literal(
                `(SELECT "GroupModels"."typeId" 
                  FROM "GroupModels" 
                  WHERE "GroupModels"."id" = "${modelCarName}"."groupModelId" 
                    AND "GroupModels"."deletedAt" IS NULL
                )`
              ),
              'groupModelTypeId'
            ],
            [
              models.sequelize.literal(
                `(SELECT split_part("${modelCarName}"."location", ',', 1))`
              ),
              'latitude'
            ],
            [
              models.sequelize.literal(
                `(SELECT split_part("${modelCarName}"."location", ',', 2))`
              ),
              'longitude'
            ]
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
    const groupModelExist = (tableName) => {
      return `EXISTS(SELECT "GroupModels"."typeId" 
        FROM "GroupModels" 
        WHERE "GroupModels"."id" = "${tableName}"."groupModelId" 
          AND "GroupModels"."typeId" = ${typeId} 
          AND "GroupModels"."deletedAt" IS NULL
      )`;
    };

    Object.assign(whereInclude, {
      [Op.and]: models.sequelize.literal(groupModelExist("car"))
    });

    whereQuery += ` AND ${groupModelExist("Cars")}`;
  }

  return models.ModelYear.findAll({
    attributes: Object.keys(models.ModelYear.attributes).concat([
      [
        models.sequelize.literal(
          `(SELECT MAX("Cars"."price") 
            FROM "Cars" 
            WHERE "Cars"."modelYearId" = "ModelYear"."id" 
              AND "Cars"."deletedAt" IS NULL
              ${whereQuery}
          )`
        ),
        'maxPrice'
      ],
      [
        models.sequelize.literal(
          `(SELECT MIN("Cars"."price") 
            FROM "Cars" 
            WHERE "Cars"."modelYearId" = "ModelYear"."id" 
              AND "Cars"."deletedAt" IS NULL
              ${whereQuery}
          )`
        ),
        'minPrice'
      ],
      [
        models.sequelize.literal(
          `(SELECT COUNT("Cars"."id") 
            FROM "Cars" 
            WHERE "Cars"."modelYearId" = "ModelYear"."id" 
              AND "Cars"."deletedAt" IS NULL  
              ${whereQuery}
          )`
        ),
        'numberOfCar'
      ],
      [
        models.sequelize.literal(
          `(SELECT COUNT("Bargains"."id") 
            FROM "Bargains" 
              LEFT JOIN "Cars" 
              ON "Bargains"."carId" = "Cars"."id" 
            WHERE "Cars"."modelYearId" = "ModelYear"."id" 
              AND "Bargains"."deletedAt" IS NULL
              AND "Bargains"."bidType" = 0
              ${whereQuery}
          )`
        ),
        'numberOfBidder'
      ],
      [
        models.sequelize.literal(
          `(SELECT MAX("Bargains"."bidAmount") 
            FROM "Bargains" 
              LEFT JOIN "Cars" 
              ON "Bargains"."carId" = "Cars"."id" 
            WHERE "Cars"."modelYearId" = "ModelYear"."id" 
              AND "Bargains"."deletedAt" IS NULL
              AND "Bargains"."bidType" = 0
              ${whereQuery}
          )`
        ),
        'highestBidder'
      ],
      [
        models.sequelize.literal(
          `(SELECT "Bargains"."carId" 
            FROM "Bargains" 
              LEFT JOIN "Cars" 
              ON "Bargains"."carId" = "Cars"."id" 
            WHERE "Cars"."modelYearId" = "ModelYear"."id" 
              AND "Bargains"."deletedAt" IS NULL 
              AND "Bargains"."bidType" = 0
              ${whereQuery}
            ORDER BY "Bargains"."bidAmount" DESC 
            LIMIT 1
          )`
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
                `(SELECT MAX("Bargains"."bidAmount") 
                  FROM "Bargains" 
                  WHERE "Bargains"."carId" = "car"."id" 
                    AND "Bargains"."deletedAt" IS NULL
                    AND "Bargains"."bidType" = 0
                )`
              ),
              'bidAmount'
            ],
            [
              models.sequelize.literal(
                `(SELECT COUNT("Bargains"."id") 
                  FROM "Bargains" 
                  WHERE "Bargains"."carId" = "car"."id" 
                    AND "Bargains"."deletedAt" IS NULL
                    AND "Bargains"."bidType" = 0
                )`
              ),
              'numberOfBidder'
            ],
            [
               models.sequelize.literal(
                `(SELECT COUNT("Likes"."id") 
                  FROM "Likes" 
                  WHERE "Likes"."carId" = "car"."id"
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
                  WHERE "Views"."carId" = "car"."id" 
                    AND "Views"."deletedAt" IS NULL
                )`
              ),
              'view'
            ],
            [
              models.sequelize.literal(
                `(SELECT split_part("car"."location", ',', 1))`
              ),
              'latitude'
            ],
            [
              models.sequelize.literal(
                `(SELECT split_part("car"."location", ',', 2))`
              ),
              'longitude'
            ]
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

router.get('/listingCar/:id', async (req, res) => {
  const { 
    by,
    brandId,
    groupModelId,
    modelId,
    year, 
    maxPrice, 
    minPrice, 
    condition,
    minKm,
    maxKm,
    minYear,
    maxYear,
    radius,
    latitude,
    longitude,
    cityId,
    subdistrictId,
    typeId
  } = req.query;

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

  // Search By Location (Latitude, Longitude & Radius)
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

    const rawDistances = `(SELECT calculate_distance(${latitude}, ${longitude}, (SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude"), (SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude"), 'K'))`;
    distances = models.sequelize.literal(rawDistances);
  }

  // Search by City, Subdistrict/Area & Radius
  if (by === 'area') {
    if (!radius) {
      return res.status(400).json({
        success: false,
        errors: 'Radius not found!'
      });
    }

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
          const rawDistances = `(SELECT calculate_distance(${subdistrict.latitude}, ${subdistrict.longitude}, (SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude"), (SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude"), 'K'))`;
          distances = models.sequelize.literal(rawDistances);
        }
      } else {
        // If subdistrictId Null (Search By City & Radius)
        // eslint-disable-next-line no-lonely-if
        if (city) {
          const rawDistances = `(SELECT calculate_distance(${city.latitude}, ${city.longitude}, (SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude"), (SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude"), 'K'))`;
          distances = models.sequelize.literal(rawDistances);
        }
      }
    } else {
      return res.status(400).json({
        success: false,
        errors: 'Please Select City!'
      });
    }
  }

  const where = {
    [Op.or]: [{ status: 0 }, { status: 1 }],
    modelYearId: id
  };

  const includeWhere = {};

  if (year) {
    Object.assign(includeWhere, {
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

  if (brandId) {
    Object.assign(where, {
      brandId: {
        [Op.eq]: brandId
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

  if (groupModelId) {
    Object.assign(where, {
      groupModelId: {
        [Op.eq]: groupModelId
      }
    });
  }

  if (minKm && maxKm) {
    Object.assign(where, {
      km: {
        [Op.and]: [{ [Op.gte]: minKm }, { [Op.lte]: maxKm }]
      }
    });
  }

  if (by === 'highestBidder') {
    const highestBidder = `(SELECT "Bargains"."carId" 
      FROM "Bargains" 
      LEFT JOIN "Cars" 
        ON "Bargains"."carId" = "Car"."id" 
      WHERE "Bargains"."deletedAt" IS NULL 
        AND "Bargains"."bidType" = 0
      ORDER BY "Bargains"."bidAmount" 
      DESC LIMIT 1
    )`;

    Object.assign(where, {
      id: {
        [Op.eq]: models.sequelize.literal(highestBidder)
      }
    });
  }

  if (by === 'location' || by === 'area') {
    Object.assign(where, {
      [Op.and]: [models.sequelize.where(distances, { [Op.lte]: radius })]
    });
  }

  if (typeId) {
    const groupModelExist = `EXISTS(
      SELECT "GroupModels"."typeId" 
      FROM "GroupModels" 
      WHERE "GroupModels"."id" = "Car"."groupModelId" 
      AND "GroupModels"."typeId" = ${typeId} 
      AND "GroupModels"."deletedAt" IS NULL
    )`;

    Object.assign(where, {
      [Op.and]: models.sequelize.literal(groupModelExist)
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
    ]),
    include: [
      {
        model: models.ModelYear,
        as: 'modelYear',
        where: includeWhere,
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
            where: includeWhere
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

    const includeWhere = {};

    if (year) {
      Object.assign(includeWhere, {
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
          model: models.ModelYear,
          as: 'modelYear',
          where: includeWhere,
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
              where: includeWhere
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
  let whereQuery = '';

  const whereInclude = {
    [Op.or]: [{ status: 0 }, { status: 1 }]
  };

  if (minPrice && maxPrice) {
    Object.assign(where, {
      price: {
        [Op.and]: [{ [Op.gte]: minPrice }, { [Op.lte]: maxPrice }]
      }
    });

    whereQuery += ` AND "ModelYear"."price" >= ${minPrice} AND "ModelYear"."price" <= ${maxPrice}`;
  }

  if (condition) {
    Object.assign(whereInclude, {
      condition: {
        [Op.eq]: condition
      }
    });

    whereQuery += ` AND "Cars"."condition" = ${condition}`;
  }

  Object.assign(whereInclude, {
    id: {
      [Op.eq]: models.sequelize.literal(
        `(SELECT "Bargains"."carId" 
          FROM "Bargains" 
          LEFT JOIN "Cars" 
            ON "Bargains"."carId" = "Cars"."id" 
          WHERE "Cars"."modelYearId" = "ModelYear"."id" 
            AND "Bargains"."deletedAt" IS NULL 
          ORDER BY "Bargains"."bidAmount" DESC 
          LIMIT 1
        )`
      )
    }
  });

  return models.ModelYear.findAll({
    attributes: Object.keys(models.ModelYear.attributes).concat([
      [
        models.sequelize.literal(
          `(SELECT COUNT("Bargains"."id") 
            FROM "Bargains" 
            LEFT JOIN "Cars" 
              ON "Bargains"."carId" = "Cars"."id" 
            WHERE "Cars"."modelYearId" = "ModelYear"."id" 
              ${whereQuery}
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
            LEFT JOIN "Cars" 
              ON "Bargains"."carId" = "Cars"."id" 
            WHERE "Cars"."modelYearId" = "ModelYear"."id" 
              ${whereQuery} 
              AND "Bargains"."deletedAt" IS NULL
              AND "Bargains"."bidType" = 0
          )`
        ),
        'highestBidder'
      ],
      [
        models.sequelize.literal(
          `(SELECT COUNT("Cars"."id") 
            FROM "Cars" 
            WHERE "Cars"."modelYearId" = "ModelYear"."id" 
              ${whereQuery}
              AND "Cars"."deletedAt" IS NULL 
              AND ("Cars"."status" = 0 OR "Cars"."status" = 1)
          )`
        ),
        'numberOfCar'
      ],
      [
        models.sequelize.literal(
          `(SELECT MAX("Cars"."price") 
            FROM "Cars" 
            WHERE "Cars"."modelYearId" = "ModelYear"."id" 
              ${whereQuery} 
              AND "Cars"."deletedAt" IS NULL
          )`
        ),
        'maxPrice'
      ],
      [
        models.sequelize.literal(
          `(SELECT MIN("Cars"."price") 
            FROM "Cars" 
            WHERE "Cars"."modelYearId" = "ModelYear"."id" 
              ${whereQuery} 
              AND "Cars"."deletedAt" IS NULL
          )`
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
              `(SELECT MAX("Bargains"."bidAmount") 
                FROM "Bargains" 
                WHERE "Bargains"."carId" = "car"."id" 
                  AND "Bargains"."deletedAt" IS NULL
                  AND "Bargains"."bidType" = 0
              )`
            ),
            'bidAmount'
          ],
          [
            models.sequelize.literal(
              `(SELECT COUNT("Bargains"."id") 
                FROM "Bargains" 
                WHERE "Bargains"."carId" = "car"."id" 
                  AND "Bargains"."deletedAt" IS NULL
                  AND "Bargains"."bidType" = 0
              )`
            ),
            'numberOfBidder'
          ],
          [
            models.sequelize.literal(
              `(SELECT COUNT("Likes"."id") 
                FROM "Likes" 
                WHERE "Likes"."carId" = "car"."id" 
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
                WHERE "Views"."carId" = "car"."id" 
                  AND "Views"."deletedAt" IS NULL
              )`
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
