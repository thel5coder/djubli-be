/* eslint-disable linebreak-style */
const express = require('express');
const validator = require('validator');
const Sequelize = require('sequelize');
const passport = require('passport');
const models = require('../db/models');
const paginator = require('../helpers/paginator');
const carHelper = require('../helpers/car');
const calculateDistance = require('../helpers/calculateDistance');

const {
  Op
} = Sequelize;

const DEFAULT_LIMIT = process.env.DEFAULT_LIMIT || 10;
const MAX_LIMIT = process.env.MAX_LIMIT || 50;

async function listingAllNew(req, res, fromCallback = false) {
  let {
    page,
    limit,
    by,
    sort
  } = req.query;

  const {
    id,
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
    typeId,
    cityId,
    subdistrictId,
    exteriorColorId,
    interiorColorId
  } = req.query;

  let {
    radius,
    latitude,
    longitude
  } = req.query;

  let offset = 0;
  let distances = {};
  let rawDistances = ``;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  if (!by) by = 'id';
  if (!sort) sort = 'asc';
  else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';

  let tableCarName = 'modelYears->cars'

  const array = [
    'id',
    'highestBidder',
    'price',
    'km',
    'listingDate',
    'roleUser',
    'condition',
    'location',
    'like',
    'brand',
    'area',
    'distance'
  ];
  if (array.indexOf(by) < 0) by = 'createdAt';
  // *highestBidder; price; km; listingDate; roleUser; condition; location; like; brand, area

  let separate = false;
  const order = [];
  let orderCar = [];
  const orderModelYear = [];

  switch (by) {
    case 'highestBidder':
      orderModelYear.push([Sequelize.literal(`"modelYears.highestBidder" ${sort}`)]);
      break;
    case 'like':
      orderCar.push([Sequelize.literal(`"modelYears.cars.like" ${sort}`)]);
      break;
    case 'price':
      orderCar.push([Sequelize.literal(`"modelYears.cars.price" ${sort}`)]);
    case 'condition':
      orderCar.push([Sequelize.literal(`"modelYears.cars.condition" ${sort}`)]);
      break;
    case 'brand':
      order.push([Sequelize.literal(`"groupModel.brand.name" ${sort}, "groupModel.name" ${sort}, "name" ${sort}`)]);
      order.push([
        {
          model: models.ModelYear,
          as: 'modelYears'
        }, 
        'year', 
        'DESC'
      ]);
      break;
    case 'km':
      order.push([{
          model: models.ModelYear,
          as: 'modelYears'
        },
        {
          model: models.Car,
          as: 'cars'
        },
        by,
        sort
      ]);
      break;
    case 'profile':
      order.push([{
        model: models.User,
        as: 'user'
      }, 'type', sort]);
      break;
    case 'distance':
      if (cityId) {
        const city = await models.City.findByPk(cityId);
        if (!city) return res.status(400).json({
          success: false,
          errors: 'City not found!'
        });

        if (subdistrictId) {
          const subdistrict = await models.SubDistrict.findOne({
            where: {
              id: subdistrictId,
              cityId
            }
          });
          if (!subdistrict)
            return res.status(400).json({
              success: false,
              errors: 'Subdistrict not found!'
            });

          if (city && subdistrict) {
            latitude = subdistrict.latitude;
            longitude = subdistrict.longitude;
          }
        } else {
          if (city) {
            latitude = city.latitude;
            longitude = city.longitude;
          }
        }
      }

      separate = true;
      orderCar.push([Sequelize.literal(`"distance" ${sort}`)]);
      tableCarName = 'Car'
      break;
    case 'location':
      // Search By Location (Latitude, Longitude & Radius)
      if (by === 'location') {
        if (!latitude)
          return res.status(400).json({
            success: false,
            errors: 'Latitude not found!'
          });
        if (!longitude)
          return res.status(400).json({
            success: false,
            errors: 'Longitude not found!'
          });
        if (!radius) return res.status(400).json({
          success: false,
          errors: 'Radius not found!'
        });

        await calculateDistance.CreateOrReplaceCalculateDistance();
        const rawDistancesFunc = (tableName = 'Car') => {
          const calDistance = `(SELECT calculate_distance(${latitude}, ${longitude}, (SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude"), (SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude"), 'K'))`;
          rawDistances = calDistance;
          return calDistance;
        };

        distances = models.sequelize.literal(rawDistancesFunc('Car'));
        rawDistancesFunc();

        order.push([Sequelize.literal(`"groupModel.brand.name" ${sort}`)]);
      }
      break;
    case 'area':
      // Search by City, Subdistrict/Area & Radius
      if (cityId && (radius && radius[0] >= 0 && radius[1] > 0)) {
        const city = await models.City.findByPk(cityId);
        if (!city) return res.status(400).json({
          success: false,
          errors: 'City not found!'
        });

        if (subdistrictId) {
          const subdistrict = await models.SubDistrict.findOne({
            where: {
              id: subdistrictId,
              cityId
            }
          });
          if (!subdistrict)
            return res.status(400).json({
              success: false,
              errors: 'Subdistrict not found!'
            });

          if (city && subdistrict) {
            await calculateDistance.CreateOrReplaceCalculateDistance();
            const rawDistancesFunc = (tableName = 'Car') => {
              const calDistance = `(SELECT calculate_distance(${subdistrict.latitude}, ${subdistrict.longitude}, (SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude"), (SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude"), 'K'))`;
              rawDistances = calDistance;
              return calDistance;
            };
            latitude = subdistrict.latitude;
            longitude = subdistrict.longitude;

            distances = models.sequelize.literal(rawDistancesFunc(tableCarName));
            rawDistancesFunc();

            order.push([Sequelize.literal(`"groupModel.brand.name" ${sort}`)]);
          }
        } else {
          if (city) {
            await calculateDistance.CreateOrReplaceCalculateDistance();
            const rawDistancesFunc = (tableName = 'Cars') => {
              const calDistance = `(SELECT calculate_distance(${city.latitude}, ${city.longitude}, (SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude"), (SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude"), 'K'))`;
              rawDistances = calDistance;
              return calDistance;
            };
            latitude = city.latitude;
            longitude = city.longitude;

            distances = models.sequelize.literal(rawDistancesFunc(tableCarName));
            rawDistancesFunc();

            order.push([Sequelize.literal(`"groupModel.brand.name" ${sort}`)]);
          }
        }
      } else if (!cityId) {
        return res.status(400).json({
          success: false,
          errors: 'Please Select City!'
        });
      }
      break;
    default:
      order.push([by, sort]);
      break;
  }

  let required = false;
  const where = {};
  let whereQuery = ' AND ("Car"."status" = 0 OR "Car"."status" = 1) AND "Car"."deletedAt" IS NULL';
  if (id) Object.assign(where, {
    id
  });

  if (radius) {
    if (radius.length < 2)
      return res.status(422).json({
        success: false,
        errors: 'incomplete radius'
      });

    if (radius[0] >= 0 && radius[1] > 0) {
      await calculateDistance.CreateOrReplaceCalculateDistance();
      const rawDistancesFunc = (tableName = 'Car') => {
        const calDistance = `(SELECT calculate_distance(${latitude}, ${longitude}, (SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude"), (SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude"), 'K'))`;
        rawDistances = calDistance;
        return calDistance;
      };

      distances = models.sequelize.literal(rawDistancesFunc(tableCarName));
      rawDistancesFunc();
    }
  }

  const whereModelYear = {};
  if (minYear && maxYear)
    Object.assign(whereModelYear, {
      year: {
        [Op.and]: [{
          [Op.gte]: minYear
        }, {
          [Op.lte]: maxYear
        }]
      }
    });

  const whereCar = {
    [Op.or]: [{
      status: 0
    }, {
      status: 1
    }]
  };

  switch (by) {
    case 'area':
      // Search by City, Subdistrict/Area without Radius
      if (cityId && (!radius || (radius && radius[0] == 0 && radius[1] == ''))) {
        const city = await models.City.findByPk(cityId);
        if (!city) return res.status(400).json({
          success: false,
          errors: 'City not found!'
        });

        if (subdistrictId) {
          const subdistrict = await models.SubDistrict.findOne({
            where: {
              id: subdistrictId,
              cityId
            }
          });
          if (!subdistrict)
            return res.status(400).json({
              success: false,
              errors: 'Subdistrict not found!'
            });

          if (city && subdistrict) {
            Object.assign(whereCar, {
              cityId,
              subdistrictId
            });

            whereQuery += ` AND "Car"."cityId" = ${cityId} AND "Car"."subdistrictId" = ${subdistrictId}`;

            latitude = subdistrict.latitude;
            longitude = subdistrict.longitude;
          }
        } else {
          if (city) {
            Object.assign(whereCar, {
              cityId
            });

            whereQuery += ` AND "Car"."cityId" = ${cityId}`;

            latitude = city.latitude;
            longitude = city.longitude;
          }
        }

        order.push([Sequelize.literal(`"groupModel.brand.name" ${sort}`)]);
      } else if (!cityId) {
        return res.status(400).json({
          success: false,
          errors: 'Please Select City!'
        });
      }
      break;
  }

  if (condition) {
    Object.assign(whereCar, {
      condition
    });
    required = true;
    whereQuery += ` AND "Car"."condition" = ${condition}`;
  }

  const whereBrand = {};
  if (brandId) {
    Object.assign(whereBrand, {
      id: brandId
    });
    required = true;
    whereQuery += ` AND "Car"."brandId" = ${brandId}`;
  }

  if (modelId) {
    Object.assign(whereCar, {
      modelId
    });
    required = true;
    whereQuery += ` AND "Car"."modelId" = ${modelId}`;
  }

  if (groupModelId) {
    Object.assign(whereCar, {
      groupModelId
    });
    required = true;
    whereQuery += ` AND "Car"."groupModelId" = ${groupModelId}`;
  }

  if (minKm && maxKm) {
    Object.assign(whereCar, {
      km: {
        [Op.and]: [{
          [Op.gte]: minKm
        }, {
          [Op.lte]: maxKm
        }]
      }
    });
    required = true;

    whereQuery += ` AND ("Car"."km" >= ${minKm} AND "Car"."km" <= ${maxKm})`;
  }

  if (minPrice && maxPrice) {
    Object.assign(whereCar, {
      price: {
        [Op.and]: [{
          [Op.gte]: minPrice
        }, {
          [Op.lte]: maxPrice
        }]
      }
    });
    required = true;

    whereQuery += ` AND ("Car"."price" >= ${minPrice} AND "Car"."price" <= ${maxPrice})`;
  }

  if (exteriorColorId) {
    Object.assign(whereCar, {
      exteriorColorId
    });
    required = true;
    whereQuery += ` AND ("Car"."exteriorColorId" = ${exteriorColorId})`;
  }

  if (interiorColorId) {
    Object.assign(whereCar, {
      interiorColorId
    });
    required = true;
    whereQuery += ` AND ("Car"."interiorColorId" = ${interiorColorId})`;
  }

  const whereGroupModel = {};
  if (typeId) {
    Object.assign(whereGroupModel, {
      typeId
    });

    // whereQuery += ` AND ${groupModelExist('Car')}`;
  }

  const includeCar = [
    {
      model: models.User,
      as: 'user',
      attributes: ['id', 'name', 'email', 'phone', 'type', 'companyType'],
      include: [{
        model: models.Purchase,
        as: 'purchase',
        attributes: {
          exclude: ['deletedAt']
        },
        order: [
          ['id', 'desc']
        ],
        limit: 1
      }]
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
  const attributeCar = [
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
    'address',
    'cityId',
    'subdistrictId',
    'roomId',
    'oldPrice',
    'createdAt',
    'updatedAt',
    [
      models.sequelize.literal(
        `(SELECT MAX("Bargains"."bidAmount") FROM "Bargains" WHERE "Bargains"."carId" = "${tableCarName}"."id" AND "Bargains"."deletedAt" IS NULL AND "Bargains"."bidType" = 0)`
      ),
      'bidAmount'
    ],
    [
      models.sequelize.literal(
        `(SELECT COUNT("Bargains"."id") FROM "Bargains" WHERE "Bargains"."carId" = "${tableCarName}"."id" AND "Bargains"."deletedAt" IS NULL AND "Bargains"."bidType" = 0)`
      ),
      'numberOfBidder'
    ],
    [
      models.sequelize.literal(
        `(SELECT COUNT("Likes"."id") FROM "Likes" WHERE "Likes"."carId" = "${tableCarName}"."id" AND "Likes"."status" IS TRUE AND "Likes"."deletedAt" IS NULL)`
      ),
      'like'
    ],
    [
      models.sequelize.literal(
        `(SELECT COUNT("Views"."id") FROM "Views" WHERE "Views"."carId" = "${tableCarName}"."id" AND "Views"."deletedAt" IS NULL)`
      ),
      'view'
    ],
    [
      models.sequelize.literal(
        `(SELECT "GroupModels"."typeId" FROM "GroupModels" WHERE "GroupModels"."id" = "${tableCarName}"."groupModelId" AND "GroupModels"."deletedAt" IS NULL)`
      ),
      'groupModelTypeId'
    ],
    [
      models.sequelize.literal(`(SELECT split_part("${tableCarName}"."location", ',', 1))`),
      'latitude'
    ],
    [
      models.sequelize.literal(`(SELECT split_part("${tableCarName}"."location", ',', 2))`),
      'longitude'
    ]
  ];

  if (latitude && longitude) {
    if (radius && radius[0] >= 0 && radius[1] > 0) {
      whereQuery += ` AND ${rawDistances} >= ${Number(radius[0])} AND ${rawDistances} <= ${Number(
        radius[1]
      )}`;
    }

    attributeCar.push([
      models.sequelize.literal(
        `(SELECT calculate_distance(${latitude}, ${longitude}, (SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableCarName}"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude"), (SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableCarName}"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude"), 'K'))`
      ),
      'distance'
    ]);
  }

  let queryCountCar = `(SELECT COUNT("Car"."id") FROM "Cars" as "Car" WHERE "Car"."modelYearId" = "modelYears"."id" AND "Car"."deletedAt" IS NULL ${whereQuery})`;
  const whereCarNotNull = Sequelize.literal(`(${queryCountCar})`);
  Object.assign(whereModelYear, {
    whereModelYear: Sequelize.where(whereCarNotNull, {
      [Op.gt]: 0
    })
  });

  const modelAttribute = await carHelper.customFields({
    fields: ['maxPriceModel', 'minPriceModel', 'maxKm', 'minKm', 'maxYear', 'minYear'],
    whereQuery
  });

  return models.Model.findAll({
      attributes: Object.keys(models.Model.attributes).concat(modelAttribute),
      include: [
        {
          model: models.GroupModel,
          as: 'groupModel',
          attributes: {
            exclude: ['createdAt', 'updatedAt', 'deletedAt']
          },
          where: whereGroupModel,
          include: [{
              model: models.Brand,
              as: 'brand',
              attributes: {
                exclude: ['createdAt', 'updatedAt', 'deletedAt']
              },
              where: whereBrand
            },
            {
              model: models.Type,
              as: 'type',
              attributes: {
                exclude: ['createdAt', 'updatedAt', 'deletedAt']
              }
            }
          ]
        },
        {
          model: models.ModelYear,
          as: 'modelYears',
          attributes: [
            'id',
            'modelId',
            'year',
            'picture',
            'price',
            'createdAt',
            'updatedAt',
            [
              models.Sequelize.literal(
                `(SELECT COUNT("Car"."id") FROM "Cars" as "Car" WHERE "Car"."modelYearId" = "modelYears"."id" AND "Car"."deletedAt" IS NULL ${whereQuery})`
              ),
              'numberOfCar'
            ],
            [
              models.sequelize.literal(
                `(SELECT MAX("Car"."price") FROM "Cars" as "Car" WHERE "Car"."modelYearId" = "modelYears"."id" AND "Car"."deletedAt" IS NULL ${whereQuery})`
              ),
              'maxPrice'
            ],
            [
              models.sequelize.literal(
                `(SELECT MIN("Car"."price") FROM "Cars" as "Car" WHERE "Car"."modelYearId" = "modelYears"."id" AND "Car"."deletedAt" IS NULL ${whereQuery})`
              ),
              'minPrice'
            ],
            [
              models.sequelize.literal(
                `(SELECT COUNT("Bargains"."id") FROM "Bargains" LEFT JOIN "Cars" as "Car" ON "Bargains"."carId" = "Car"."id" WHERE "Car"."modelYearId" = "modelYears"."id" AND "Bargains"."deletedAt" IS NULL AND "Bargains"."bidType" = 0 ${whereQuery} )`
              ),
              'numberOfBidder'
            ],
            [
              models.sequelize.literal(
                `(SELECT MAX("Bargains"."bidAmount") FROM "Bargains" LEFT JOIN "Cars" as "Car" ON "Bargains"."carId" = "Car"."id" WHERE "Car"."modelYearId" = "modelYears"."id" AND "Bargains"."deletedAt" IS NULL AND "Bargains"."bidType" = 0 ${whereQuery} )`
              ),
              'highestBidder'
            ],
            [
              models.sequelize.literal(
                `(SELECT "Bargains"."carId" FROM "Bargains" LEFT JOIN "Cars" as "Car" ON "Bargains"."carId" = "Car"."id" WHERE "Car"."modelYearId" = "modelYears"."id" AND "Bargains"."deletedAt" IS NULL AND "Bargains"."bidType" = 0 ${whereQuery} ORDER BY "Bargains"."bidAmount" DESC LIMIT 1)`
              ),
              'highestBidderCarId'
            ],
            [
              models.sequelize.literal(
                `(SELECT COUNT("Purchase"."id") FROM "Purchases" as "Purchase" LEFT JOIN "Cars" as "Car" ON "Purchase"."carId" = "Car"."id" WHERE "Car"."status"=2 AND "Car"."modelYearId" = "modelYears"."id" AND "Car"."deletedAt" IS NULL)`
              ),
              'purchase'
            ]
          ],
          where: whereModelYear,
          order: orderModelYear,
          include: [{
            required,
            model: models.Car,
            as: 'cars',
            separate,
            attributes: attributeCar,
            include: includeCar,
            where: whereCar,
            order: orderCar
          }]
        }
      ],
      where,
      order,
      offset,
      limit
    })
    .then(async data => {
      const count = await models.Model.count({
        include: [{
            model: models.GroupModel,
            as: 'groupModel',
            where: whereGroupModel,
            include: [{
                model: models.Brand,
                as: 'brand',
                where: whereBrand
              },
              {
                model: models.Type,
                as: 'type'
              }
            ]
          },
          {
            model: models.ModelYear,
            as: 'modelYears',
            where: whereModelYear,
            order: orderModelYear,
            include: [{
              required,
              model: models.Car,
              as: 'cars',
              separate,
              include: includeCar,
              where: whereCar,
              order: orderCar
            }]
          }
        ],
        where,
        distinct: true
      });
      const pagination = paginator.paging(page, count, limit);

      const additional = await models.Car.findAll({
        attributes: [
          [Sequelize.fn('max', Sequelize.col('price')), 'maxPrice'],
          [Sequelize.fn('min', Sequelize.col('price')), 'minPrice'],
          [Sequelize.fn('max', Sequelize.col('km')), 'maxKm'],
          [Sequelize.fn('min', Sequelize.col('km')), 'minKm'],
          [
            models.sequelize.literal(
              `(SELECT MAX("ModelYear"."year") FROM "ModelYears" as "ModelYear" INNER JOIN "Cars" as "Car" ON "ModelYear"."id" = "Car"."modelYearId" WHERE "Car"."deletedAt" IS NULL)`
            ),
            'maxYear'
          ],
          [
            models.sequelize.literal(
              `(SELECT MIN("ModelYear"."year") FROM "ModelYears" as "ModelYear" INNER JOIN "Cars" as "Car" ON "ModelYear"."id" = "Car"."modelYearId" WHERE "Car"."deletedAt" IS NULL)`
            ),
            'minYear'
          ]
        ],
        raw: true
      });

      if(fromCallback) {
        return data
      }

      res.status(200).json({
        success: true,
        pagination,
        additional: additional.length > 0 ? additional[additional.length - 1] : {},
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
  listingAllNew
};