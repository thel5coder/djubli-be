/* eslint-disable no-restricted-globals */
/* eslint-disable linebreak-style */
const express = require('express');
const validator = require('validator');
const Sequelize = require('sequelize');
const { QueryTypes } = require('sequelize');
const passport = require('passport');
const models = require('../db/models');
const paginator = require('../helpers/paginator');
const carHelper = require('../helpers/car');
const general = require('../helpers/general');
const distanceHelper = require('../helpers/distance');

const { Op } = Sequelize;

const DEFAULT_LIMIT = process.env.DEFAULT_LIMIT || 10;
const MAX_LIMIT = process.env.MAX_LIMIT || 50;

async function listingAll(req, res) {
  let { page, limit, sort, by } = req.query;
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
    typeId,
    isMarket
  } = req.query;

  let offset = 0;
  const countDataPage = 0;
  let distances = {};
  let rawDistances = '';

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (parseInt(limit) > MAX_LIMIT) limit = MAX_LIMIT;
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

    const rawDistancesFunc = (tableName = 'Car') => {
      const queryLatitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude")`;
      const queryLongitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude")`;
      const calDistance = distanceHelper.calculate(
        latitude,
        longitude,
        queryLatitude,
        queryLongitude
      );

      rawDistances = calDistance;
      return calDistance;
    };

    distances = models.sequelize.literal(rawDistancesFunc('Car'));
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
          const rawDistancesFunc = (tableName = 'Car') => {
            const queryLatitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude")`;
            const queryLongitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude")`;
            const calDistance = distanceHelper.calculate(
              subdistrict.latitude,
              subdistrict.longitude,
              queryLatitude,
              queryLongitude
            );

            rawDistances = calDistance;
            return calDistance;
          };

          Object.assign(carCustomFields, {
            latitude: subdistrict.latitude,
            longitude: subdistrict.longitude
          });

          distances = models.sequelize.literal(rawDistancesFunc('Car'));
        }
      } else if (city) {
        const rawDistancesFunc = (tableName = 'Car') => {
          const queryLatitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude")`;
          const queryLongitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude")`;
          const calDistance = distanceHelper.calculate(
            city.latitude,
            city.longitude,
            queryLatitude,
            queryLongitude
          );

          rawDistances = calDistance;
          return calDistance;
        };

        Object.assign(carCustomFields, {
          latitude: city.latitude,
          longitude: city.longitude
        });

        distances = models.sequelize.literal(rawDistancesFunc('Car'));
      }

      carFields.push('distance');
      upperCase = true;
      order = [
        [
          { model: models.Model, as: 'model' },
          { model: models.GroupModel, as: 'groupModel' },
          { model: models.Brand, as: 'brand' },
          'name',
          sort
        ]
      ];

      separate = true;
      orderCar = [[Sequelize.col(`distance`), sort]];
    } else {
      return res.status(400).json({
        success: false,
        errors: 'Please Select City!'
      });
    }
  }

  let whereQuery = '';
  const whereInclude = {};
  const where = {};
  if (minYear && maxYear) {
    Object.assign(where, {
      year: {
        [Op.and]: [{ [Op.gte]: minYear }, { [Op.lte]: maxYear }]
      }
    });
  }

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

          whereQuery += ` AND "Car"."cityId" = ${cityId} 
            AND "Car"."subdistrictId" = ${subdistrictId}`;
          Object.assign(carCustomFields, {
            latitude: subdistrict.latitude,
            longitude: subdistrict.longitude
          });
        }
      } else if (city) {
        Object.assign(whereInclude, {
          cityId
        });

        whereQuery += ` AND "Car"."cityId" = ${cityId}`;
        Object.assign(carCustomFields, {
          latitude: city.latitude,
          longitude: city.longitude
        });
      }

      carFields.push('distance');
      upperCase = true;
      order = [
        [
          { model: models.Model, as: 'model' },
          { model: models.GroupModel, as: 'groupModel' },
          { model: models.Brand, as: 'brand' },
          'name',
          sort
        ]
      ];

      separate = true;
      orderCar = [[Sequelize.col(`distance`), sort]];
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

    whereQuery += ` AND ("Car"."km" >= ${minKm} 
      AND "Car"."km" <= ${maxKm})`;
  }

  if (minPrice && maxPrice) {
    Object.assign(whereInclude, {
      price: {
        [Op.and]: [{ [Op.gte]: minPrice }, { [Op.lte]: maxPrice }]
      }
    });

    whereQuery += ` AND ("Car"."price" >= ${minPrice} 
      AND "Car"."price" <= ${maxPrice})`;
  }

  if (by === 'highestBidder') {
    const highestBidder = await carHelper.customFields({
      fields: ['highestBidderCarId']
    });

    Object.assign(whereInclude, {
      id: {
        [Op.eq]: highestBidder[0][0]
      }
    });

    whereQuery += ` AND ("Car"."id" = ${highestBidder[0][0].val})`;
  }

  if (by === 'location' || (by === 'area' && radius)) {
    Object.assign(whereInclude, {
      [Op.and]: [models.sequelize.where(distances, { [Op.lte]: radius })]
    });

    whereQuery += ` AND ${rawDistances} <= ${radius}`;
  }

  if (typeId) {
    const groupModelExist = tableName =>
      `EXISTS(SELECT "GroupModels"."typeId" FROM "GroupModels" WHERE "GroupModels"."id" = "${tableName}"."groupModelId" AND "GroupModels"."typeId" = ${typeId} AND "GroupModels"."deletedAt" IS NULL)`;

    Object.assign(whereInclude, {
      [Op.and]: models.sequelize.literal(groupModelExist('car'))
    });

    whereQuery += ` AND ${groupModelExist('Car')}`;
  }

  // HARUS diatas return
  const countCar = models.sequelize.literal(
    `(SELECT COUNT("Car"."id") 
      FROM "Cars" as "Car" 
      WHERE "Car"."modelYearId" = "ModelYear"."id" 
        AND "Car"."deletedAt" IS NULL ${whereQuery}
    )`
  );

  if (by === 'like') {
    modelCarName = 'Car';
    upperCase = true;
  }

  Object.assign(where, {
    [Op.and]: [
      models.sequelize.where(countCar, {
        [Op.gte]: 0
      })
    ]
  });

  if (isMarket && JSON.parse(isMarket) == true) {
    Object.assign(whereInclude, {
      status: 2
    });

    whereQuery += ' AND "Car"."status" = 2 AND "Car"."deletedAt" IS NULL';
  } else {
    Object.assign(whereInclude, {
      status: {
        [Op.in]: [0, 1]
      }
    });

    whereQuery += ' AND "Car"."status" IN (0,1) ';
  }

  const addAttribute = await carHelper.customFields({
    fields: [
      'numberOfPurchase',
      'lastPurchaseAmount',
      'numberOfCar',
      'maxPrice',
      'minPrice',
      'numberOfBidderModelYear',
      'highestBidderModelYear',
      'highestBidderCarId'
    ],
    whereQuery
  });

  if (by === 'numberOfCar') {
    Object.assign(whereInclude, {
      [Op.and]: models.sequelize.where(addAttribute[2][0], { [Op.gt]: 0 })
    });
  }

  if (isMarket && JSON.parse(isMarket) == true) {
    Object.assign(where, {
      [Op.and]: models.sequelize.where(addAttribute[0][0], { [Op.gt]: 0 })
    });
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
      console.log(err);
      res.status(422).json({
        success: false,
        errors: err.message
      });
    });
}

async function listingAllNewRefactor(req, res, fromCallback = false) {
  const { page, limit } = req.query;

  const {
    brandId,
    groupModelId,
    modelId,
    exteriorColorId,
    interiorColorId,
    cityId,
    subdistrictId,
    latitude,
    longitude,
    minRadius,
    maxRadius,
    condition,
    minPrice,
    maxPrice,
    minYear,
    maxYear,
    minKm,
    maxKm,
    typeId,
    isMarket
  } = req.query;

  const replacements = { bidType: 0 };
  let conditionString = ``;
  let carDistance = ``;
  let carConditionString = ``;
  let distanceJoin = ``;
  if (brandId) {
    conditionString += ` AND b."id" = :brandId`;
    Object.assign(replacements, { brandId });
    carConditionString += ` AND "brandId" = ${brandId}`;
  }
  if (groupModelId) {
    conditionString += ` AND gm."id" = :groupModelId`;
    Object.assign(replacements, { groupModelId });
    carConditionString += ` AND "groupModelId" = ${groupModelId}`;
  }
  if (typeId) {
    conditionString += ` AND gm."typeId" = :typeId`;
    Object.assign(replacements, { typeId });
  }
  if (modelId) {
    conditionString += ` AND m."id" = :modelId`;
    Object.assign(replacements, { modelId });
    carConditionString += ` AND "modelId" = ${modelId}`;
  }
  if (exteriorColorId) {
    conditionString += ` AND c."exteriorColorId" = :exteriorColorId`;
    Object.assign(replacements, { exteriorColorId });
    carConditionString += ` AND "exteriorColorId" = ${exteriorColorId}`;
  }
  if (interiorColorId) {
    conditionString += ` AND c."interiorColorId" = :interiorColorId`;
    Object.assign(replacements, { interiorColorId });
    carConditionString += ` AND "interiorColorId" = ${interiorColorId}`;
  }
  if (cityId) {
    conditionString += ` AND c."cityId" = :cityId`;
    Object.assign(replacements, { cityId });
  }
  if (subdistrictId) {
    conditionString += ` AND c."subdistrictId" = :subdistrictId`;
    Object.assign(replacements, { subdistrictId });
  }
  if (isMarket === 'true') {
    conditionString += ` AND c."status" = :carStatus`;
    Object.assign(replacements, { carStatus: 2 });
    carConditionString += ` AND "status" = 2`;
  } else {
    conditionString += ` AND (c."status" = :carStatus0 OR c."status" = :carStatus1) AND lc."id" IS NULL`;
    Object.assign(replacements, { carStatus0: 0, carStatus1: 1 });
    carConditionString += ` AND ("status" = 0 OR "status" = 1)`;
  }
  if (
    !isNaN(latitude) &&
    !isNaN(longitude) &&
    !isNaN(minRadius) &&
    !isNaN(maxRadius) &&
    !cityId &&
    !subdistrictId
  ) {
    carDistance = `, car_distance AS (
    select id, ( 6371.8 * acos( cos( radians(${latitude}) ) * cos( radians(
        CASE WHEN location = '' THEN 0 ELSE CAST(SPLIT_PART(location, ',', 1) AS DOUBLE PRECISION) END
      ) ) * cos( radians(
        CASE WHEN location = '' THEN 0 ELSE CAST(SPLIT_PART(location, ',', 2) AS DOUBLE PRECISION) END
      ) - radians(${longitude}) ) + sin( radians(${latitude}) ) * sin( radians(
        CASE WHEN location = '' THEN 0 ELSE CAST(SPLIT_PART(location, ',', 1) AS DOUBLE PRECISION) END
      ) ) ) ) * 0.8 * 1.60934 AS distance
    from "Cars" where "deletedAt" IS NULL ${carConditionString})`;
    distanceJoin = ` LEFT JOIN car_distance cd ON cd.id = c.id `;
    conditionString += ` AND cd.distance >= :minRadius AND cd.distance <= :maxRadius`;
    Object.assign(replacements, { minRadius, maxRadius });
  }
  if (condition) {
    conditionString += ` AND c."condition" = :condition`;
    Object.assign(replacements, { condition });
  }
  if (minPrice) {
    conditionString += ` AND c."price" >= :minPrice`;
    Object.assign(replacements, { minPrice });
  }
  if (maxPrice) {
    conditionString += ` AND c."price" <= :maxPrice`;
    Object.assign(replacements, { maxPrice });
  }
  if (minYear) {
    conditionString += ` AND my."year" >= :minYear`;
    Object.assign(replacements, { minYear });
  }
  if (maxYear) {
    conditionString += ` AND my."year" <= :maxYear`;
    Object.assign(replacements, { maxYear });
  }
  if (minKm) {
    conditionString += ` AND c."km" >= :minKm`;
    Object.assign(replacements, { minKm });
  }
  if (maxKm) {
    conditionString += ` AND c."km" <= :maxKm`;
    Object.assign(replacements, { maxKm });
  }

  const data = await models.sequelize
    .query(
      `with purchase as (
      SELECT c."modelYearId", MAX(p1."id") AS id
      FROM "Purchases" p1
      LEFT JOIN "Cars" c ON c."id" = p1."carId" AND c."deletedAt" IS NULL
      WHERE p1."deletedAt" IS NULL
      GROUP BY c."modelYearId"
    ), loan_cars AS (
      SELECT "id", "carId" FROM "Bargains" WHERE "deletedAt" IS NULL AND "negotiationType" IN (4,8)
    ) ${carDistance}
    
    select my.id, my."modelId", my.year, CONCAT ('${process.env.HDRIVE_S3_BASE_URL}',my.picture) AS "modelYearPicture",
    my.price, m."name" AS "modelName", m."groupModelId", gm."name" AS "groupModelName",
    gm."brandId", b."name" AS "brandName",
    CONCAT ('${process.env.HDRIVE_S3_BASE_URL}',b."logo") AS "brandLogo", pur."price",
    count(DISTINCT(c."id")) as "listing", count(DISTINCT(b2."id")) as "countBid", max(b2."bidAmount" ) as "highestBid",
    AVG(pur."price") as "marketPrice"
    from "ModelYears" my
    left join "Models" m on m."id" = my."modelId"
    left join "GroupModels" gm on gm."id" = m."groupModelId"
    left join "Brands" b on b."id" = gm."brandId"
    left join "Cars" c on c."modelYearId" = my."id" AND c."deletedAt" IS NULL
    left join "Bargains" b2 on b2."carId" = c."id" and b2."bidType" = 0 AND b2."deletedAt" IS NULL
    LEFT JOIN purchase p ON p."modelYearId" = my."id"
    LEFT JOIN "Purchases" pur ON pur.id = p.id AND pur."deletedAt" IS NULL
    LEFT JOIN "loan_cars" lc ON lc."carId" = c.id
    ${distanceJoin}
    WHERE my."deletedAt" IS NULL ${conditionString}
    group by my."id", m."name", m."groupModelId", gm."name", gm."brandId", b."name", b."logo", pur.price
    order by m."name", my."year";
    `,
      {
        replacements,
        type: QueryTypes.SELECT
      }
    )
    .catch(err => {
      res.status(422).json({
        success: false,
        errors: err.message
      });
    });

  res.json({
    success: true,
    meta: req.query,
    data
  });
}

async function countAllNewRefactor(req, res, fromCallback = false) {
  const {
    brandId,
    groupModelId,
    modelId,
    exteriorColorId,
    interiorColorId,
    cityId,
    subdistrictId,
    latitude,
    longitude,
    minRadius,
    maxRadius,
    condition,
    minPrice,
    maxPrice,
    minYear,
    maxYear,
    minKm,
    maxKm,
    typeId,
    isMarket
  } = req.query;

  const replacements = { bidType: 0 };
  let conditionString = ``;
  let carDistance = ``;
  let carConditionString = ``;
  let distanceJoin = ``;
  if (brandId) {
    conditionString += ` AND c."brandId" = :brandId`;
    Object.assign(replacements, { brandId });
    carConditionString += ` AND "brandId" = ${brandId}`;
  }
  if (groupModelId) {
    conditionString += ` AND c."groupModelId" = :groupModelId`;
    Object.assign(replacements, { groupModelId });
    carConditionString += ` AND "groupModelId" = ${groupModelId}`;
  }
  if (modelId) {
    conditionString += ` AND c."modelId" = :modelId`;
    Object.assign(replacements, { modelId });
    carConditionString += ` AND "modelId" = ${modelId}`;
  }
  if (typeId) {
    conditionString += ` AND gm."typeId" = :typeId`;
    Object.assign(replacements, { typeId });
  }
  if (exteriorColorId) {
    conditionString += ` AND c."exteriorColorId" = :exteriorColorId`;
    Object.assign(replacements, { exteriorColorId });
    carConditionString += ` AND "exteriorColorId" = ${exteriorColorId}`;
  }
  if (interiorColorId) {
    conditionString += ` AND c."interiorColorId" = :interiorColorId`;
    Object.assign(replacements, { interiorColorId });
    carConditionString += ` AND "interiorColorId" = ${interiorColorId}`;
  }
  if (cityId) {
    conditionString += ` AND c."cityId" = :cityId`;
    Object.assign(replacements, { cityId });
  }
  if (subdistrictId) {
    conditionString += ` AND c."subdistrictId" = :subdistrictId`;
    Object.assign(replacements, { subdistrictId });
  }
  if (isMarket === 'true') {
    conditionString += ` AND c."status" = :carStatus`;
    Object.assign(replacements, { carStatus: 2 });
    carConditionString += ` AND "status" = 2`;
  } else {
    conditionString += ` AND (c."status" = :carStatus0 OR c."status" = :carStatus1)`;
    Object.assign(replacements, { carStatus0: 0, carStatus1: 1 });
    carConditionString += ` AND ("status" = 0 OR "status" = 1)`;
  }

  if (
    !isNaN(latitude) &&
    !isNaN(longitude) &&
    !isNaN(minRadius) &&
    !isNaN(maxRadius) &&
    !cityId &&
    !subdistrictId
  ) {
    carDistance = `, car_distance AS (
    select id, ( 6371.8 * acos( cos( radians(${latitude}) ) * cos( radians(
        CASE WHEN location = '' THEN 0 ELSE CAST(SPLIT_PART(location, ',', 1) AS DOUBLE PRECISION) END
      ) ) * cos( radians(
        CASE WHEN location = '' THEN 0 ELSE CAST(SPLIT_PART(location, ',', 2) AS DOUBLE PRECISION) END
      ) - radians(${longitude}) ) + sin( radians(${latitude}) ) * sin( radians(
        CASE WHEN location = '' THEN 0 ELSE CAST(SPLIT_PART(location, ',', 1) AS DOUBLE PRECISION) END
      ) ) ) ) * 0.8 * 1.60934 AS distance
    from "Cars" where "deletedAt" IS NULL ${carConditionString})`;
    distanceJoin = ` LEFT JOIN car_distance cd ON cd.id = c.id `;
    conditionString += ` AND cd.distance >= :minRadius AND cd.distance <= :maxRadius`;
    Object.assign(replacements, { minRadius, maxRadius });
  }
  if (condition) {
    conditionString += ` AND c."condition" = :condition`;
    Object.assign(replacements, { condition });
  }
  if (minPrice) {
    conditionString += ` AND c."price" >= :minPrice`;
    Object.assign(replacements, { minPrice });
  }
  if (maxPrice) {
    conditionString += ` AND c."price" <= :maxPrice`;
    Object.assign(replacements, { maxPrice });
  }
  if (minYear) {
    conditionString += ` AND my."year" >= :minYear`;
    Object.assign(replacements, { minYear });
  }
  if (maxYear) {
    conditionString += ` AND my."year" <= :maxYear`;
    Object.assign(replacements, { maxYear });
  }
  if (minKm) {
    conditionString += ` AND c."km" >= :minKm`;
    Object.assign(replacements, { minKm });
  }
  if (maxKm) {
    conditionString += ` AND c."km" <= :maxKm`;
    Object.assign(replacements, { maxKm });
  }

  const data = await models.sequelize
    .query(
      `WITH loan_cars AS (
        SELECT "id", "carId" FROM "Bargains" WHERE "deletedAt" IS NULL AND "negotiationType" IN (4,8)
      ) ${carDistance}
    
      select count(DISTINCT(c.*)), min(c.price) AS "minPrice", max(c.price) AS "maxPrice",
      min(c.km) AS "minKm", max(c.km) AS "maxKm",
      min(my.year) AS "minYear", max(my.year) AS "maxYear"
        from "Cars" c
        LEFT JOIN "ModelYears" my ON my."id" = c."modelYearId"
        LEFT JOIN "GroupModels" gm ON gm."id" = c."groupModelId"
        LEFT JOIN "loan_cars" lc ON lc."carId" = c.id
        ${distanceJoin}
      WHERE c."deletedAt" IS NULL ${conditionString}`,
      {
        replacements,
        type: QueryTypes.SELECT
      }
    )
    .catch(err => {
      res.status(422).json({
        success: false,
        errors: err.message
      });
    });

  if (data.length === 0) {
    res.status(422).json({
      success: false,
      errors: 'Empty Data'
    });
  }

  res.json({
    success: true,
    meta: req.query,
    data: data[0]
  });
}

async function listingAllNew(req, res, fromCallback = false) {
  let { page, limit, by, sort } = req.query;
  let { radius, latitude, longitude } = req.query;
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
    interiorColorId,
    isMarket
  } = req.query;

  let offset = 0;
  let distances = {};
  let rawDistances = ``;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (parseInt(limit) > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  if (!by) by = 'id';
  if (!sort) sort = 'asc';
  else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';

  let tableCarName = 'modelYears->cars';
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
  const orderCar = [];
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
      order.push([
        Sequelize.literal(
          `"groupModel.brand.name" ${sort}, "groupModel.name" ${sort}, "name" ${sort}`
        )
      ]);
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
      order.push([
        {
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
      order.push([
        {
          model: models.User,
          as: 'user'
        },
        'type',
        sort
      ]);
      break;
    case 'distance':
      if (cityId) {
        const city = await models.City.findByPk(cityId);
        if (!city)
          return res.status(400).json({
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
        } else if (city) {
          latitude = city.latitude;
          longitude = city.longitude;
        }
      }

      separate = true;
      orderCar.push([Sequelize.literal(`"distance" ${sort}`)]);
      tableCarName = 'Car';
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
        if (!radius)
          return res.status(400).json({
            success: false,
            errors: 'Radius not found!'
          });

        const rawDistancesFunc = (tableName = 'Car') => {
          const queryLatitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude")`;
          const queryLongitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude")`;
          const calDistance = distanceHelper.calculate(
            latitude,
            longitude,
            queryLatitude,
            queryLongitude
          );
          rawDistances = calDistance;
          return calDistance;
        };

        distances = models.sequelize.literal(rawDistancesFunc('Car'));
        order.push([Sequelize.literal(`"groupModel.brand.name" ${sort}`)]);
      }
      break;
    case 'area':
      // Search by City, Subdistrict/Area & Radius
      if (cityId && radius && radius[0] >= 0 && radius[1] > 0) {
        const city = await models.City.findByPk(cityId);
        if (!city)
          return res.status(400).json({
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
            const rawDistancesFunc = (tableName = 'Car') => {
              const queryLatitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude")`;
              const queryLongitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude")`;
              const calDistance = distanceHelper.calculate(
                subdistrict.latitude,
                subdistrict.longitude,
                queryLatitude,
                queryLongitude
              );
              rawDistances = calDistance;
              return calDistance;
            };

            latitude = subdistrict.latitude;
            longitude = subdistrict.longitude;

            distances = models.sequelize.literal(rawDistancesFunc(tableCarName));
            order.push([Sequelize.literal(`"groupModel.brand.name" ${sort}`)]);
          }
        } else if (city) {
          const rawDistancesFunc = (tableName = 'Cars') => {
            const queryLatitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude")`;
            const queryLongitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude")`;
            const calDistance = distanceHelper.calculate(
              city.latitude,
              city.longitude,
              queryLatitude,
              queryLongitude
            );
            rawDistances = calDistance;
            return calDistance;
          };
          latitude = city.latitude;
          longitude = city.longitude;

          distances = models.sequelize.literal(rawDistancesFunc(tableCarName));
          order.push([Sequelize.literal(`"groupModel.brand.name" ${sort}`)]);
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
  let whereQuery = ' AND "Car"."deletedAt" IS NULL';

  if (id) {
    Object.assign(where, {
      id
    });
  }

  if (radius) {
    if (radius.length < 2)
      return res.status(422).json({
        success: false,
        errors: 'incomplete radius'
      });

    if (radius[0] >= 0 && radius[1] > 0) {
      const rawDistancesFunc = (tableName = 'Car') => {
        const queryLatitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude")`;
        const queryLongitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude")`;
        const calDistance = distanceHelper.calculate(
          latitude,
          longitude,
          queryLatitude,
          queryLongitude
        );

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
        [Op.and]: [
          {
            [Op.gte]: minYear
          },
          {
            [Op.lte]: maxYear
          }
        ]
      }
    });

  const whereCar = {};
  switch (by) {
    case 'area':
      // Search by City, Subdistrict/Area without Radius
      if (cityId && (!radius || (radius && radius[0] == 0 && radius[1] == ''))) {
        const city = await models.City.findByPk(cityId);
        if (!city) {
          return res.status(400).json({
            success: false,
            errors: 'City not found!'
          });
        }

        if (subdistrictId) {
          const subdistrict = await models.SubDistrict.findOne({
            where: {
              id: subdistrictId,
              cityId
            }
          });

          if (!subdistrict) {
            return res.status(400).json({
              success: false,
              errors: 'Subdistrict not found!'
            });
          }

          if (city && subdistrict) {
            Object.assign(whereCar, {
              cityId,
              subdistrictId
            });

            whereQuery += ` AND "Car"."cityId" = ${cityId} 
              AND "Car"."subdistrictId" = ${subdistrictId}`;
            latitude = subdistrict.latitude;
            longitude = subdistrict.longitude;
          }
        } else if (city) {
          Object.assign(whereCar, {
            cityId
          });

          whereQuery += ` AND "Car"."cityId" = ${cityId}`;
          latitude = city.latitude;
          longitude = city.longitude;
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
        [Op.and]: [
          {
            [Op.gte]: minKm
          },
          {
            [Op.lte]: maxKm
          }
        ]
      }
    });

    required = true;
    whereQuery += ` AND ("Car"."km" >= ${minKm} 
      AND "Car"."km" <= ${maxKm})`;
  }

  if (minPrice && maxPrice) {
    Object.assign(whereCar, {
      price: {
        [Op.and]: [
          {
            [Op.gte]: minPrice
          },
          {
            [Op.lte]: maxPrice
          }
        ]
      }
    });

    required = true;
    whereQuery += ` AND ("Car"."price" >= ${minPrice} 
      AND "Car"."price" <= ${maxPrice})`;
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
  }

  if (isMarket && JSON.parse(isMarket) == true) {
    Object.assign(whereModelYear, {
      [Op.and]: models.sequelize.literal(`
        (SELECT COUNT("Purchase"."id") 
          FROM "Purchases" as "Purchase" 
          LEFT JOIN "Cars" as "Car" 
            ON "Purchase"."carId" = "Car"."id" 
          WHERE "Car"."status" = 2 
            AND "Car"."modelYearId" = "modelYears"."id" 
            AND "Car"."deletedAt" IS NULL
        ) > 0
      `)
    });

    Object.assign(whereCar, {
      status: 2
    });

    whereQuery += ' AND "Car"."status" = 2';
  } else {
    Object.assign(whereCar, {
      status: {
        [Op.in]: [0, 1]
      }
    });

    whereQuery += ` AND "Car"."status" IN (0,1)`;
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

  const attributeCar = await carHelper.customFields({
    fields: [
      'bidAmount',
      'numberOfBidder',
      'like',
      'view',
      'groupModelTypeId',
      'latitude',
      'longitude'
    ],
    customCar: tableCarName
  });

  attributeCar.push(
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
    'updatedAt'
  );

  if (latitude && longitude) {
    if (radius && radius[0] >= 0 && radius[1] > 0) {
      Object.assign(whereCar, {
        [Op.and]: [
          models.sequelize.where(distances, {
            [Op.and]: {
              [Op.gte]: radius[0],
              [Op.lte]: radius[1]
            }
          })
        ]
      });

      whereQuery += ` AND ${rawDistances} >= ${Number(radius[0])} AND ${rawDistances} <= ${Number(
        radius[1]
      )}`;
    }

    const queryLatitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableCarName}"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude")`;
    const queryLongitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableCarName}"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude")`;
    attributeCar.push([
      models.sequelize.literal(
        distanceHelper.calculate(latitude, longitude, queryLatitude, queryLongitude)
      ),
      'distance'
    ]);
  }

  const queryCountCar = `(SELECT COUNT("Car"."id") FROM "Cars" as "Car" WHERE "Car"."modelYearId" = "modelYears"."id" AND "Car"."deletedAt" IS NULL ${whereQuery})`;
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

  const modelYearAttribute = await carHelper.customFields({
    fields: [
      'numberOfCar',
      'maxPrice',
      'minPrice',
      'numberOfBidderModelYear',
      'highestBidderModelYear',
      'highestBidderCarId',
      'purchase'
    ],
    whereQuery,
    upperCase: true,
    modelYearLowerCase: true,
    modelYearLowerCasePrefix: true
  });

  modelYearAttribute.push('id', 'modelId', 'year', 'picture', 'price', 'createdAt', 'updatedAt');

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
        attributes: modelYearAttribute,
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
              `(SELECT MAX("ModelYear"."year") 
                FROM "ModelYears" as "ModelYear" 
                INNER JOIN "Cars" as "Car" 
                  ON "ModelYear"."id" = "Car"."modelYearId" 
                WHERE "Car"."deletedAt" IS NULL
              )`
            ),
            'maxYear'
          ],
          [
            models.sequelize.literal(
              `(SELECT MIN("ModelYear"."year") 
                FROM "ModelYears" as "ModelYear" 
                INNER JOIN "Cars" as "Car" 
                  ON "ModelYear"."id" = "Car"."modelYearId" 
                WHERE "Car"."deletedAt" IS NULL
              )`
            ),
            'minYear'
          ]
        ],
        raw: true
      });

      if (fromCallback) {
        return data;
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

async function luxuryCar(req, res) {
  const { minPrice, maxPrice, condition } = req.query;
  const { by } = req.query;
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
  else if (by === 'numberOfCar') order = [[models.sequelize.col('numberOfCar'), sort]];

  const where = {};
  let whereQuery = '';
  const whereInclude = {
    status: {
      [Op.in]: [0, 1]
    }
  };

  if (minPrice && maxPrice) {
    Object.assign(whereInclude, {
      price: {
        [Op.and]: [{ [Op.gte]: minPrice }, { [Op.lte]: maxPrice }]
      }
    });

    whereQuery += ` AND "Car"."price" >= ${minPrice} AND "Car"."price" <= ${maxPrice}`;
  }

  if (condition) {
    Object.assign(whereInclude, {
      condition: {
        [Op.eq]: condition
      }
    });

    whereQuery += ` AND "Cars"."condition" = ${condition}`;
  }

  const addAttribute = await carHelper.customFields({
    fields: [
      'numberOfBidderModelYear',
      'highestBidderModelYear',
      'numberOfCar',
      'maxPrice',
      'minPrice',
      'highestBidderCarId',
      'numberOfPurchase'
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
}

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
    subdistrictId,
    typeId,
    exteriorColorId,
    interiorColorId,
    isSimilarId,
    isMarket
  } = req.query;
  let { latitude, longitude } = req.query;

  const { id } = req.params;
  let { page, limit, sort, by } = req.query;
  let offset = 0;
  let distances = {};

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (parseInt(limit) > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  if (!sort) sort = 'asc';
  else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';
  let order = [['createdAt', sort]];

  if (by === 'price' || by === 'id' || by === 'km' || by === 'condition') order = [[by, sort]];
  else if (by === 'like') order = [[models.sequelize.col('like'), sort]];
  else if (by === 'userType')
    order = [[{ model: models.User, as: 'user' }, models.sequelize.col('type'), sort]];
  else if (by === 'brand')
    order = [
      [
        { model: models.ModelYear, as: 'modelYear' },
        { model: models.Model, as: 'model' },
        { model: models.GroupModel, as: 'groupModel' },
        { model: models.Brand, as: 'brand' },
        'name',
        sort
      ]
    ];
  else if (by === 'createdAt') order = [['createdAt', sort]];

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
  }

  // Search by City, Subdistrict/Area & Radius
  if (by === 'area') {
    if (!cityId && !subdistrictId) {
      return res.status(422).json({
        success: false,
        errors: 'invalid city or subdistrictId!'
      });
    }
  }

  const whereModelYear = {};
  const where = {
    status: {
      [Op.in]: [0, 1]
    },
    modelYearId: id
  };

  if (radius) {
    if (!Array.isArray(radius)) {
      return res.status(422).json({
        success: false,
        errors: 'invalid radius'
      });
    }

    if (radius.length < 2) {
      return res.status(422).json({
        success: false,
        errors: 'incomplete radius'
      });
    }

    if (radius[0] >= 0 && radius[1] > 0) {
      const rawDistancesFunc = (tableName = 'Car') => {
        const queryLatitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude")`;
        const queryLongitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("${tableName}"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude")`;
        const calDistance = distanceHelper.calculate(
          latitude,
          longitude,
          queryLatitude,
          queryLongitude
        );

        rawDistances = calDistance;
        return calDistance;
      };

      distances = models.sequelize.literal(rawDistancesFunc('Car'));
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
      year: {
        [Op.and]: [{ [Op.lte]: maxYear }, { [Op.gte]: minYear }]
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

  if (exteriorColorId) {
    Object.assign(where, { exteriorColorId });
  }

  if (interiorColorId) {
    Object.assign(where, { interiorColorId });
  }

  if (cityId && radius && radius[0] >= 0 && radius[1] > 0) {
    if (radius.length < 2) {
      return res.status(422).json({
        success: false,
        errors: 'incomplete radius'
      });
    }

    const city = await models.City.findByPk(cityId);
    if (!city) {
      return res.status(400).json({
        success: false,
        errors: 'City not found!'
      });
    }

    const queryLatitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude")`;
    const queryLongitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude")`;
    distances = models.sequelize.literal(
      distanceHelper.calculate(city.latitude, city.longitude, queryLatitude, queryLongitude)
    );

    latitude = city.latitude;
    longitude = city.longitude;
  } else if (cityId && (!radius || (radius && radius[0] == 0 && radius[1] == ''))) {
    const city = await models.City.findByPk(cityId);
    if (!city) {
      return res.status(400).json({
        success: false,
        errors: 'City not found!'
      });
    }

    latitude = city.latitude;
    longitude = city.longitude;
    Object.assign(where, {
      cityId
    });
  }

  if (subdistrictId && radius && radius[0] >= 0 && radius[1] > 0) {
    if (radius.length < 2) {
      return res.status(422).json({
        success: false,
        errors: 'incomplete radius'
      });
    }

    const whereSubDistrict = { id: subdistrictId };
    if (cityId) {
      Object.assign(whereSubDistrict, { cityId });
    }

    const subdistrict = await models.SubDistrict.findOne({ where: whereSubDistrict });
    if (!subdistrict) {
      return res.status(400).json({
        success: false,
        errors: 'Subdistrict not found!'
      });
    }

    const queryLatitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude")`;
    const queryLongitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude")`;
    distances = models.sequelize.literal(
      distanceHelper.calculate(
        subdistrict.latitude,
        subdistrict.longitude,
        queryLatitude,
        queryLongitude
      )
    );

    latitude = subdistrict.latitude;
    longitude = subdistrict.longitude;
  } else if (subdistrictId && (!radius || (radius && radius[0] == 0 && radius[1] == ''))) {
    const whereSubDistrict = { id: subdistrictId };
    if (cityId) {
      Object.assign(whereSubDistrict, { cityId });
    }

    const subdistrict = await models.SubDistrict.findOne({ where: whereSubDistrict });
    if (!subdistrict) {
      return res.status(400).json({
        success: false,
        errors: 'Subdistrict not found!'
      });
    }

    latitude = subdistrict.latitude;
    longitude = subdistrict.longitude;

    Object.assign(where, {
      cityId,
      subdistrictId
    });
  }

  if (by === 'highestBidder') {
    const highestBidder = await carHelper.customFields({
      fields: ['highestBidderCarId'],
      modelYearLowerCase: true
    });

    Object.assign(where, {
      id: {
        [Op.eq]: highestBidder[0][0]
      }
    });
  }

  if ((by === 'location' || by === 'area') && radius) {
    if (radius.length < 2) {
      return res.status(422).json({
        success: false,
        errors: 'incomplete radius'
      });
    }

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

  if ((latitude && longitude) || by == 'distance') {
    carAttributes.fields.push('distance');
    Object.assign(carAttributes, { latitude, longitude, whereQuery: `` });

    if (radius && radius[0] >= 0 && radius[1] > 0) {
      Object.assign(where, {
        where: {
          [Op.and]: [
            Sequelize.where(distances, { [Op.gte]: Number(radius[0]) }),
            Sequelize.where(distances, { [Op.lte]: Number(radius[1]) })
          ]
        }
      });
    }

    if (by == 'distance') {
      order = [[Sequelize.col(`distance`), sort]];
    } else {
      order = [
        [
          { model: models.ModelYear, as: 'modelYear' },
          { model: models.Model, as: 'model' },
          { model: models.GroupModel, as: 'groupModel' },
          { model: models.Brand, as: 'brand' },
          'name',
          sort
        ]
      ];
    }
  }

  const carAttribute = await carHelper.customFields(carAttributes);
  if (isSimilarId) {
    Object.assign(where, {
      id: {
        [Op.ne]: isSimilarId
      }
    });
  }

  if (isMarket && JSON.parse(isMarket) == true) {
    Object.assign(where, {
      status: 2
    });
  } else {
    Object.assign(where, {
      status: {
        [Op.in]: [0, 1]
      }
    });
  }

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

module.exports = {
  listingAll,
  listingAllNew,
  listingAllNewRefactor,
  countAllNewRefactor,
  luxuryCar,
  listingCar
};
