/* eslint-disable linebreak-style */
const express = require('express');
const validator = require('validator');
const Sequelize = require('sequelize');
const passport = require('passport');
const models = require('../../db/models');
const paginator = require('../../helpers/paginator');
const carHelper = require('../../helpers/car');
const general = require('../../helpers/general');
const calculateDistance = require('../../helpers/calculateDistance');

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

  const addAttribute = await carHelper.customFields({ fields: ['purchase'], upperCase: true });
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

router.get('/listingAll', async (req, res) => {
  const {
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

  let { page, limit, sort, by } = req.query;
  let offset = 0;
  const countDataPage = 0;
  let distances = {};
  let rawDistances = '';

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  if (!by) by = 'createdAt';
  let order = [['createdAt', 'desc']];
  let orderCar = [];

  let separate = false;
  let upperCase = true;
  const carCustomFields = {};
  const carFields = [
    'bidAmountModelYears',
    'numberOfBidder',
    'like',
    'view',
    'groupModelTypeId',
    'latitude',
    'longitude'
  ];

  if (!sort) sort = 'asc';
  else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';

  if (by === 'year' || by === 'id') {
    upperCase = false;
    order = [[by, sort]];
  } else if (by === 'createdAt') {
    upperCase = false;
    order = [[by, sort]];
  } else if (by === 'numberOfCar') {
    upperCase = false;
    order = [[models.sequelize.col('numberOfCar'), sort]];
  } else if (by === 'highestBidder') {
    upperCase = false;
    order = [[models.sequelize.col('highestBidder'), sort]];
  } else if (by === 'like') {
    separate = true;
    orderCar = [[models.sequelize.col('like'), sort]];
  } else if (by === 'condition') {
    upperCase = false;
    order = [[{ model: models.Car, as: 'car' }, models.sequelize.col('condition'), sort]];
  } else if (by === 'price') {
    upperCase = false;
    order = [[{ model: models.Car, as: 'car' }, models.sequelize.col('price'), sort]];
  } else if (by === 'listingDate') {
    upperCase = false;
    order = [
      [models.sequelize.col('createdAt'), sort],
      [{ model: models.Car, as: 'car' }, models.sequelize.col('createdAt'), sort]
    ];
  } else if (by === 'km') {
    upperCase = false;
    order = [[{ model: models.Car, as: 'car' }, models.sequelize.col('km'), sort]];
  } else if (by === 'brand') {
    order = [
      [
        { model: models.Model, as: 'model' },
        { model: models.GroupModel, as: 'groupModel' },
        { model: models.Brand, as: 'brand' },
        'name',
        sort
      ]
    ];
    upperCase = false;
  } else if (by === 'roleUser') {
    upperCase = false;
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
  }

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

    await calculateDistance.CreateOrReplaceCalculateDistance();
    const rawDistancesFunc = (tableName = 'Car') => {
      const calDistance = `(SELECT calculate_distance(${latitude}, ${longitude}, (SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude"), (SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude"), 'K'))`;
      rawDistances = calDistance;
      return calDistance;
    };

    distances = models.sequelize.literal(rawDistancesFunc('Car'));
    rawDistancesFunc();

    Object.assign(carCustomFields, {
      latitude,
      longitude
    });

    carFields.push('distance');
    upperCase = true;

    separate = true;
    orderCar = [[Sequelize.col(`distance`), sort]];
  }

  // Search by City, Subdistrict/Area & Radius
  if (by === 'area' && radius) {
    // if (!radius) {
    //   return res.status(400).json({
    //     success: false,
    //     errors: 'Radius not found!'
    //   });
    // }

    if (cityId) {
      const city = await models.City.findByPk(cityId);
      if (!city) {
        return res.status(400).json({
          success: false,
          errors: 'City not found!'
        });
      }

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
          await calculateDistance.CreateOrReplaceCalculateDistance();
          const rawDistancesFunc = (tableName = 'Car') => {
            const calDistance = `(SELECT calculate_distance(${subdistrict.latitude}, ${subdistrict.longitude}, (SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude"), (SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude"), 'K'))`;
            rawDistances = calDistance;
            return calDistance;
          };

          Object.assign(carCustomFields, {
            latitude: subdistrict.latitude,
            longitude: subdistrict.longitude
          });

          distances = models.sequelize.literal(rawDistancesFunc('car'));
          rawDistancesFunc();
        }
      } else {
        if (city) {
          await calculateDistance.CreateOrReplaceCalculateDistance();
          const rawDistancesFunc = (tableName = 'Car') => {
            const calDistance = `(SELECT calculate_distance(${city.latitude}, ${city.longitude}, (SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude"), (SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude"), 'K'))`;
            rawDistances = calDistance;
            return calDistance;
          };

          Object.assign(carCustomFields, {
            latitude: city.latitude,
            longitude: city.longitude
          });

          distances = models.sequelize.literal(rawDistancesFunc('car'));
          rawDistancesFunc();
        }
      }
      carFields.push('distance');
      upperCase = false;
      order = [
        [
          { model: models.Model, as: 'model' },
          { model: models.GroupModel, as: 'groupModel' },
          { model: models.Brand, as: 'brand' },
          'name',
          sort
        ]
      ];
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

  let whereQuery = ' AND ("Car"."status" = 0 OR "Car"."status" = 1) AND "Car"."deletedAt" IS NULL';
  const whereInclude = { [Op.or]: [{ status: 0 }, { status: 1 }] };

  // Search by City, Subdistrict/Area without Radius
  if (by === 'area' && !radius) {
    if (cityId) {
      const city = await models.City.findByPk(cityId);
      if (!city) {
        return res.status(400).json({
          success: false,
          errors: 'City not found!'
        });
      }

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
          Object.assign(whereInclude, {
            cityId,
            subdistrictId
          });

          whereQuery += ` AND "Car"."cityId" = ${cityId} AND "Car"."subdistrictId" = ${subdistrictId}`;

          Object.assign(carCustomFields, {
            latitude: subdistrict.latitude,
            longitude: subdistrict.longitude
          });
        }
      } else {
        if (city) {
          Object.assign(whereInclude, {
            cityId
          });

          whereQuery += ` AND "Car"."cityId" = ${cityId}`;

          Object.assign(carCustomFields, {
            latitude: city.latitude,
            longitude: city.longitude
          });
        }
      }
      carFields.push('distance');
      upperCase = false;
      order = [
        [
          { model: models.Model, as: 'model' },
          { model: models.GroupModel, as: 'groupModel' },
          { model: models.Brand, as: 'brand' },
          'name',
          sort
        ]
      ];
    } else {
      return res.status(400).json({
        success: false,
        errors: 'Please Select City!'
      });
    }
  }

  if (condition) {
    Object.assign(whereInclude, {
      condition: {
        [Op.eq]: condition
      }
    });

    whereQuery += ` AND "Car"."condition" = ${condition}`;
  }

  if (brandId) {
    Object.assign(whereInclude, {
      brandId: {
        [Op.eq]: brandId
      }
    });

    whereQuery += ` AND "Car"."brandId" = ${brandId}`;
  }

  if (modelId) {
    Object.assign(whereInclude, {
      modelId: {
        [Op.eq]: modelId
      }
    });

    whereQuery += ` AND "Car"."modelId" = ${modelId}`;
  }

  if (groupModelId) {
    Object.assign(whereInclude, {
      groupModelId: {
        [Op.eq]: groupModelId
      }
    });

    whereQuery += ` AND "Car"."groupModelId" = ${groupModelId}`;
  }

  if (minKm && maxKm) {
    Object.assign(whereInclude, {
      km: {
        [Op.and]: [{ [Op.gte]: minKm }, { [Op.lte]: maxKm }]
      }
    });

    whereQuery += ` AND ("Car"."km" >= ${minKm} AND "Car"."km" <= ${maxKm})`;
  }

  if (minPrice && maxPrice) {
    Object.assign(whereInclude, {
      price: {
        [Op.and]: [{ [Op.gte]: minPrice }, { [Op.lte]: maxPrice }]
      }
    });

    whereQuery += ` AND ("Car"."price" >= ${minPrice} AND "Car"."price" <= ${maxPrice})`;
  }

  if (by === 'highestBidder') {
    const highestBidder = `(SELECT "Bargains"."carId" FROM "Bargains" LEFT JOIN "Cars" as "Car" ON "Bargains"."carId" = "Car"."id" WHERE "Car"."modelYearId" = "ModelYear"."id"  AND "Bargains"."deletedAt" IS NULL  AND "Bargains"."bidType" = 0 ORDER BY "Bargains"."bidAmount" DESC LIMIT 1)`;

    Object.assign(whereInclude, {
      id: {
        [Op.eq]: models.sequelize.literal(highestBidder)
      }
    });

    whereQuery += ` AND ("Car"."id" = ${highestBidder})`;
  }

  if (by === 'location' || by === 'area' && radius) {
    Object.assign(whereInclude, {
      [Op.and]: [models.sequelize.where(distances, { [Op.lte]: radius })]
    });

    whereQuery += ` AND ${rawDistances} <= ${radius}`;
  }

  if (typeId) {
    const groupModelExist = tableName => {
      return `EXISTS(SELECT "GroupModels"."typeId" FROM "GroupModels" WHERE "GroupModels"."id" = "${tableName}"."groupModelId" AND "GroupModels"."typeId" = ${typeId} AND "GroupModels"."deletedAt" IS NULL)`;
    };

    Object.assign(whereInclude, {
      [Op.and]: models.sequelize.literal(groupModelExist('car'))
    });

    whereQuery += ` AND ${groupModelExist('Car')}`;
  }

  // HARUS diatas return
  const countCar = models.sequelize.literal(
    `(SELECT COUNT("Car"."id") FROM "Cars" as "Car" WHERE "Car"."modelYearId" = "ModelYear"."id" AND "Car"."deletedAt" IS NULL ${whereQuery})`
  );

  if (by === 'like') {
    modelCarName = 'Car';
    upperCase = true;
  }

  Object.assign(where, {
    [Op.and]: [models.sequelize.where(countCar, { [Op.gte]: 1 })]
  });

  const addAttribute = await carHelper.customFields({
    fields: [
      'numberOfCar',
      'maxPrice',
      'minPrice',
      'numberOfBidderModelYear',
      'highestBidderModelYear',
      'highestBidderCarId',
      'purchase'
    ],
    whereQuery
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

  Object.assign(carCustomFields, {
    fields: carFields,
    upperCase
  });

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
        separate,
        order: orderCar,
        attributes: {
          include: await carHelper.customFields(carCustomFields)
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
            separate,
            order: orderCar,
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
      console.log(err)
      res.status(422).json({
        success: false,
        errors: err.message
      });
    });
});

router.get('/listingAllNew', async (req, res) => {
  let { page, limit, by, sort } = req.query;
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
    subdistrictId
  } = req.query;
  let { radius, latitude, longitude } = req.query;
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
    'brand;',
    'area'
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
    case 'km':
      order.push([
        { model: models.ModelYear, as: 'modelYears' },
        { model: models.Car, as: 'cars' },
        by,
        sort
      ]);
      break;
    case 'profile':
      order.push([{ model: models.User, as: 'user' }, 'type', sort]);
      break;
    case 'location':
      // Search By Location (Latitude, Longitude & Radius)
      if (by === 'location') {
        if (!latitude)
          return res.status(400).json({ success: false, errors: 'Latitude not found!' });
        if (!longitude)
          return res.status(400).json({ success: false, errors: 'Longitude not found!' });
        if (!radius) return res.status(400).json({ success: false, errors: 'Radius not found!' });

        await calculateDistance.CreateOrReplaceCalculateDistance();
        const rawDistancesFunc = (tableName = 'Car') => {
          const calDistance = `(SELECT calculate_distance(${latitude}, ${longitude}, (SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude"), (SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude"), 'K'))`;
          rawDistances = calDistance;
          return calDistance;
        };

        distances = models.sequelize.literal(rawDistancesFunc('modelYears->cars'));
        rawDistancesFunc();

        orderCar.push([Sequelize.literal(`"modelYears.cars.distance" ${sort}`)]);
      }
      break;
    case 'area':
      // Search by City, Subdistrict/Area & Radius
      // if (!radius) return res.status(400).json({ success: false, errors: 'Radius not found!' });
      if (cityId && (radius && radius[0] >= 0 && radius[1] > 0)) {
        const city = await models.City.findByPk(cityId);
        if (!city) return res.status(400).json({ success: false, errors: 'City not found!' });

        if (subdistrictId) {
          const subdistrict = await models.SubDistrict.findOne({
            where: { id: subdistrictId, cityId }
          });
          if (!subdistrict)
            return res.status(400).json({ success: false, errors: 'Subdistrict not found!' });

          if (city && subdistrict) {
            await calculateDistance.CreateOrReplaceCalculateDistance();
            const rawDistancesFunc = (tableName = 'Car') => {
              const calDistance = `(SELECT calculate_distance(${subdistrict.latitude}, ${subdistrict.longitude}, (SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude"), (SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude"), 'K'))`;
              rawDistances = calDistance;
              return calDistance;
            };
            latitude = subdistrict.latitude;
            longitude = subdistrict.longitude;

            distances = models.sequelize.literal(rawDistancesFunc('modelYears->cars'));
            rawDistancesFunc();

            orderCar.push([Sequelize.literal(`"modelYears.cars.distance" ${sort}`)]);
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

            distances = models.sequelize.literal(rawDistancesFunc('modelYears->cars'));
            rawDistancesFunc();

            orderCar.push([Sequelize.literal(`"modelYears.cars.distance" ${sort}`)]);
          }
        }
      } else if(!cityId) {
        return res.status(400).json({ success: false, errors: 'Please Select City!' });
      }
      break;
    default:
      order.push([by, sort]);
      break;
  }

  let required = false;
  const where = {};
  let whereQuery = ' AND ("Car"."status" = 0 OR "Car"."status" = 1) AND "Car"."deletedAt" IS NULL';
  if (id) Object.assign(where, { id });

  if (radius) {
    if (radius.length < 2)
      return res.status(422).json({ success: false, errors: 'incomplete radius' });

    if(radius[0] >= 0 && radius[1] > 0) {
      await calculateDistance.CreateOrReplaceCalculateDistance();
      const rawDistancesFunc = (tableName = 'Car') => {
        const calDistance = `(SELECT calculate_distance(${latitude}, ${longitude}, (SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude"), (SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude"), 'K'))`;
        rawDistances = calDistance;
        return calDistance;
      };

      distances = models.sequelize.literal(rawDistancesFunc('modelYears->cars'));
      rawDistancesFunc();
    }
  }

  const whereModelYear = {};
  if (minYear && maxYear)
    Object.assign(whereModelYear, {
      year: { [Op.and]: [{ [Op.gte]: minYear }, { [Op.lte]: maxYear }] }
    });

  const whereCar = { [Op.or]: [{ status: 0 }, { status: 1 }] };

  switch(by) {
    case 'area':
      // Search by City, Subdistrict/Area without Radius
      if(cityId && (!radius || (radius && radius[0] == 0 && radius[1] == ''))) {
        const city = await models.City.findByPk(cityId);
        if (!city) return res.status(400).json({ success: false, errors: 'City not found!' });

        if (subdistrictId) {
          const subdistrict = await models.SubDistrict.findOne({
            where: { id: subdistrictId, cityId }
          });
          if (!subdistrict)
            return res.status(400).json({ success: false, errors: 'Subdistrict not found!' });

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
      } else if(!cityId) {
        return res.status(400).json({ success: false, errors: 'Please Select City!' });
      }
    break;
  }

  if (condition) {
    Object.assign(whereCar, { condition });
    required = true;
    whereQuery += ` AND "Car"."condition" = ${condition}`;
  }

  const whereBrand = {};
  if (brandId) {
    Object.assign(whereBrand, { id: brandId });
    required = true;
    whereQuery += ` AND "Car"."brandId" = ${brandId}`;
  }

  if (modelId) {
    Object.assign(whereCar, { modelId });
    required = true;
    whereQuery += ` AND "Car"."modelId" = ${modelId}`;
  }

  if (groupModelId) {
    Object.assign(whereCar, { groupModelId });
    required = true;
    whereQuery += ` AND "Car"."groupModelId" = ${groupModelId}`;
  }

  if (minKm && maxKm) {
    Object.assign(whereCar, { km: { [Op.and]: [{ [Op.gte]: minKm }, { [Op.lte]: maxKm }] } });
    required = true;

    whereQuery += ` AND ("Car"."km" >= ${minKm} AND "Car"."km" <= ${maxKm})`;
  }

  if (minPrice && maxPrice) {
    Object.assign(whereCar, {
      price: { [Op.and]: [{ [Op.gte]: minPrice }, { [Op.lte]: maxPrice }] }
    });
    required = true;

    whereQuery += ` AND ("Car"."price" >= ${minPrice} AND "Car"."price" <= ${maxPrice})`;
  }

  const whereGroupModel = {};
  if (typeId) {
    Object.assign(whereGroupModel, { typeId });

    // whereQuery += ` AND ${groupModelExist('Car')}`;
  }

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
    'subDistictId',
    'roomId',
    'oldPrice',
    'createdAt',
    'updatedAt',
    [
      models.sequelize.literal(
        `(SELECT MAX("Bargains"."bidAmount") FROM "Bargains" WHERE "Bargains"."carId" = "modelYears->cars"."id" AND "Bargains"."deletedAt" IS NULL AND "Bargains"."bidType" = 0)`
      ),
      'bidAmount'
    ],
    [
      models.sequelize.literal(
        `(SELECT COUNT("Bargains"."id") FROM "Bargains" WHERE "Bargains"."carId" = "modelYears->cars"."id" AND "Bargains"."deletedAt" IS NULL AND "Bargains"."bidType" = 0)`
      ),
      'numberOfBidder'
    ],
    [
      models.sequelize.literal(
        `(SELECT COUNT("Likes"."id") FROM "Likes" WHERE "Likes"."carId" = "modelYears->cars"."id" AND "Likes"."status" IS TRUE AND "Likes"."deletedAt" IS NULL)`
      ),
      'like'
    ],
    [
      models.sequelize.literal(
        `(SELECT COUNT("Views"."id") FROM "Views" WHERE "Views"."carId" = "modelYears->cars"."id" AND "Views"."deletedAt" IS NULL)`
      ),
      'view'
    ],
    [
      models.sequelize.literal(
        `(SELECT "GroupModels"."typeId" FROM "GroupModels" WHERE "GroupModels"."id" = "modelYears->cars"."groupModelId" AND "GroupModels"."deletedAt" IS NULL)`
      ),
      'groupModelTypeId'
    ],
    [
      models.sequelize.literal(`(SELECT split_part("modelYears->cars"."location", ',', 1))`),
      'latitude'
    ],
    [
      models.sequelize.literal(`(SELECT split_part("modelYears->cars"."location", ',', 2))`),
      'longitude'
    ]
  ];

  if (latitude && longitude && (radius && radius[0] >= 0 && radius[1] > 0)) {
    // Object.assign(whereCar, {
    //   where: {
    //     [Op.and]: [
    //       Sequelize.where(distances, { [Op.gte]: Number(radius[0]) }),
    //       Sequelize.where(distances, { [Op.lte]: Number(radius[1]) })
    //     ]
    //   }
    // });

    whereQuery += ` AND ${rawDistances} >= ${Number(radius[0])} AND ${rawDistances} <= ${Number(
      radius[1]
    )}`;

    attributeCar.push([
      models.sequelize.literal(
        `(SELECT calculate_distance(${latitude}, ${longitude}, (SELECT CAST(COALESCE(NULLIF((SELECT split_part("modelYears->cars"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude"), (SELECT CAST(COALESCE(NULLIF((SELECT split_part("modelYears->cars"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude"), 'K'))`
      ),
      'distance'
    ]);
  }

  let queryCountCar = `(SELECT COUNT("Car"."id") FROM "Cars" as "Car" WHERE "Car"."modelYearId" = "modelYears"."id" AND "Car"."deletedAt" IS NULL ${whereQuery})`;
  const whereCarNotNull = Sequelize.literal(`(${queryCountCar})`);
  Object.assign(whereModelYear, {
    whereModelYear: Sequelize.where(whereCarNotNull, { [Op.gt]: 0 })
  });

  // return res.status(200).json({ success: true, whereCar });
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
        include: [
          {
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
        include: [
          {
            required,
            model: models.Car,
            as: 'cars',
            separate,
            attributes: attributeCar,
            include: includeCar,
            where: whereCar,
            order: orderCar
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
      const count = await models.Model.count({ 
        include: [
          {
            model: models.GroupModel,
            as: 'groupModel',
            where: whereGroupModel,
            include: [
              {
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
            include: [
              {
                required,
                model: models.Car,
                as: 'cars',
                separate,
                include: includeCar,
                where: whereCar,
                order: orderCar
              }
            ]
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
    const groupModelExist = tableName => {
      return `EXISTS(SELECT "GroupModels"."typeId" 
        FROM "GroupModels" 
        WHERE "GroupModels"."id" = "${tableName}"."groupModelId" 
          AND "GroupModels"."typeId" = ${typeId} 
          AND "GroupModels"."deletedAt" IS NULL
      )`;
    };

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
        // include: await carHelper.extraInclude({ key: 'noModelYear' }),
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

async function listingCar(req, res, auth = false) {
  const userId = auth ? req.user.id : null;
  const {
    brandId,
    groupModelId,
    modelId,
    maxPrice,
    minPrice,
    condition,
    minKm,
    maxKm,
    minYear,
    maxYear,
    radius,
    cityId,
    subDistrictId,
    typeId
  } = req.query;
  let { latitude, longitude } = req.query;

  const { id } = req.params;
  let { page, limit, sort, by } = req.query;
  let offset = 0;
  let distances = {};

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  let order = [];
  if (!sort) sort = 'asc';
  else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';

  if (by === 'price' || by === 'id' || by === 'km' || by === 'condition') order = [[by, sort]];
  else if (by === 'like') order = [[models.sequelize.col('like'), sort]];
  else if (by === 'userType')
    order = [[{ model: models.User, as: 'user' }, models.sequelize.col('type'), sort]];
  else [['createdAt', 'desc']];

  // Search By Location (Latitude, Longitude & Radius)
  if (by === 'location') {
    if (!latitude) return res.status(400).json({ success: false, errors: 'Latitude not found!' });
    if (!longitude) return res.status(400).json({ success: false, errors: 'Longitude not found!' });
    if (!radius) return res.status(400).json({ success: false, errors: 'Radius not found!' });
  }

  // Search by City, Subdistrict/Area & Radius
  if (by === 'area') {
    // if (!radius) return res.status(400).json({ success: false, errors: 'Radius not found!' });
    if (!cityId && !subDistrictId)
      return res.status(422).json({ success: false, errors: 'invalid city or subDistrictId!' });
  }

  const where = { [Op.or]: [{ status: 0 }, { status: 1 }], modelYearId: id };
  const whereModelYear = {};

  if (radius) {
    if (!Array.isArray(radius))
      return res.status(422).json({ success: false, errors: 'invalid radius' });
    if (radius.length < 2)
      return res.status(422).json({ success: false, errors: 'incomplete radius' });

    if(radius[0] >= 0 && radius[1] > 0) {
      await calculateDistance.CreateOrReplaceCalculateDistance();
      const rawDistancesFunc = (tableName = 'Car') => {
        const calDistance = `(SELECT calculate_distance(${latitude}, ${longitude}, (SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude"), (SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude"), 'K'))`;
        rawDistances = calDistance;
        return calDistance;
      };

      distances = models.sequelize.literal(rawDistancesFunc('Car'));
      rawDistancesFunc();
    }
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

  if (minYear && maxYear) {
    Object.assign(whereModelYear, {
      year: { [Op.and]: [{ [Op.lte]: maxYear }, { [Op.gte]: minYear }] }
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

  if (cityId && (radius && radius[0] >= 0 && radius[1] > 0)) {
    // if (!radius) return res.status(422).json({ success: false, errors: 'radius not found' });
    if (radius.length < 2)
      return res.status(422).json({ success: false, errors: 'incomplete radius' });

    const city = await models.City.findByPk(cityId);
    if (!city) return res.status(400).json({ success: false, errors: 'City not found!' });

    await calculateDistance.CreateOrReplaceCalculateDistance();
    const rawDistances = `(SELECT calculate_distance(${city.latitude}, ${city.longitude}, (SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude"), (SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude"), 'K'))`;
    distances = models.sequelize.literal(rawDistances);
    latitude = city.latitude;
    longitude = city.longitude;
  } else if(cityId && (!radius || (radius && radius[0] == 0 && radius[1] == ''))) {
    const city = await models.City.findByPk(cityId);
    if (!city) return res.status(400).json({ success: false, errors: 'City not found!' });

    latitude = city.latitude;
    longitude = city.longitude;

    Object.assign(where, {
      cityId
    });
  }

  if (subDistrictId && (radius && radius[0] >= 0 && radius[1] > 0)) {
    // if (!radius) return res.status(422).json({ success: false, errors: 'radius not found' });
    if (radius.length < 2)
      return res.status(422).json({ success: false, errors: 'incomplete radius' });

    const whereSubDistrict = { id: subdistrictId };
    if (cityId) Object.assign(whereSubDistrict, { cityId });

    const subdistrict = await models.SubDistrict.findOne({ where: whereSubDistrict });
    if (!subdistrict)
      return res.status(400).json({ success: false, errors: 'Subdistrict not found!' });

    await calculateDistance.CreateOrReplaceCalculateDistance();
    const rawDistances = `(SELECT calculate_distance(${subdistrict.latitude}, ${subdistrict.longitude}, (SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude"), (SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude"), 'K'))`;
    distances = models.sequelize.literal(rawDistances);
    latitude = subdistrict.latitude;
    longitude = subdistrict.longitude;
  } else if (subDistrictId && (!radius || (radius && radius[0] == 0 && radius[1] == ''))) {
    const whereSubDistrict = { id: subdistrictId };
    if (cityId) Object.assign(whereSubDistrict, { cityId });

    const subdistrict = await models.SubDistrict.findOne({ where: whereSubDistrict });
    if (!subdistrict)
      return res.status(400).json({ success: false, errors: 'Subdistrict not found!' });

    latitude = subdistrict.latitude;
    longitude = subdistrict.longitude;

    Object.assign(where, {
      cityId,
      subdistrictId
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

  if ((by === 'location' || by === 'area') && radius) {
    // if (!radius) return res.status(422).json({ success: false, errors: 'invalid radius' });
    if (radius.length < 2)
      return res.status(422).json({ success: false, errors: 'incomplete radius' });
    if (!latitude) return res.status(400).json({ success: false, errors: 'Latitude not found!' });
    if (!longitude) return res.status(400).json({ success: false, errors: 'Longitude not found!' });

    // Object.assign(where, {
    //   [Op.and]: [models.sequelize.where(distances, { [Op.lte]: radius })]
    // });
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

  const carAttributes = {
    fields: ['like', 'view', 'numberOfBidder', 'highestBidder'],
    upperCase: true
  };

  if (userId) {
    carAttributes.fields.push('isLike');
    carAttributes.fields.push('isBid');
    carAttributes.fields.push('bidAmount');
    Object.assign(carAttributes, { id: userId });
  }

  if (latitude && longitude && (radius && radius[0] >= 0 && radius[1] > 0)) {
    carAttributes.fields.push('distance');
    Object.assign(carAttributes, { latitude, longitude, whereQuery: `` });

    Object.assign(where, {
      where: {
        [Op.and]: [
          Sequelize.where(distances, { [Op.gte]: Number(radius[0]) }),
          Sequelize.where(distances, { [Op.lte]: Number(radius[1]) })
        ]
      }
    });
    order = [[Sequelize.col(`distance`), sort]];
  }
  const carAttribute = await carHelper.customFields(carAttributes);

  // return res.status(200).json({ success: true, data: { order, carAttributes, where } });
  return models.Car.findAll({
    attributes: Object.keys(models.Car.attributes).concat(carAttribute),
    include: [
      {
        model: models.ModelYear,
        as: 'modelYear',
        where: whereModelYear,
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
        attributes: ['name', 'type', 'companyType'],
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
            where: whereModelYear
          }
        ],
        where
      });
      const pagination = paginator.paging(page, count, limit);

      res.status(200).json({
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

router.get('/listingCar/:id', async (req, res) => {
  return listingCar(req, res);
});

router.get(
  '/listingCarLogon/:id',
  passport.authenticate('user', { session: false }),
  async (req, res) => {
    return listingCar(req, res, true);
  }
);

// router.get(
//   '/listingCarLogon/:id',
//   passport.authenticate('user', { session: false }),
//   async (req, res) => {
//     const { by, year, maxPrice, minPrice, condition } = req.query;
//     const { id } = req.params;
//     const userId = await req.user.id;
//     let { page, limit, sort } = req.query;
//     let offset = 0;

//     if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
//     if (limit > MAX_LIMIT) limit = MAX_LIMIT;
//     if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
//     else page = 1;

//     let order = [['createdAt', 'desc']];
//     if (!sort) sort = 'asc';
//     else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';

//     if (by === 'price' || by === 'id' || by === 'km' || by === 'condition') order = [[by, sort]];
//     else if (by === 'like') order = [[models.sequelize.col('like'), sort]];
//     else if (by === 'userType')
//       order = [[{ model: models.User, as: 'user' }, models.sequelize.col('type'), sort]];

//     const where = {
//       [Op.or]: [{ status: 0 }, { status: 1 }],
//       modelYearId: id
//     };

//     const includeWhere = {};

//     if (year) {
//       Object.assign(includeWhere, {
//         year: {
//           [Op.eq]: year
//         }
//       });
//     }

//     if (condition) {
//       Object.assign(where, {
//         condition: {
//           [Op.eq]: condition
//         }
//       });
//     }

//     if (maxPrice && minPrice) {
//       Object.assign(where, {
//         price: {
//           [Op.and]: [{ [Op.lte]: maxPrice }, { [Op.gte]: minPrice }]
//         }
//       });
//     }

//     return models.Car.findAll({
//       attributes: Object.keys(models.Car.attributes).concat([
//         [
//           models.sequelize.literal(
//             `(SELECT COUNT("Likes"."id")
//               FROM "Likes"
//               WHERE "Likes"."carId" = "Car"."id"
//                 AND "Likes"."status" IS TRUE
//                 AND "Likes"."userId" = ${userId}
//                 AND "Likes"."deletedAt" IS NULL
//             )`
//           ),
//           'islike'
//         ],
//         [
//           models.sequelize.literal(
//             `(SELECT COUNT("Bargains"."id")
//               FROM "Bargains"
//               WHERE "Bargains"."userId" = ${userId}
//                 AND "Bargains"."carId" = "Car"."id"
//                 AND "Bargains"."expiredAt" >= (SELECT NOW())
//                 AND "Bargains"."deletedAt" IS NULL
//                 AND "Bargains"."bidType" = 0
//             )`
//           ),
//           'isBid'
//         ],
//         [
//           models.sequelize.literal(
//             `(SELECT COUNT("Likes"."id")
//               FROM "Likes"
//               WHERE "Likes"."carId" = "Car"."id"
//                 AND "Likes"."status" IS TRUE
//                 AND "Likes"."deletedAt" IS NULL
//             )`
//           ),
//           'like'
//         ],
//         [
//           models.sequelize.literal(
//             `(SELECT COUNT("Views"."id")
//               FROM "Views"
//               WHERE "Views"."carId" = "Car"."id"
//                 AND "Views"."deletedAt" IS NULL
//             )`
//           ),
//           'view'
//         ],
//         [
//           models.sequelize.literal(
//             `(SELECT COUNT("Bargains"."id")
//               FROM "Bargains"
//               WHERE "Bargains"."carId" = "Car"."id"
//                 AND "Bargains"."deletedAt" IS NULL
//                 AND "Bargains"."bidType" = 0
//             )`
//           ),
//           'numberOfBidder'
//         ],
//         [
//           models.sequelize.literal(
//             `(SELECT MAX("Bargains"."bidAmount")
//               FROM "Bargains"
//               WHERE "Bargains"."carId" = "Car"."id"
//                 AND "Bargains"."deletedAt" IS NULL
//                 AND "Bargains"."bidType" = 0
//             )`
//           ),
//           'highestBidder'
//         ],
//         [
//           models.sequelize.literal(
//             `(SELECT MAX("Bargains"."bidAmount")
//               FROM "Bargains"
//               WHERE "Bargains"."carId" = "Car"."id"
//                 AND "Bargains"."deletedAt" IS NULL
//                 AND "Bargains"."bidType" = 0
//                 AND "Bargains"."userId" = ${userId}
//             )`
//           ),
//           'bidAmount'
//         ]
//       ]),
//       include: [
//         {
//           model: models.ModelYear,
//           as: 'modelYear',
//           where: includeWhere,
//           include: [
//             {
//               model: models.Model,
//               as: 'model',
//               attributes: ['name'],
//               include: [
//                 {
//                   model: models.GroupModel,
//                   as: 'groupModel',
//                   attributes: ['name'],
//                   include: [
//                     {
//                       model: models.Brand,
//                       as: 'brand',
//                       attributes: ['name']
//                     }
//                   ]
//                 }
//               ]
//             }
//           ]
//         },
//         {
//           model: models.User,
//           as: 'user',
//           attributes: ['name', 'type', 'companyType'],
//           include: [
//             {
//               model: models.Purchase,
//               as: 'purchase',
//               attributes: {
//                 exclude: ['deletedAt']
//               },
//               order: [['id', 'desc']],
//               limit: 1
//             }
//           ]
//         },
//         {
//           model: models.Color,
//           as: 'interiorColor',
//           attributes: ['name']
//         },
//         {
//           model: models.Color,
//           as: 'exteriorColor',
//           attributes: ['name']
//         },
//         {
//           model: models.MeetingSchedule,
//           as: 'meetingSchedule',
//           attributes: ['id', 'carId', 'day', 'startTime', 'endTime']
//         },
//         {
//           model: models.InteriorGalery,
//           as: 'interiorGalery',
//           attributes: ['id', 'fileId', 'carId'],
//           include: [
//             {
//               model: models.File,
//               as: 'file',
//               attributes: {
//                 exclude: ['createdAt', 'updatedAt', 'deletedAt']
//               }
//             }
//           ]
//         },
//         {
//           model: models.ExteriorGalery,
//           as: 'exteriorGalery',
//           attributes: ['id', 'fileId', 'carId'],
//           include: [
//             {
//               model: models.File,
//               as: 'file',
//               attributes: {
//                 exclude: ['createdAt', 'updatedAt', 'deletedAt']
//               }
//             }
//           ]
//         },
//         {
//           required: false,
//           model: models.Bargain,
//           as: 'bargain',
//           attributes: ['id', 'userId', 'carId', 'haveSeenCar', 'paymentMethod', 'expiredAt'],
//           where: {
//             userId
//           },
//           limit: 1,
//           order: [['id', 'desc']]
//         }
//       ],
//       where,
//       order,
//       offset,
//       limit
//     })
//       .then(async data => {
//         const count = await models.Car.count({
//           include: [
//             {
//               model: models.ModelYear,
//               as: 'modelYear',
//               where: includeWhere
//             }
//           ],
//           where
//         });
//         const pagination = paginator.paging(page, count, limit);

//         res.json({
//           success: true,
//           pagination,
//           data
//         });
//       })
//       .catch(err => {
//         res.status(422).json({
//           success: false,
//           errors: err.message
//         });
//       });
//   }
// );

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
        `(SELECT "Bargains"."carId" FROM "Bargains" LEFT JOIN "Cars" ON "Bargains"."carId" = "Cars"."id" WHERE "Cars"."modelYearId" = "ModelYear"."id" AND "Bargains"."deletedAt" IS NULL ORDER BY "Bargains"."bidAmount" DESC LIMIT 1
        )`
      )
    }
  });

  const addAttribute = await carHelper.customFields({
    fields: [
      'numberOfBidderModelYear',
      'highestBidderModelYear',
      'numberOfCar',
      'maxPrice',
      'minPrice',
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
        where: whereInclude,
        order: [['bidAmount', 'desc']],
        attributes: {
          include: await carHelper.customFields({
            fields: ['bidAmountModelYears', 'numberOfBidder', 'like', 'view']
          })
        },
        // include: await carHelper.extraInclude({ key: 'noModelYear' })
        include: includeCar
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
