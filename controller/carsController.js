/* eslint-disable no-restricted-globals */
const moment = require('moment');
const validator = require('validator');
const Sequelize = require('sequelize');
const { QueryTypes } = require('sequelize');
const randomize = require('randomatic');
const models = require('../db/models');
const minio = require('../helpers/minio');
const paginator = require('../helpers/paginator');
const distanceHelper = require('../helpers/distance');
const apiResponse = require('../helpers/apiResponse');
const carHelper = require('../helpers/car');
const general = require('../helpers/general');
const notification = require('../helpers/notification');

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
    cityId,
    subdistrictId,
    exteriorColorId,
    interiorColorId,
    minKm,
    maxKm,
    userId,
    profileUser
  } = req.query;
  let { latitude, longitude } = req.query;
  let { page, limit, by, sort } = req.query;
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (parseInt(limit) > MAX_LIMIT) limit = MAX_LIMIT;
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

  let newUserId = auth ? req.user.id : null;
  const where = {};
  const whereUser = {};

  if(!auth && userId) {
    newUserId = userId;
    Object.assign(where, {
      userId: newUserId
    });
  }

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
    id: newUserId
  };

  if (modelYearId) {
    Object.assign(where, {
      modelYearId
    });
  }

  if (groupModelId) {
    Object.assign(where, {
      groupModelId
    });
  }

  if (condition) {
    Object.assign(where, {
      condition
    });
  }

  if (modelId) {
    Object.assign(where, {
      modelId
    });
  }

  if (brandId) {
    Object.assign(where, {
      brandId
    });
  }

  if (exteriorColorId) {
    Object.assign(where, {
      exteriorColorId
    });
  }

  if (interiorColorId) {
    Object.assign(where, {
      interiorColorId
    });
  }

  if (profileUser == 'End User') {
    Object.assign(whereUser, {
      [Op.or]: [
        { type: 0, companyType: 0 },
        { type: 0, companyType: 1 }
      ]
    });
  }

  if (profileUser == 'Dealer') {
    Object.assign(whereUser, {
      [Op.or]: [
        { type: 1, companyType: 0 },
        { type: 1, companyType: 1 }
      ]
    });
  }

  if (minKm && maxKm) {
    Object.assign(where, {
      km: {
        [Op.and]: [{ [Op.gte]: minKm }, { [Op.lte]: maxKm }]
      }
    });
  } else if (minKm) {
    Object.assign(where, {
      km: {
        [Op.gte]: minKm
      }
    });
  } else if (maxKm) {
    Object.assign(where, {
      km: {
        [Op.lte]: maxKm
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

    const queryLatitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude")`;
    const queryLongitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude")`;
    const distances = models.sequelize.literal(
      distanceHelper.calculate(latitude, longitude, queryLatitude, queryLongitude)
    );
    Object.assign(where, {
      [Op.and]: [models.sequelize.where(distances, { [Op.lte]: radius })]
    });

    addAttributes.fields.push('distance');
    Object.assign(addAttributes, {
      latitude,
      longitude
    });
  }

  if (by === 'area') {
    if (cityId) {
      const city = await models.City.findByPk(cityId);
      if (!city) return res.status(400).json({ success: false, errors: 'City not found!' });

      if (subdistrictId) {
        const subdistrict = await models.SubDistrict.findOne({
          where: { id: subdistrictId, cityId }
        });

        if (!subdistrict)
          return res.status(400).json({ success: false, errors: 'Subdistrict not found!' });

        if (city && subdistrict) {
          latitude = subdistrict.latitude;
          longitude = subdistrict.longitude;
        }
      } else if (city) {
        latitude = city.latitude;
        longitude = city.longitude;
      }

      const queryLatitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude")`;
      const queryLongitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude")`;
      const distances = models.sequelize.literal(
        distanceHelper.calculate(latitude, longitude, queryLatitude, queryLongitude)
      );

      if (radius) {
        Object.assign(where, {
          where: {
            [Op.and]: [Sequelize.where(distances, { [Op.lte]: Number(radius) })]
          }
        });
      } else if (cityId && subdistrictId) {
        Object.assign(where, {
          cityId,
          subdistrictId
        });
      } else if (cityId) {
        Object.assign(where, {
          cityId
        });
      }

      addAttributes.fields.push('distance');
      Object.assign(addAttributes, {
        latitude,
        longitude
      });
    } else {
      return res.status(400).json({ success: false, errors: 'Please Select City!' });
    }
  }

  if (latitude && longitude && radius && by != 'area' && by != 'location') {
    const queryLatitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude")`;
    const queryLongitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude")`;
    const distances = models.sequelize.literal(
      distanceHelper.calculate(latitude, longitude, queryLatitude, queryLongitude)
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

  if (
    cityId &&
    subdistrictId &&
    radius == '' &&
    (latitude == '') & (longitude == '') &&
    by != 'area' &&
    by != 'location'
  ) {
    const city = await models.City.findByPk(cityId);
    if (!city) return res.status(400).json({ success: false, errors: 'City not found!' });

    if (subdistrictId) {
      const subdistrict = await models.SubDistrict.findOne({
        where: { id: subdistrictId, cityId }
      });

      if (!subdistrict)
        return res.status(400).json({ success: false, errors: 'Subdistrict not found!' });

      if (city && subdistrict) {
        latitude = subdistrict.latitude;
        longitude = subdistrict.longitude;
      }
    } else if (city) {
      latitude = city.latitude;
      longitude = city.longitude;
    }

    if (cityId && subdistrictId) {
      Object.assign(where, {
        cityId,
        subdistrictId
      });
    } else if (cityId) {
      Object.assign(where, {
        cityId
      });
    }

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
        model: models.City,
        as: 'city'
      },
      {
        model: models.SubDistrict,
        as: 'subdistrict'
      },
      {
        model: models.User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'phone', 'type', 'companyType'],
        where: whereUser,
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

      await Promise.all(
        data.map(async item => {
          if(item.brand.logo) {
            const url = await minio.getUrl(item.brand.logo).then(res => {
              return res;
            }).catch(err => {
              res.status(422).json({
                success: false,
                errors: err
              });
            });

            item.brand.dataValues.logoUrl = url;
          } else {
            item.brand.dataValues.logoUrl = null;
          }

          await Promise.all(
            item.interiorGalery.map(async itemInteriorGalery => {
              if(itemInteriorGalery.file.url) {
                const url = await minio.getUrl(itemInteriorGalery.file.url).then(res => {
                  return res;
                }).catch(err => {
                  res.status(422).json({
                    success: false,
                    errors: err
                  });
                });

                itemInteriorGalery.file.dataValues.fileUrl = url;
              } else {
                itemInteriorGalery.file.dataValues.fileUrl = null;
              }
            }),

            item.exteriorGalery.map(async itemExteriorGalery => {
              if(itemExteriorGalery.file.url) {
                const url = await minio.getUrl(itemExteriorGalery.file.url).then(res => {
                  return res;
                }).catch(err => {
                  res.status(422).json({
                    success: false,
                    errors: err
                  });
                });

                itemExteriorGalery.file.dataValues.fileUrl = url;
              } else {
                itemExteriorGalery.file.dataValues.fileUrl = null;
              }
            })
          );
        })
      );

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

async function carsGetRefactor(req, res) {
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
    minRadius,
    maxRadius,
    cityId,
    subdistrictId,
    exteriorColorId,
    interiorColorId,
    minKm,
    maxKm,
    profileUser,
    isMarket,
    showDetailPhoto,
    likeMe,
    viewMe,
    negoStatus,
    userId
  } = req.query;
  const { latitude, longitude } = req.query;
  let { page, limit, by, sort } = req.query;
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (parseInt(limit, 10) > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  if (sort !== 'desc' && sort !== 'asc') sort = 'desc';
  if (by === 'date') {
    by = `c."createdAt"`;
  } else if (by === 'price') {
    by = `c."price"`;
  } else if (by === 'km') {
    by = `c."km"`;
  } else if (by === 'userType') {
    by = `u."type"`;
  } else if (by === 'condition') {
    by = `c."condition"`;
  } else if (by === 'likes') {
    by = `likes`;
  } else if (by === 'location' && !isNaN(latitude) && !isNaN(longitude)) {
    by = `cd."distance"`;
  } else {
    by = 'c.id';
  }

  const newUserId = req.user ? req.user.id : null;
  const myCar = userId ? userId : null;

  const replacements = { bidType: 0, userId: newUserId, myCar };
  let conditionString = ``;
  let carDistance = ``;
  let distanceSelect = ``;
  let carConditionString = ``;
  let distanceJoin = ``;
  let distanceGroup = ``;

  if (userId) {
    conditionString += ` AND c."userId" = :myCar`;
  }
  
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
  if (modelYearId) {
    conditionString += ` AND c."modelYearId" = :modelYearId`;
    Object.assign(replacements, { modelYearId });
    carConditionString += ` AND "modelYearId" = ${modelYearId}`;
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
  }
  //  else {
  //   conditionString += ` AND (c."status" = :carStatus0 OR c."status" = :carStatus1) AND lc."id" IS NULL`;
  //   Object.assign(replacements, { carStatus0: 0, carStatus1: 1 });
  //   carConditionString += ` AND ("status" = 0 OR "status" = 1)`;
  // }

  if (!isNaN(latitude) && !isNaN(longitude)) {
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
    distanceSelect = `, cd.distance`;
    distanceGroup = `, cd.distance`;
  }
  if (
    !isNaN(latitude) &&
    !isNaN(longitude) &&
    !isNaN(minRadius) &&
    !isNaN(maxRadius) &&
    !cityId &&
    !subdistrictId
  ) {
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
  if (profileUser === 'End User') {
    conditionString += ` AND ((u."type" = :typeUser AND u."companyType" = :companyTypeUser0) OR (u."type" = :typeUser AND u."companyType" = :companyTypeUser1))`;
    Object.assign(replacements, { typeUser: 0, companyTypeUser0: 0, companyTypeUser1: 1 });
  } else if (profileUser === 'Dealer') {
    conditionString += ` AND ((u."type" = :typeDealer AND u."companyType" = :companyTypeDealer0) OR (u."type" = :typeDealer AND u."companyType" = :companyTypeDealer1))`;
    Object.assign(replacements, { typeDealer: 1, companyTypeDealer0: 0, companyTypeDealer1: 1 });
  }
  if (likeMe === 'true' && userId) {
    conditionString += ` AND isLike."id" IS NOT NULL`;
  }
  if (viewMe === 'true' && userId) {
    conditionString += ` AND vme."id" IS NOT NULL`;
  }

  const negoSelect = ``;
  const negoRoom = ``;
  const negoJoin = ``;
  // if (negoStatus === '0') {
  //   negoSelect = `, nego_bargain."negotiationType", nego_bargain."expiredAt", nego_bargain."isExtend"`;
  //   negoRoom = `, nego_room AS (
  //     SELECT MAX("id") as "id", "carId" FROM "Bargains" WHERE "deletedAt" IS NULL
  //     GROUP BY "carId"
  //   )`;
  //   negoJoin = ` LEFT JOIN nego_room nr ON nr."carId" = c.id
  //     LEFT JOIN "Bargains" nego_bargain ON nego_bargain."id" = nr.id AND nego_bargain."negotiationType" = 0`;
  //   conditionString += ` AND nego_bargain."id" IS NOT NULL`;
  // } else if (negoStatus === '1') {
  //   negoSelect = `, nego_bargain."negotiationType", nego_bargain."expiredAt", nego_bargain."isExtend"`;
  //   negoRoom = `, nego_room AS (
  //     SELECT MAX("id") as "id", "carId" FROM "Bargains" WHERE "deletedAt" IS NULL
  //     GROUP BY "carId"
  //   )`;
  //   negoJoin = ` LEFT JOIN nego_room nr ON nr."carId" = c.id
  //   LEFT JOIN "Bargains" nego_bargain ON nego_bargain."id" = nr.id AND nego_bargain."negotiationType" IN (1, 2, 5, 6)`;
  //   conditionString += ` AND nego_bargain."id" IS NOT NULL`;
  // }

  let pictureSelect = ``;
  let pictureJoin = ``;
  if (showDetailPhoto === 'true') {
    pictureSelect = `,
    array_to_string(array_agg(eg.id::TEXT || '#sep#' || coalesce(egf."url", '<m>')),'|') AS "exteriorGaleries",
    array_to_string(array_agg(ig.id::TEXT || '#sep#' || coalesce(igf."url", '<m>')),'|') AS "interiorGaleries"`;
    pictureJoin = `LEFT JOIN "ExteriorGaleries" eg ON eg."carId" = c.id
    LEFT JOIN "Files" egf ON egf."id" = eg."fileId"
    LEFT JOIN "InteriorGaleries" ig ON ig."carId" = c.id
    LEFT JOIN "Files" igf ON igf."id" = ig."fileId"`;
  }
  const data = await models.sequelize
    .query(
      `WITH loan_cars AS (
        SELECT "id", "carId" FROM "Bargains" WHERE "deletedAt" IS NULL AND "negotiationType" IN (4,8)
      ), car_picture as (
        SELECT "carId", MIN("fileId") as "fileId" FROM "ExteriorGaleries" GROUP BY "carId"
      )
      ${carDistance}
      ${negoRoom}
      
      select c.*${distanceSelect}, my.year, my.picture AS "modelYearPicture",
      my.price AS "modelYearPrice", m."name" AS "modelName", gm."name" AS "groupModelName", b."name" AS "brandName",
      b."logo" AS "brandLogo",
      count(distinct(b2."id")) as "countBid", max(b2."bidAmount" ) as "highestBid",
      count(distinct(isBid.id)) AS isBid, count(distinct(l.id)) AS likes,
      count(distinct(isLike.id)) AS isLike, count(distinct(v.id)) AS views,
      cpf."url" AS "carPicture", city."name" as "cityName",
      INITCAP(subdistrict."name") as "subdistrictName", u."type" as "userType", ic."name" AS "interiorColorName",
      ec."name" AS "exteriorColorName" ${pictureSelect}, purchase."id" AS "purchaseId", purchase."createdAt" AS "purchaseDate",
      buyer."id" AS "buyerId", buyer."name" AS "buyerName"
      FROM "Cars" c
      left join "Users" u on u."id" = c."userId"
      left join "Cities" city on city."id" = c."cityId"
      left join "SubDistricts" subdistrict on subdistrict."id" = c."subdistrictId"
      left join "Colors" ic on ic."id" = c."interiorColorId"
      left join "Colors" ec on ec."id" = c."exteriorColorId"
      left join "ModelYears" my on my."id" = c."modelYearId"
      left join "Models" m on m."id" = c."modelId"
      left join "GroupModels" gm on gm."id" = c."groupModelId"
      left join "Brands" b on b."id" = c."brandId"
      left join "Bargains" b2 on b2."carId" = c."id" and b2."bidType" = 0 AND b2."deletedAt" IS NULL
      left join "Bargains" isBid on isBid."carId" = c."id" and isBid."bidType" = 0 AND isBid."deletedAt" IS NULL AND isBid."userId" = :userId 
      LEFT JOIN "Likes" l ON l."carId" = c.id AND l.status IS true
      LEFT JOIN "Likes" isLike ON isLike."carId" = c.id AND isLike."userId" = :userId AND isLike.status IS true
      LEFT JOIN "Views" v ON v."carId" = c.id
      LEFT JOIN "Views" vme ON vme."carId" = c.id AND vme."userId" = :userId
      LEFT JOIN "loan_cars" lc ON lc."carId" = c.id
      LEFT JOIN "car_picture" AS cp ON cp."carId" = c."id"
      LEFT JOIN "Files" AS cpf ON cpf."id" = cp."fileId"
      LEFT JOIN "Purchases" AS purchase ON purchase."carId" = c."id"
      LEFT JOIN "Users" AS buyer ON buyer."id" = purchase."userId"
      ${pictureJoin}
      ${distanceJoin}
      ${negoJoin}
      WHERE c."deletedAt" IS NULL ${conditionString}
      group by c."id"${distanceGroup}, my.year, my.picture, my.price, m."name", gm."name", b."name",
      b."logo", cpf."url", city."name", subdistrict."name", u."type", ic."name", ec."name",
      purchase."id", "buyer".id
      order by ${by} ${sort}
      OFFSET ${offset} LIMIT ${limit}`,
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

  await Promise.all(
    data.map(async item => {
      if(item.STNKphoto) {
        const STNKphotoURL = await minio.getUrl(item.STNKphoto).then(res => {
          return res;
        }).catch(err => {
          res.status(422).json({
            success: false,
            errors: err
          });
        });

        item.STNKphoto = STNKphotoURL;
      }

      if(item.modelYearPicture) {
        const modelYearPictureURL = await minio.getUrl(item.modelYearPicture).then(res => {
          return res;
        }).catch(err => {
          res.status(422).json({
            success: false,
            errors: err
          });
        });

        item.modelYearPicture = modelYearPictureURL;
      }

      if(item.brandLogo) {
        const brandLogoURL = await minio.getUrl(item.brandLogo).then(res => {
          return res;
        }).catch(err => {
          res.status(422).json({
            success: false,
            errors: err
          });
        });

        item.brandLogo = brandLogoURL;
      }

      if(item.carPicture) {
        const carPictureURL = await minio.getUrl(item.carPicture).then(res => {
          return res;
        }).catch(err => {
          res.status(422).json({
            success: false,
            errors: err
          });
        });

        item.carPicture = carPictureURL;
      }
    })
  );

  if (showDetailPhoto === 'true') {
    function onlyUnique(value, index, self) {
      return self.indexOf(value) === index;
    }
    for (let i = 0; i < data.length; i += 1) {
      const exteriors = new Array();
      const eg = data[i].exteriorGaleries.split('|').filter(onlyUnique);
      for (let j = 0; j < eg.length; j += 1) {
        const egColumn = eg[j].split('#sep#');
        if (egColumn.length === 2) {
          if (egColumn[1] !== '<m>') {
            const pictureURL = await minio.getUrl(egColumn[1]).then(res => {
              return res;
            }).catch(err => {
              res.status(422).json({
                success: false,
                errors: err
              });
            });

            exteriors.push({
              id: parseInt(egColumn[0], 10),
              picture: pictureURL
            });
          }
        }
        data[i].exteriorGalery = exteriors;
        delete data[i].exteriorGaleries;
      }

      const interiors = new Array();
      const ig = data[i].interiorGaleries.split('|').filter(onlyUnique);
      for (let j = 0; j < ig.length; j += 1) {
        const igColumn = ig[j].split('#sep#');
        if (igColumn.length === 2) {
          if (igColumn[1] !== '<m>') {
            const pictureURL = await minio.getUrl(igColumn[1]).then(res => {
              return res;
            }).catch(err => {
              res.status(422).json({
                success: false,
                errors: err
              });
            });

            interiors.push({
              id: parseInt(igColumn[0], 10),
              picture: pictureURL
            });
          }
        }
      }
      data[i].interiorGalery = interiors;
      delete data[i].interiorGaleries;
    }
  }

  res.json({
    success: true,
    meta: req.query,
    data
  });
}

async function getById(req, res) {
  const { id } = req.params;

  // FOR isLike & isBid
  const { userId } = req.query;
  const attributes = {
    fields: ['like', 'view', 'view', 'highestBidder', 'numberOfBidder'],
    upperCase: true
  };

  if (userId) {
    attributes.fields.push('islike', 'isBid');
    attributes.id = userId;
  }

  const addAttribute = await carHelper.customFields(attributes);
  return models.Car.findOne({
    attributes: Object.keys(models.Car.attributes).concat(addAttribute),
    include: [
      {
        model: models.City,
        as: 'city'
      },
      {
        model: models.SubDistrict,
        as: 'subdistrict'
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
    where: {
      id
    }
  })
    .then(async data => {
      if(data) {
        if(data.brand.logo) {
          const url = await minio.getUrl(data.brand.logo).then(res => {
            return res;
          }).catch(err => {
            res.status(422).json({
              success: false,
              errors: err
            });
          });

          data.brand.dataValues.logoUrl = url;
        } else {
          data.brand.dataValues.logoUrl = null;
        }

        await Promise.all(
          data.interiorGalery.map(async itemInteriorGalery => {
            if(itemInteriorGalery.file.url) {
              const url = await minio.getUrl(itemInteriorGalery.file.url).then(res => {
                return res;
              }).catch(err => {
                res.status(422).json({
                  success: false,
                  errors: err
                });
              });

              itemInteriorGalery.file.dataValues.fileUrl = url;
            } else {
              itemInteriorGalery.file.dataValues.fileUrl = null;
            }
          }),

          data.exteriorGalery.map(async itemExteriorGalery => {
            if(itemExteriorGalery.file.url) {
              const url = await minio.getUrl(itemExteriorGalery.file.url).then(res => {
                return res;
              }).catch(err => {
                res.status(422).json({
                  success: false,
                  errors: err
                });
              });

              itemExteriorGalery.file.dataValues.fileUrl = url;
            } else {
              itemExteriorGalery.file.dataValues.fileUrl = null;
            }
          })
        );
      }

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

async function getByIdRefactor(req, res, auth = false) {
  const { id } = req.params;
  const userId = auth ? req.user.id : null;
  const data = await models.sequelize
    .query(
      `select c.*, my.year, my.picture AS "modelYearPicture",
      my.price, m."name" AS "modelName", gm."name" AS "groupModelName", b."name" AS "brandName",
      b."logo" AS "brandLogo",
      cle.name AS exteriorColorName, cle.hex AS exteriorColorHex,
      cli.name AS interiorColorName, cli.hex AS interiorColorHex,
      ct."name" AS city, INITCAP(sdt."name") AS subdistrict,

      array_to_string(array_agg(eg.id::TEXT || '#sep#' || coalesce(egf."url", '<m>')),'|') AS "exteriorGaleries",
      array_to_string(array_agg(ig.id::TEXT || '#sep#' || coalesce(igf."url", '<m>')),'|') AS "interiorGaleries",
      array_to_string(array_agg(ms.id::TEXT || '#sep#' || ms."day" || '#sep#' || ms."startTime"  || '#sep#' || ms."endTime"),'|') AS "meetingSchedules",

      count(distinct(b2."id")) as "countBid", max(b2."bidAmount" ) as "highestBid",
      count(distinct(isBid.id)) AS isBid, count(distinct(l.id)) AS likes,
      count(distinct(isLike.id)) AS isLike, count(distinct(v.id)) AS views,
      p."id" AS "purchaseId", p."createdAt" AS "purchaseDate", p."price" AS "purchaseAmount",
      case when u."type" = 0 then 'End User' when u."type" = 1 then 'Dealer' end as userType
      FROM "Cars" c
      LEFT join "Users" u on u."id" = c."userId"
      LEFT join "ModelYears" my on my."id" = c."modelYearId"
      LEFT join "Models" m on m."id" = c."modelId"
      LEFT join "GroupModels" gm on gm."id" = c."groupModelId"
      LEFT join "Brands" b on b."id" = c."brandId"
      LEFT join "MeetingSchedules" ms on ms."carId" = c."id"

      LEFT join "Cities" ct on ct."id" = c."cityId"
      LEFT join "SubDistricts" sdt on sdt."id" = c."subdistrictId"

      LEFT join "Colors" cle on cle."id" = c."exteriorColorId"
      LEFT join "Colors" cli on cli."id" = c."interiorColorId"

      LEFT JOIN "ExteriorGaleries" eg ON eg."carId" = c.id
      LEFT JOIN "Files" egf ON egf."id" = eg."fileId"
      LEFT JOIN "InteriorGaleries" ig ON ig."carId" = c.id
      LEFT JOIN "Files" igf ON igf."id" = ig."fileId"

      LEFT join "Bargains" b2 on b2."carId" = c."id" and b2."bidType" = 0 AND b2."deletedAt" IS NULL
      LEFT join "Bargains" isBid on isBid."carId" = c."id" and isBid."bidType" = 0 AND isBid."deletedAt" IS NULL AND isBid."userId" = :userId 
      LEFT JOIN "Purchases" AS p ON p."carId" = c."id"
      LEFT JOIN "Likes" l ON l."carId" = c.id
      LEFT JOIN "Likes" isLike ON isLike."carId" = c.id AND isLike."userId" = :userId
      LEFT JOIN "Views" v ON v."carId" = c.id
      WHERE c."deletedAt" IS NULL AND c."id" = :id
      group by c."id", my.year, my.picture, my.price, m."name", gm."name", 
      b."name", b."logo", cle."name", cli."name", cle."hex", cli."hex", 
      u."type", ct."name", sdt."name", p."id"`,
      {
        replacements: { userId, id },
        type: QueryTypes.SELECT,
        plain: true
      }
    )
    .catch(err => {
      res.status(422).json({
        success: false,
        errors: err.message
      });
    });

  if(data.STNKphoto) {
    const STNKphotoURL = await minio.getUrl(data.STNKphoto).then(res => {
      return res;
    }).catch(err => {
      res.status(422).json({
        success: false,
        errors: err
      });
    });

    data.STNKphoto = STNKphotoURL;
  }

  if(data.modelYearPicture) {
    const modelYearPictureURL = await minio.getUrl(data.modelYearPicture).then(res => {
      return res;
    }).catch(err => {
      res.status(422).json({
        success: false,
        errors: err
      });
    });

    data.modelYearPicture = modelYearPictureURL;
  }

  if(data.brandLogo) {
    const brandLogoURL = await minio.getUrl(data.brandLogo).then(res => {
      return res;
    }).catch(err => {
      res.status(422).json({
        success: false,
        errors: err
      });
    });

    data.brandLogo = brandLogoURL;
  }

  function onlyUnique(value, index, self) {
    return self.indexOf(value) === index;
  }
  if (data) {
    const exteriorGalery = new Array();
    const interiorGalery = new Array();
    const meetingSchedule = new Array();
    const eg = data.exteriorGaleries.split('|').filter(onlyUnique);
    const ig = data.interiorGaleries.split('|').filter(onlyUnique);
    const ms = data.meetingSchedules.split('|').filter(onlyUnique);

    for (let j = 0; j < eg.length; j += 1) {
      const egColumn = eg[j].split('#sep#');
      if (egColumn.length === 2) {
        if (egColumn[1] !== '<m>') {
          const pictureURL = await minio.getUrl(egColumn[1]).then(res => {
            return res;
          }).catch(err => {
            res.status(422).json({
              success: false,
              errors: err
            });
          });

          exteriorGalery.push({
            id: parseInt(egColumn[0], 10),
            picture: pictureURL
          });
        }
      }

      data.exteriorGalery = exteriorGalery;
      delete data.exteriorGaleries;
    }

    for (let j = 0; j < ig.length; j += 1) {
      const igColumn = ig[j].split('#sep#');
      if (igColumn.length === 2) {
        if (igColumn[1] !== '<m>') {
          const pictureURL = await minio.getUrl(igColumn[1]).then(res => {
            return res;
          }).catch(err => {
            res.status(422).json({
              success: false,
              errors: err
            });
          });

          interiorGalery.push({
            id: parseInt(igColumn[0], 10),
            picture: pictureURL
          });
        }
      }

      data.interiorGalery = interiorGalery;
      delete data.interiorGaleries;
    }

    for (let j = 0; j < ms.length; j += 1) {
      const msColumn = ms[j].split('#sep#');
      if (msColumn.length === 4) {
        if (msColumn[1] !== '<m>') {
          meetingSchedule.push({
            id: parseInt(msColumn[0], 10),
            day: msColumn[1],
            startTime: msColumn[2],
            endTime: msColumn[3]
          });
        }
      }

      data.meetingSchedule = meetingSchedule;
      delete data.meetingSchedules;
    }
  }

  res.json({
    success: true,
    meta: req.query,
    data
  });
}

async function getByUserId(req, res) {
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
    maxYear,
    status,
    bidType
  } = req.query;
  let { page, limit, by, sort } = req.query;
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (parseInt(limit) > MAX_LIMIT) limit = MAX_LIMIT;
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

  if (status) {
    let defaultOperator = `=`;
    if (!status.match(/^[0-9]*$/)) {
      defaultOperator = ``;
    }

    Object.assign(where, {
      [Op.and]: models.sequelize.literal(`"Car"."status" ${defaultOperator} ${status}`)
    });
  }

  const whereModelYear = {};
  const whereProfile = {};
  const whereBargain = {};
  const customFields = {
    fields: ['islike', 'isBid', 'like', 'view', 'numberOfBidder', 'highestBidder'],
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
    const queryLatitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude")`;
    const queryLongitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude")`;
    const distances = models.sequelize.literal(
      distanceHelper.calculate(latitude, longitude, queryLatitude, queryLongitude)
    );

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
      model: models.City,
      as: 'city'
    },
    {
      model: models.SubDistrict,
      as: 'subdistrict'
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

  if (bidType) {
    Object.assign(whereBargain, {
      bidType,
      [Op.and]: [
        models.sequelize.literal(`(SELECT COUNT("Bargains"."id") 
            FROM "Bargains" 
            WHERE "Bargains"."carId" = "Car"."id" 
              AND "Bargains"."negotiationType" BETWEEN 1 AND 6
              AND "Bargains"."deletedAt" IS NULL
            ) = 0`)
      ]
    });

    includes.push({
      model: models.Bargain,
      as: 'bargain',
      required: true,
      where: whereBargain
    });
  }

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

      await Promise.all(
        data.map(async item => {
          if(item.brand.logo) {
            const url = await minio.getUrl(item.brand.logo).then(res => {
              return res;
            }).catch(err => {
              res.status(422).json({
                success: false,
                errors: err
              });
            });

            item.brand.dataValues.logoUrl = url;
          } else {
            item.brand.dataValues.logoUrl = null;
          }

          await Promise.all(
            item.interiorGalery.map(async itemInteriorGalery => {
              if(itemInteriorGalery.file.url) {
                const url = await minio.getUrl(itemInteriorGalery.file.url).then(res => {
                  return res;
                }).catch(err => {
                  res.status(422).json({
                    success: false,
                    errors: err
                  });
                });

                itemInteriorGalery.file.dataValues.fileUrl = url;
              } else {
                itemInteriorGalery.file.dataValues.fileUrl = null;
              }
            }),

            item.exteriorGalery.map(async itemExteriorGalery => {
              if(itemExteriorGalery.file.url) {
                const url = await minio.getUrl(itemExteriorGalery.file.url).then(res => {
                  return res;
                }).catch(err => {
                  res.status(422).json({
                    success: false,
                    errors: err
                  });
                });

                itemExteriorGalery.file.dataValues.fileUrl = url;
              } else {
                itemExteriorGalery.file.dataValues.fileUrl = null;
              }
            })
          );
        })
      );

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

async function getByStatus(req, res) {
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
  if (parseInt(limit) > MAX_LIMIT) limit = MAX_LIMIT;
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

  const addAttributes = {
    fields: ['like', 'view'],
    upperCase: true,
    // id: userId
  };

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
        model: models.City,
        as: 'city'
      },
      {
        model: models.SubDistrict,
        as: 'subdistrict'
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

      await Promise.all(
        data.map(async item => {
          if(item.brand.logo) {
            const url = await minio.getUrl(item.brand.logo).then(res => {
              return res;
            }).catch(err => {
              res.status(422).json({
                success: false,
                errors: err
              });
            });

            item.brand.dataValues.logoUrl = url;
          } else {
            item.brand.dataValues.logoUrl = null;
          }

          await Promise.all(
            item.interiorGalery.map(async itemInteriorGalery => {
              if(itemInteriorGalery.file.url) {
                const url = await minio.getUrl(itemInteriorGalery.file.url).then(res => {
                  return res;
                }).catch(err => {
                  res.status(422).json({
                    success: false,
                    errors: err
                  });
                });

                itemInteriorGalery.file.dataValues.fileUrl = url;
              } else {
                itemInteriorGalery.file.dataValues.fileUrl = null;
              }
            }),

            item.exteriorGalery.map(async itemExteriorGalery => {
              if(itemExteriorGalery.file.url) {
                const url = await minio.getUrl(itemExteriorGalery.file.url).then(res => {
                  return res;
                }).catch(err => {
                  res.status(422).json({
                    success: false,
                    errors: err
                  });
                });

                itemExteriorGalery.file.dataValues.fileUrl = url;
              } else {
                itemExteriorGalery.file.dataValues.fileUrl = null;
              }
            })
          );
        })
      );

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

async function purchaseList(req, res) {
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
  if (parseInt(limit) > MAX_LIMIT) limit = MAX_LIMIT;
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
            model: models.City,
            as: 'city'
          },
          {
            model: models.SubDistrict,
            as: 'subdistrict'
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
  if (parseInt(limit) > MAX_LIMIT) limit = MAX_LIMIT;
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
      // order.push([Sequelize.literal(`"car->user"."type" ${sort}`)]);
      // order.push([{ model: models.User, as: 'user' }, 'type', sort]);
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
    },
    [Op.and]: models.sequelize.literal(`(SELECT COUNT("Purchases"."id")
      FROM "Purchases"
      WHERE "Purchases"."deletedAt" IS NULL
        AND "Purchases"."carId" = "Bargain"."carId"
    ) = 0`),
    [Op.and]: models.sequelize.literal(`(SELECT COUNT("b"."id") 
      FROM "Bargains" b
      WHERE "b"."carId" = "Bargain"."carId" 
        AND "b"."negotiationType" = 8
        AND "b"."deletedAt" IS NULL
    ) = 0`)
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

  // If car not in transaction
  const whereCar = {
    status: {
      [Op.lt]: 2
    }
  };

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
    const queryLatitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("car"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude")`;
    const queryLongitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("car"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude")`;
    const distances = models.sequelize.literal(
      distanceHelper.calculate(latitude, longitude, queryLatitude, queryLongitude)
    );

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
          model: models.City,
          as: 'city'
        },
        {
          model: models.SubDistrict,
          as: 'subdistrict'
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

      await Promise.all(
        data.map(async item => {
          if(item.car) {
            if(item.car.STNKphoto) {
              const url = await minio.getUrl(item.car.STNKphoto).then(res => {
                return res;
              }).catch(err => {
                res.status(422).json({
                  success: false,
                  errors: err
                });
              });

              item.car.dataValues.stnkUrl = url;
            } else {
              item.car.dataValues.stnkUrl = null;
            }

            if(item.car.brand.logo) {
              const url = await minio.getUrl(item.car.brand.logo).then(res => {
                return res;
              }).catch(err => {
                res.status(422).json({
                  success: false,
                  errors: err
                });
              });

              item.car.brand.dataValues.logoUrl = url;
            } else {
              item.car.brand.dataValues.logoUrl = null;
            }

            await Promise.all(
              item.car.interiorGalery.map(async itemInteriorGalery => {
                if(itemInteriorGalery.file.url) {
                  const url = await minio.getUrl(itemInteriorGalery.file.url).then(res => {
                    return res;
                  }).catch(err => {
                    res.status(422).json({
                      success: false,
                      errors: err
                    });
                  });

                  itemInteriorGalery.file.dataValues.fileUrl = url;
                } else {
                  itemInteriorGalery.file.dataValues.fileUrl = null;
                }
              }),

              item.car.exteriorGalery.map(async itemExteriorGalery => {
                if(itemExteriorGalery.file.url) {
                  const url = await minio.getUrl(itemExteriorGalery.file.url).then(res => {
                    return res;
                  }).catch(err => {
                    res.status(422).json({
                      success: false,
                      errors: err
                    });
                  });

                  itemExteriorGalery.file.dataValues.fileUrl = url;
                } else {
                  itemExteriorGalery.file.dataValues.fileUrl = null;
                }
              })
            );
          }
        })
      );

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

async function sell(req, res) {
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
    address
  } = req.body;

  let { city, subdistrict } = req.body;
  const { images } = req.files;

  if (!userId) return res.status(400).json({ success: false, errors: 'user is mandatory' });
  if (!brandId) return res.status(400).json({ success: false, errors: 'brand is mandatory' });
  if (!groupModelId)
    return res.status(400).json({ success: false, errors: 'groupModel is mandatory' });
  if (!modelId) return res.status(400).json({ success: false, errors: 'model is mandatory' });
  if (!modelYearId)
    return res.status(400).json({ success: false, errors: 'model year is mandatory' });

  if (!location) {
    return res.status(400).json({ success: false, errors: 'location is mandatory' });
  }
  const locations = location.split(',');
  locations[0] = general.customReplace(locations[0], ' ', '');
  locations[1] = general.customReplace(locations[1], ' ', '');
  if (validator.isNumeric(locations[0] ? locations[0].toString() : '') === false)
    return apiResponse._error({ res, errors: 'invalid latitude' });
  if (validator.isNumeric(locations[1] ? locations[1].toString() : '') === false)
    return apiResponse._error({ res, errors: 'invalid longitude' });

  if (km) {
    if (validator.isInt(km) === false)
      return res.status(422).json({ success: false, errors: 'km is number' });
  }

  if (frameNumber) {
    const checkFrameNumber = await models.Car.findOne({
      where: {
        frameNumber
      }
    });

    if (checkFrameNumber) {
      return res.status(422).json({ success: false, errors: 'frame number alredy exists' });
    }
  }

  if (engineNumber) {
    const checkEngineNumber = await models.Car.findOne({
      where: {
        engineNumber
      }
    });

    if (checkEngineNumber) {
      return res.status(422).json({ success: false, errors: 'engine number alredy exists' });
    }
  }

  if (STNKnumber) {
    const checkSTNKnumber = await models.Car.findOne({
      where: {
        STNKnumber
      }
    });

    if (checkSTNKnumber) {
      return res.status(422).json({ success: false, errors: 'STNK number alredy exists' });
    }
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
    oldPrice: price
  };

  if (address) Object.assign(insert, { address });

  if (subdistrict && city) {
    city = city
      .toLowerCase()
      .replace('kota', '')
      .replace('city', '')
      .trim();
    subdistrict = subdistrict
      .toLowerCase()
      .replace('kec.', '')
      .replace('kecamatan', '')
      .trim();

    const subDistrictExist = await models.SubDistrict.findOne({
      include: [
        {
          model: models.City,
          as: 'city',
          where: {
            name: {
              [Op.iLike]: `%${city}%`
            }
          }
        }
      ],
      where: {
        name: {
          [Op.iLike]: `%${subdistrict}%`
        }
      }
    });

    if (!subDistrictExist) {
      return res.status(422).json({ success: false, errors: 'subdistrict not found' });
    }

    const cityExist = await models.City.findOne({
      where: {
        id: subDistrictExist.cityId,
        name: {
          [Op.iLike]: `%${city}%`
        }
      }
    });

    if (!cityExist) {
      return res.status(422).json({ success: false, errors: 'city not found' });
    }

    Object.assign(insert, { subdistrictId: subDistrictExist.id });
    Object.assign(insert, { cityId: cityExist.id });
  }

  const userNotifs = [];
  const otherBidders = await models.Bargain.aggregate('Bargain.userId', 'DISTINCT', {
    plain: false,
    include: [
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
      notificationBody: `Mobil Sejenis`,
      notificationClickAction: `similiarCarBeli`,
      dataReferenceId: 123,
      // category: 2,
      // status: 1,
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
      notificationBody: `Mobil Sejenis`,
      notificationClickAction: `similiarCarSell`,
      dataReferenceId: 123,
      // category: 1,
      // status: 2,
      tab: `tabJual`
    });
  });

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

  if (Object.keys(result).length > 0) {
    await minio.upload(result.name, result.data).then(res => {
      console.log(`etag min.io: ${res.etag}`);
    }).catch(err => {
      trans.rollback();
      return res.status(422).json({
        success: false,
        errors: err
      });
    });
  }

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
  });

  return res.json({
    success: true,
    data
  });
}

async function sellList(req, res) {
  // const { id } = req.user;
  const id = req.user ? req.user.id : null;
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
    maxYear,
    isMarket
  } = req.query;

  let { page, limit, by, sort } = req.query;
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (parseInt(limit) > MAX_LIMIT) limit = MAX_LIMIT;
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
    fields: [
      'numberOfPurchase',
      'lastPurchaseAmount',
      'numberOfBidder',
      'like',
      'view',
      'islike',
      'isBid'
    ],
    id,
    upperCase: true,
    modelYearId: '"Car"."modelYearId"'
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
    const queryLatitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude")`;
    const queryLongitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude")`;
    const distances = models.sequelize.literal(
      distanceHelper.calculate(latitude, longitude, queryLatitude, queryLongitude)
    );

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

  const customFieldCar = await carHelper.customFields(customFields);
  if (isMarket && JSON.parse(isMarket) == true) {
    Object.assign(where, {
      [Op.and]: models.sequelize.where(customFieldCar[0][0], { [Op.gt]: 0 })
    });
  }

  const includes = [
    {
      model: models.ModelYear,
      as: 'modelYear',
      attributes: ['id', 'year', 'modelId'],
      where: whereModelYear
    },
    {
      model: models.City,
      as: 'city'
    },
    {
      model: models.SubDistrict,
      as: 'subdistrict'
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
    },
    {
      model: models.Purchase,
      as: 'purchase',
      attributes: ['price', 'createdAt']
    }
  ];

  return models.Car.findAll({
    attributes: Object.keys(models.Car.attributes).concat(
      [
        [
          models.sequelize.literal(
            `(SELECT "SubDistricts"."name" FROM "SubDistricts" where "SubDistricts".id = "Car"."subdistrictId")`
          ),
          'subdistrictName'
        ],
        [
          models.sequelize.literal(
            `(SELECT "Cities"."name" FROM "Cities" where "Cities".id = "Car"."cityId")`
          ),
          'cityName'
        ]
      ],
      customFieldCar
    ),
    include: includes,
    where,
    order,
    offset,
    limit
  })
    .then(async data => {
      const count = await models.Car.count({
        distinct: true,
        include: includes,
        where
      });

      const pagination = paginator.paging(page, count, limit);

      await Promise.all(
        data.map(async item => {
          if(item.brand.logo) {
            const url = await minio.getUrl(item.brand.logo).then(res => {
              return res;
            }).catch(err => {
              res.status(422).json({
                success: false,
                errors: err
              });
            });

            item.brand.dataValues.logoUrl = url;
          } else {
            item.brand.dataValues.logoUrl = null;
          }

          await Promise.all(
            item.interiorGalery.map(async itemInteriorGalery => {
              if(itemInteriorGalery.file.url) {
                const url = await minio.getUrl(itemInteriorGalery.file.url).then(res => {
                  return res;
                }).catch(err => {
                  res.status(422).json({
                    success: false,
                    errors: err
                  });
                });

                itemInteriorGalery.file.dataValues.fileUrl = url;
              } else {
                itemInteriorGalery.file.dataValues.fileUrl = null;
              }
            }),

            item.exteriorGalery.map(async itemExteriorGalery => {
              if(itemExteriorGalery.file.url) {
                const url = await minio.getUrl(itemExteriorGalery.file.url).then(res => {
                  return res;
                }).catch(err => {
                  res.status(422).json({
                    success: false,
                    errors: err
                  });
                });

                itemExteriorGalery.file.dataValues.fileUrl = url;
              } else {
                itemExteriorGalery.file.dataValues.fileUrl = null;
              }
            })
          );
        })
      );

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

async function sellRefactor(req, res) {
  const userId = req.user.id;
  const {
    minPrice,
    maxPrice,
    minYear,
    maxYear,
    minKm,
    maxKm,
    showDetailPhoto
  } = req.query;
  let { page, limit, by, sort } = req.query;
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (parseInt(limit, 10) > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  if (sort !== 'desc' && sort !== 'asc') sort = 'desc';
  if (by === 'date') {
    by = `c."createdAt"`;
  } else if (by === 'price') {
    by = `c."price"`;
  } else if (by === 'km') {
    by = `c."km"`;
  } else if (by === 'condition') {
    by = `c."condition"`;
  } else if (by === 'likes') {
    by = `likes`;
  } else if (by === 'views') {
    by = `views`;
  } else {
    by = 'c.id';
  }

  const replacements = { bidType: 0, userId };
  let conditionString = ``;
  
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

  let pictureSelect = ``;
  let pictureJoin = ``;
  if (showDetailPhoto === 'true') {
    pictureSelect = `,
    array_to_string(array_agg(eg.id::TEXT || '#sep#' || coalesce(egf."url", '<m>')),'|') AS "exteriorGaleries",
    array_to_string(array_agg(ig.id::TEXT || '#sep#' || coalesce(igf."url", '<m>')),'|') AS "interiorGaleries"`;
    pictureJoin = `LEFT JOIN "ExteriorGaleries" eg ON eg."carId" = c.id
    LEFT JOIN "Files" egf ON egf."id" = eg."fileId"
    LEFT JOIN "InteriorGaleries" ig ON ig."carId" = c.id
    LEFT JOIN "Files" igf ON igf."id" = ig."fileId"`;
  }
  const data = await models.sequelize
    .query(
      `WITH loan_cars AS (
        SELECT "id", "carId" FROM "Bargains" WHERE "deletedAt" IS NULL AND "negotiationType" IN (4,8)
      ), car_picture AS (
        SELECT "carId", MIN("fileId") AS "fileId" FROM "ExteriorGaleries" GROUP BY "carId"
      )

      select c.*, my.year, my.picture AS "modelYearPicture",
      my.price AS "modelYearPrice", m."name" AS "modelName", gm."name" AS "groupModelName", b."name" AS "brandName",
      b."logo" AS "brandLogo",
      count(distinct(b2."id")) AS "countBid", max(b2."bidAmount" ) AS "highestBid",
      count(distinct(isBid.id)) AS isBid, count(distinct(l.id)) AS likes,
      count(distinct(isLike.id)) AS isLike, count(distinct(v.id)) AS views,
      cpf."url" AS "carPicture", city."name" as "cityName",
      INITCAP(subdistrict."name") AS "subdistrictName", u."type" AS "userType", ic."name" AS "interiorColorName",
      ec."name" AS "exteriorColorName" ${pictureSelect}, purchase."id" AS "purchaseId", purchase."createdAt" AS "purchaseDate",
      buyer."id" AS "buyerId", buyer."name" AS "buyerName"
      FROM "Cars" c
      LEFT JOIN "Users" u ON u."id" = c."userId"
      LEFT JOIN "Cities" city ON city."id" = c."cityId"
      LEFT JOIN "SubDistricts" subdistrict ON subdistrict."id" = c."subdistrictId"
      LEFT JOIN "Colors" ic ON ic."id" = c."interiorColorId"
      LEFT JOIN "Colors" ec ON ec."id" = c."exteriorColorId"
      LEFT JOIN "ModelYears" my ON my."id" = c."modelYearId"
      LEFT JOIN "Models" m ON m."id" = c."modelId"
      LEFT JOIN "GroupModels" gm ON gm."id" = c."groupModelId"
      LEFT JOIN "Brands" b ON b."id" = c."brandId"
      LEFT JOIN "Bargains" b2 ON b2."carId" = c."id" and b2."bidType" = 0 AND b2."deletedAt" IS NULL
      LEFT JOIN "Bargains" isBid ON isBid."carId" = c."id" and isBid."bidType" = 0 AND isBid."deletedAt" IS NULL AND isBid."userId" = :userId 
      LEFT JOIN "Likes" l ON l."carId" = c.id AND l.status IS true
      LEFT JOIN "Likes" isLike ON isLike."carId" = c.id AND isLike."userId" = :userId AND isLike.status IS true
      LEFT JOIN "Views" v ON v."carId" = c.id
      LEFT JOIN "Views" vme ON vme."carId" = c.id AND vme."userId" = :userId
      LEFT JOIN "loan_cars" lc ON lc."carId" = c.id
      LEFT JOIN "car_picture" AS cp ON cp."carId" = c."id"
      LEFT JOIN "Files" AS cpf ON cpf."id" = cp."fileId"
      LEFT JOIN "Purchases" AS purchase ON purchase."carId" = c."id"
      LEFT JOIN "Users" AS buyer ON buyer."id" = purchase."userId"
      ${pictureJoin}
      WHERE c."userId" = :userId AND c."deletedAt" IS NULL ${conditionString}
      GROUP BY c."id", my.year, my.picture, my.price, m."name", gm."name", b."name",
      b."logo", cpf."url", city."name", subdistrict."name", u."type", ic."name", ec."name",
      purchase."id", "buyer".id
      ORDER BY ${by} ${sort}
      OFFSET ${offset} LIMIT ${limit}`,
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

  await Promise.all(
    data.map(async item => {
      if(item.STNKphoto) {
        const STNKphotoURL = await minio.getUrl(item.STNKphoto).then(res => {
          return res;
        }).catch(err => {
          res.status(422).json({
            success: false,
            errors: err
          });
        });

        item.STNKphoto = STNKphotoURL;
      }

      if(item.modelYearPicture) {
        const modelYearPictureURL = await minio.getUrl(item.modelYearPicture).then(res => {
          return res;
        }).catch(err => {
          res.status(422).json({
            success: false,
            errors: err
          });
        });

        item.modelYearPicture = modelYearPictureURL;
      }

      if(item.brandLogo) {
        const brandLogoURL = await minio.getUrl(item.brandLogo).then(res => {
          return res;
        }).catch(err => {
          res.status(422).json({
            success: false,
            errors: err
          });
        });

        item.brandLogo = brandLogoURL;
      }

      if(item.carPicture) {
        const carPictureURL = await minio.getUrl(item.carPicture).then(res => {
          return res;
        }).catch(err => {
          res.status(422).json({
            success: false,
            errors: err
          });
        });

        item.carPicture = carPictureURL;
      }
    })
  );

  if (showDetailPhoto === 'true') {
    function onlyUnique(value, index, self) {
      return self.indexOf(value) === index;
    }
    for (let i = 0; i < data.length; i += 1) {
      const exteriors = new Array();
      const eg = data[i].exteriorGaleries.split('|').filter(onlyUnique);
      for (let j = 0; j < eg.length; j += 1) {
        const egColumn = eg[j].split('#sep#');
        if (egColumn.length === 2) {
          if (egColumn[1] !== '<m>') {
            const pictureURL = await minio.getUrl(egColumn[1]).then(res => {
              return res;
            }).catch(err => {
              res.status(422).json({
                success: false,
                errors: err
              });
            });

            exteriors.push({
              id: parseInt(egColumn[0], 10),
              picture: pictureURL
            });
          }
        }
        data[i].exteriorGalery = exteriors;
        delete data[i].exteriorGaleries;
      }

      const interiors = new Array();
      const ig = data[i].interiorGaleries.split('|').filter(onlyUnique);
      for (let j = 0; j < ig.length; j += 1) {
        const igColumn = ig[j].split('#sep#');
        if (igColumn.length === 2) {
          if (igColumn[1] !== '<m>') {
            const pictureURL = await minio.getUrl(igColumn[1]).then(res => {
              return res;
            }).catch(err => {
              res.status(422).json({
                success: false,
                errors: err
              });
            });

            interiors.push({
              id: parseInt(igColumn[0], 10),
              picture: pictureURL
            });
          }
        }
      }
      data[i].interiorGalery = interiors;
      delete data[i].interiorGaleries;
    }
  }

  res.json({
    success: true,
    meta: req.query,
    data
  });
}

async function bidRefactor(req, res) {
  const userId = req.user.id;
  const {
    minPrice,
    maxPrice,
    minYear,
    maxYear,
    minKm,
    maxKm,
    showDetailPhoto
  } = req.query;
  let { page, limit, by, sort } = req.query;
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (parseInt(limit, 10) > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  if (sort !== 'desc' && sort !== 'asc') sort = 'desc';
  if (by === 'date') {
    by = `c."createdAt"`;
  } else if (by === 'price') {
    by = `c."price"`;
  } else if (by === 'km') {
    by = `c."km"`;
  } else if (by === 'condition') {
    by = `c."condition"`;
  } else if (by === 'likes') {
    by = `likes`;
  } else if (by === 'views') {
    by = `views`;
  } else {
    by = 'c.id';
  }

  const replacements = { bidType: 0, userId };
  let conditionString = ``;
  
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

  let pictureSelect = ``;
  let pictureJoin = ``;
  if (showDetailPhoto === 'true') {
    pictureSelect = `,
    array_to_string(array_agg(eg.id::TEXT || '#sep#' || coalesce(egf."url", '<m>')),'|') AS "exteriorGaleries",
    array_to_string(array_agg(ig.id::TEXT || '#sep#' || coalesce(igf."url", '<m>')),'|') AS "interiorGaleries"`;
    pictureJoin = `LEFT JOIN "ExteriorGaleries" eg ON eg."carId" = c.id
    LEFT JOIN "Files" egf ON egf."id" = eg."fileId"
    LEFT JOIN "InteriorGaleries" ig ON ig."carId" = c.id
    LEFT JOIN "Files" igf ON igf."id" = ig."fileId"`;
  }
  const data = await models.sequelize
    .query(
      `WITH loan_cars AS (
        SELECT "id", "carId" FROM "Bargains" WHERE "deletedAt" IS NULL AND "negotiationType" IN (4,8)
      ), car_picture AS (
        SELECT "carId", MIN("fileId") AS "fileId" FROM "ExteriorGaleries" GROUP BY "carId"
      )

      select c.*, my.year, my.picture AS "modelYearPicture",
      my.price AS "modelYearPrice", m."name" AS "modelName", gm."name" AS "groupModelName", b."name" AS "brandName",
      b."logo" AS "brandLogo",
      count(distinct(b2."id")) AS "countBid", max(b2."bidAmount" ) AS "highestBid", b3."bidAmount" AS bidAmount,
      count(distinct(isBid.id)) AS isBid, count(distinct(l.id)) AS likes,
      count(distinct(isLike.id)) AS isLike, count(distinct(v.id)) AS views,
      cpf."url" AS "carPicture", city."name" as "cityName",
      INITCAP(subdistrict."name") AS "subdistrictName", u."type" AS "userType", ic."name" AS "interiorColorName",
      ec."name" AS "exteriorColorName" ${pictureSelect}, purchase."id" AS "purchaseId", purchase."createdAt" AS "purchaseDate",
      buyer."id" AS "buyerId", buyer."name" AS "buyerName"
      FROM "Cars" c
      LEFT JOIN "Users" u ON u."id" = c."userId"
      LEFT JOIN "Cities" city ON city."id" = c."cityId"
      LEFT JOIN "SubDistricts" subdistrict ON subdistrict."id" = c."subdistrictId"
      LEFT JOIN "Colors" ic ON ic."id" = c."interiorColorId"
      LEFT JOIN "Colors" ec ON ec."id" = c."exteriorColorId"
      LEFT JOIN "ModelYears" my ON my."id" = c."modelYearId"
      LEFT JOIN "Models" m ON m."id" = c."modelId"
      LEFT JOIN "GroupModels" gm ON gm."id" = c."groupModelId"
      LEFT JOIN "Brands" b ON b."id" = c."brandId"
      LEFT JOIN "Bargains" b2 ON b2."carId" = c."id" and b2."bidType" = 0 AND b2."deletedAt" IS NULL
      LEFT JOIN "Bargains" b3 ON b3."carId" = c."id" and b3."bidType" = 0 AND b3."userId" = :userId AND b3."deletedAt" IS NULL
      LEFT JOIN "Bargains" isBid ON isBid."carId" = c."id" and isBid."bidType" = 0 AND isBid."deletedAt" IS NULL AND isBid."userId" = :userId 
      LEFT JOIN "Likes" l ON l."carId" = c.id AND l.status IS true
      LEFT JOIN "Likes" isLike ON isLike."carId" = c.id AND isLike."userId" = :userId AND isLike.status IS true
      LEFT JOIN "Views" v ON v."carId" = c.id
      LEFT JOIN "Views" vme ON vme."carId" = c.id AND vme."userId" = :userId
      LEFT JOIN "loan_cars" lc ON lc."carId" = c.id
      LEFT JOIN "car_picture" AS cp ON cp."carId" = c."id"
      LEFT JOIN "Files" AS cpf ON cpf."id" = cp."fileId"
      LEFT JOIN "Purchases" AS purchase ON purchase."carId" = c."id"
      LEFT JOIN "Users" AS buyer ON buyer."id" = purchase."userId"
      ${pictureJoin}
      WHERE c."status" = 0 AND c."roomId" IS NULL AND c."deletedAt" IS NULL ${conditionString}
      GROUP BY c."id", my.year, my.picture, my.price, m."name", gm."name", b."name",
      b."logo", cpf."url", city."name", subdistrict."name", u."type", ic."name", ec."name",
      purchase."id", "buyer".id, b3."bidAmount"
      HAVING count(distinct(isBid.id)) > 0
      ORDER BY ${by} ${sort}
      OFFSET ${offset} LIMIT ${limit}`,
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

  await Promise.all(
    data.map(async item => {
      if(item.STNKphoto) {
        const STNKphotoURL = await minio.getUrl(item.STNKphoto).then(res => {
          return res;
        }).catch(err => {
          res.status(422).json({
            success: false,
            errors: err
          });
        });

        item.STNKphoto = STNKphotoURL;
      }

      if(item.modelYearPicture) {
        const modelYearPictureURL = await minio.getUrl(item.modelYearPicture).then(res => {
          return res;
        }).catch(err => {
          res.status(422).json({
            success: false,
            errors: err
          });
        });

        item.modelYearPicture = modelYearPictureURL;
      }

      if(item.brandLogo) {
        const brandLogoURL = await minio.getUrl(item.brandLogo).then(res => {
          return res;
        }).catch(err => {
          res.status(422).json({
            success: false,
            errors: err
          });
        });

        item.brandLogo = brandLogoURL;
      }

      if(item.carPicture) {
        const carPictureURL = await minio.getUrl(item.carPicture).then(res => {
          return res;
        }).catch(err => {
          res.status(422).json({
            success: false,
            errors: err
          });
        });

        item.carPicture = carPictureURL;
      }
    })
  );

  if (showDetailPhoto === 'true') {
    function onlyUnique(value, index, self) {
      return self.indexOf(value) === index;
    }
    for (let i = 0; i < data.length; i += 1) {
      const exteriors = new Array();
      const eg = data[i].exteriorGaleries.split('|').filter(onlyUnique);
      for (let j = 0; j < eg.length; j += 1) {
        const egColumn = eg[j].split('#sep#');
        if (egColumn.length === 2) {
          if (egColumn[1] !== '<m>') {
            const pictureURL = await minio.getUrl(egColumn[1]).then(res => {
              return res;
            }).catch(err => {
              res.status(422).json({
                success: false,
                errors: err
              });
            });

            exteriors.push({
              id: parseInt(egColumn[0], 10),
              picture: pictureURL
            });
          }
        }
        data[i].exteriorGalery = exteriors;
        delete data[i].exteriorGaleries;
      }

      const interiors = new Array();
      const ig = data[i].interiorGaleries.split('|').filter(onlyUnique);
      for (let j = 0; j < ig.length; j += 1) {
        const igColumn = ig[j].split('#sep#');
        if (igColumn.length === 2) {
          if (igColumn[1] !== '<m>') {
            const pictureURL = await minio.getUrl(igColumn[1]).then(res => {
              return res;
            }).catch(err => {
              res.status(422).json({
                success: false,
                errors: err
              });
            });
            
            interiors.push({
              id: parseInt(igColumn[0], 10),
              picture: pictureURL
            });
          }
        }
      }
      data[i].interiorGalery = interiors;
      delete data[i].interiorGaleries;
    }
  }

  res.json({
    success: true,
    meta: req.query,
    data
  });
}

async function like(req, res) {
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
  if (parseInt(limit) > MAX_LIMIT) limit = MAX_LIMIT;
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
    fields: ['islike', 'isBid', 'like', 'view', 'numberOfBidder', 'highestBidder', 'bidAmount'],
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
    const queryLatitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("car"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude")`;
    const queryLongitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("car"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude")`;
    const distances = models.sequelize.literal(
      distanceHelper.calculate(latitude, longitude, queryLatitude, queryLongitude)
    );

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
          model: models.City,
          as: 'city'
        },
        {
          model: models.SubDistrict,
          as: 'subdistrict'
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

      await Promise.all(
        data.map(async item => {
          if(item.car) {
            if(item.car.STNKphoto) {
              const url = await minio.getUrl(item.car.STNKphoto).then(res => {
                return res;
              }).catch(err => {
                res.status(422).json({
                  success: false,
                  errors: err
                });
              });

              item.car.dataValues.stnkUrl = url;
            } else {
              item.car.dataValues.stnkUrl = null;
            }

            if(item.car.brand.logo) {
              const url = await minio.getUrl(item.car.brand.logo).then(res => {
                return res;
              }).catch(err => {
                res.status(422).json({
                  success: false,
                  errors: err
                });
              });

              item.car.brand.dataValues.logoUrl = url;
            } else {
              item.car.brand.dataValues.logoUrl = null;
            }

            await Promise.all(
              item.car.interiorGalery.map(async itemInteriorGalery => {
                if(itemInteriorGalery.file.url) {
                  const url = await minio.getUrl(itemInteriorGalery.file.url).then(res => {
                    return res;
                  }).catch(err => {
                    res.status(422).json({
                      success: false,
                      errors: err
                    });
                  });

                  itemInteriorGalery.file.dataValues.fileUrl = url;
                } else {
                  itemInteriorGalery.file.dataValues.fileUrl = null;
                }
              }),

              item.car.exteriorGalery.map(async itemExteriorGalery => {
                if(itemExteriorGalery.file.url) {
                  const url = await minio.getUrl(itemExteriorGalery.file.url).then(res => {
                    return res;
                  }).catch(err => {
                    res.status(422).json({
                      success: false,
                      errors: err
                    });
                  });

                  itemExteriorGalery.file.dataValues.fileUrl = url;
                } else {
                  itemExteriorGalery.file.dataValues.fileUrl = null;
                }
              })
            );
          }
        })
      );

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
}

async function view(req, res) {
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
  if (parseInt(limit) > MAX_LIMIT) limit = MAX_LIMIT;
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
    fields: ['islike', 'isBid', 'like', 'view', 'numberOfBidder', 'highestBidder', 'bidAmount'],
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
    const queryLatitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("car"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude")`;
    const queryLongitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("car"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude")`;
    const distances = models.sequelize.literal(
      distanceHelper.calculate(latitude, longitude, queryLatitude, queryLongitude)
    );

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
          model: models.City,
          as: 'city'
        },
        {
          model: models.SubDistrict,
          as: 'subdistrict'
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

      await Promise.all(
        data.map(async item => {
          if(item.car) {
            if(item.car.STNKphoto) {
              const url = await minio.getUrl(item.car.STNKphoto).then(res => {
                return res;
              }).catch(err => {
                res.status(422).json({
                  success: false,
                  errors: err
                });
              });

              item.car.dataValues.stnkUrl = url;
            } else {
              item.car.dataValues.stnkUrl = null;
            }

            if(item.car.brand.logo) {
              const url = await minio.getUrl(item.car.brand.logo).then(res => {
                return res;
              }).catch(err => {
                res.status(422).json({
                  success: false,
                  errors: err
                });
              });

              item.car.brand.dataValues.logoUrl = url;
            } else {
              item.car.brand.dataValues.logoUrl = null;
            }

            await Promise.all(
              item.car.interiorGalery.map(async itemInteriorGalery => {
                if(itemInteriorGalery.file.url) {
                  const url = await minio.getUrl(itemInteriorGalery.file.url).then(res => {
                    return res;
                  }).catch(err => {
                    res.status(422).json({
                      success: false,
                      errors: err
                    });
                  });

                  itemInteriorGalery.file.dataValues.fileUrl = url;
                } else {
                  itemInteriorGalery.file.dataValues.fileUrl = null;
                }
              }),

              item.car.exteriorGalery.map(async itemExteriorGalery => {
                if(itemExteriorGalery.file.url) {
                  const url = await minio.getUrl(itemExteriorGalery.file.url).then(res => {
                    return res;
                  }).catch(err => {
                    res.status(422).json({
                      success: false,
                      errors: err
                    });
                  });

                  itemExteriorGalery.file.dataValues.fileUrl = url;
                } else {
                  itemExteriorGalery.file.dataValues.fileUrl = null;
                }
              })
            );
          }
        })
      );

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
  if (parseInt(limit) > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  const array = ['id', 'condition', 'price', 'km', 'createdAt', 'like', 'view', 'profile'];
  if (array.indexOf(by) < 0) by = 'createdAt';
  sort = ['asc', 'desc'].indexOf(sort) < 0 ? 'asc' : sort;
  const order = [];
  switch (by) {
    case 'like':
    case 'view':
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
    fields: ['Brands', 'Model', 'highestBidder', 'numberOfBidder', 'like', 'view'],
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
    const queryLatitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude")`;
    const queryLongitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude")`;
    const distances = models.sequelize.literal(
      distanceHelper.calculate(latitude, longitude, queryLatitude, queryLongitude)
    );

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
      model: models.City,
      as: 'city'
    },
    {
      model: models.SubDistrict,
      as: 'subdistrict'
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

      await Promise.all(
        data.map(async item => {
          if(item.brand.logo) {
            const url = await minio.getUrl(item.brand.logo).then(res => {
              return res;
            }).catch(err => {
              res.status(422).json({
                success: false,
                errors: err
              });
            });

            item.brand.dataValues.logoUrl = url;
          } else {
            item.brand.dataValues.logoUrl = null;
          }

          if(item.user.file.url) {
            const url = await minio.getUrl(item.user.file.url).then(res => {
              return res;
            }).catch(err => {
              res.status(422).json({
                success: false,
                errors: err
              });
            });

            item.user.file.dataValues.fileUrl = url;
          } else {
            item.user.file.dataValues.fileUrl = null;
          }

          await Promise.all(
            item.interiorGalery.map(async itemInteriorGalery => {
              if(itemInteriorGalery.file.url) {
                const url = await minio.getUrl(itemInteriorGalery.file.url).then(res => {
                  return res;
                }).catch(err => {
                  res.status(422).json({
                    success: false,
                    errors: err
                  });
                });

                itemInteriorGalery.file.dataValues.fileUrl = url;
              } else {
                itemInteriorGalery.file.dataValues.fileUrl = null;
              }
            }),

            item.exteriorGalery.map(async itemExteriorGalery => {
              if(itemExteriorGalery.file.url) {
                const url = await minio.getUrl(itemExteriorGalery.file.url).then(res => {
                  return res;
                }).catch(err => {
                  res.status(422).json({
                    success: false,
                    errors: err
                  });
                });

                itemExteriorGalery.file.dataValues.fileUrl = url;
              } else {
                itemExteriorGalery.file.dataValues.fileUrl = null;
              }
            })
          );
        })
      );

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

async function viewLikeLogon(req, res) {
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
    cityId,
    subdistrictId,
    exteriorColorId,
    interiorColorId,
    minKm,
    maxKm,
    profileUser
  } = req.query;
  let { latitude, longitude } = req.query;
  let { page, limit, by, sort } = req.query;
  const userId = req.user.id;
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (parseInt(limit) > MAX_LIMIT) limit = MAX_LIMIT;
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

  const addAttributes = {
    fields: [
      'like',
      'islike',
      'isBid',
      'view',
      'Brands',
      'Model',
      'jumlahLike',
      'jumlahView',
      'highestBidder',
      'numberOfBidder',
      'sumBargains',
      'bidAmount'
    ],
    upperCase: true,
    id: userId
  };

  const whereUser = {};
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

  if (modelYearId) {
    Object.assign(where, {
      modelYearId
    });
  }

  if (groupModelId) {
    Object.assign(where, {
      groupModelId
    });
  }

  if (condition) {
    Object.assign(where, {
      condition
    });
  }

  if (modelId) {
    Object.assign(where, {
      modelId
    });
  }

  if (brandId) {
    Object.assign(where, {
      brandId
    });
  }

  if (exteriorColorId) {
    Object.assign(where, {
      exteriorColorId
    });
  }

  if (interiorColorId) {
    Object.assign(where, {
      interiorColorId
    });
  }

  if (profileUser == 'End User') {
    Object.assign(whereUser, {
      [Op.or]: [
        { type: 0, companyType: 0 },
        { type: 0, companyType: 1 }
      ]
    });
  }

  if (profileUser == 'Dealer') {
    Object.assign(whereUser, {
      [Op.or]: [
        { type: 1, companyType: 0 },
        { type: 1, companyType: 1 }
      ]
    });
  }

  if (minKm && maxKm) {
    Object.assign(where, {
      km: {
        [Op.and]: [{ [Op.gte]: minKm }, { [Op.lte]: maxKm }]
      }
    });
  } else if (minKm) {
    Object.assign(where, {
      km: {
        [Op.gte]: minKm
      }
    });
  } else if (maxKm) {
    Object.assign(where, {
      km: {
        [Op.lte]: maxKm
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

    const queryLatitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude")`;
    const queryLongitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude")`;
    const distances = models.sequelize.literal(
      distanceHelper.calculate(latitude, longitude, queryLatitude, queryLongitude)
    );

    Object.assign(where, {
      [Op.and]: [models.sequelize.where(distances, { [Op.lte]: radius })]
    });

    addAttributes.fields.push('distance');
    Object.assign(addAttributes, {
      latitude,
      longitude
    });
  }

  if (by === 'area') {
    if (cityId) {
      const city = await models.City.findByPk(cityId);
      if (!city) return res.status(400).json({ success: false, errors: 'City not found!' });

      if (subdistrictId) {
        const subdistrict = await models.SubDistrict.findOne({
          where: { id: subdistrictId, cityId }
        });

        if (!subdistrict)
          return res.status(400).json({ success: false, errors: 'Subdistrict not found!' });

        if (city && subdistrict) {
          latitude = subdistrict.latitude;
          longitude = subdistrict.longitude;
        }
      } else if (city) {
        latitude = city.latitude;
        longitude = city.longitude;
      }

      const queryLatitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude")`;
      const queryLongitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude")`;
      const distances = models.sequelize.literal(
        distanceHelper.calculate(latitude, longitude, queryLatitude, queryLongitude)
      );

      if (radius) {
        Object.assign(where, {
          where: {
            [Op.and]: [Sequelize.where(distances, { [Op.lte]: Number(radius) })]
          }
        });
      } else if (cityId && subdistrictId) {
        Object.assign(where, {
          cityId,
          subdistrictId
        });
      } else if (cityId) {
        Object.assign(where, {
          cityId
        });
      }

      addAttributes.fields.push('distance');
      Object.assign(addAttributes, {
        latitude,
        longitude
      });
    } else {
      return res.status(400).json({ success: false, errors: 'Please Select City!' });
    }
  }

  if (latitude && longitude && radius && by != 'area' && by != 'location') {
    const queryLatitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude")`;
    const queryLongitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("Car"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude")`;
    const distances = models.sequelize.literal(
      distanceHelper.calculate(latitude, longitude, queryLatitude, queryLongitude)
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

  if (
    cityId &&
    subdistrictId &&
    radius == '' &&
    (latitude == '') & (longitude == '') &&
    by != 'area' &&
    by != 'location'
  ) {
    const city = await models.City.findByPk(cityId);
    if (!city) return res.status(400).json({ success: false, errors: 'City not found!' });

    if (subdistrictId) {
      const subdistrict = await models.SubDistrict.findOne({
        where: { id: subdistrictId, cityId }
      });

      if (!subdistrict)
        return res.status(400).json({ success: false, errors: 'Subdistrict not found!' });

      if (city && subdistrict) {
        latitude = subdistrict.latitude;
        longitude = subdistrict.longitude;
      }
    } else if (city) {
      latitude = city.latitude;
      longitude = city.longitude;
    }

    if (cityId && subdistrictId) {
      Object.assign(where, {
        cityId,
        subdistrictId
      });
    } else if (cityId) {
      Object.assign(where, {
        cityId
      });
    }

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
        model: models.City,
        as: 'city'
      },
      {
        model: models.SubDistrict,
        as: 'subdistrict'
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

      await Promise.all(
        data.map(async item => {
          if(item.brand.logo) {
            const url = await minio.getUrl(item.brand.logo).then(res => {
              return res;
            }).catch(err => {
              res.status(422).json({
                success: false,
                errors: err
              });
            });

            item.brand.dataValues.logoUrl = url;
          } else {
            item.brand.dataValues.logoUrl = null;
          }

          if(item.user.file.url) {
            const url = await minio.getUrl(item.user.file.url).then(res => {
              return res;
            }).catch(err => {
              res.status(422).json({
                success: false,
                errors: err
              });
            });

            item.user.file.dataValues.fileUrl = url;
          } else {
            item.user.file.dataValues.fileUrl = null;
          }

          if(item.modelYear.picture) {
            const url = await minio.getUrl(item.modelYear.picture).then(res => {
              return res;
            }).catch(err => {
              res.status(422).json({
                success: false,
                errors: err
              });
            });

            item.modelYear.dataValues.pictureUrl = url;
          } else {
            item.modelYear.dataValues.pictureUrl = null;
          }

          await Promise.all(
            item.interiorGalery.map(async itemInteriorGalery => {
              if(itemInteriorGalery.file.url) {
                const url = await minio.getUrl(itemInteriorGalery.file.url).then(res => {
                  return res;
                }).catch(err => {
                  res.status(422).json({
                    success: false,
                    errors: err
                  });
                });

                itemInteriorGalery.file.dataValues.fileUrl = url;
              } else {
                itemInteriorGalery.file.dataValues.fileUrl = null;
              }
            }),

            item.exteriorGalery.map(async itemExteriorGalery => {
              if(itemExteriorGalery.file.url) {
                const url = await minio.getUrl(itemExteriorGalery.file.url).then(res => {
                  return res;
                }).catch(err => {
                  res.status(422).json({
                    success: false,
                    errors: err
                  });
                });

                itemExteriorGalery.file.dataValues.fileUrl = url;
              } else {
                itemExteriorGalery.file.dataValues.fileUrl = null;
              }
            })
          );
        })
      );

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

async function checkBid(req, res) {
  const userId = req.user.id;
  const { id } = req.params;
  const checkBid = await models.sequelize.query(
    `SELECT CASE WHEN (SELECT COUNT("Bargains"."id")
    FROM "Bargains"
    WHERE "Bargains"."userId" = ${userId}
      AND "Bargains"."carId" = ${id}
      AND "Bargains"."deletedAt" IS NULL 
      AND "Bargains"."expiredAt" >= (SELECT NOW()) 
      AND "Bargains"."bidType" = 0) > 0 THEN true
    ELSE false
    END AS isBid;`,
    { type: models.sequelize.QueryTypes.SELECT }
  );

  const bid = await models.Bargain.findAll({
    include: [
      {
        model: models.Car,
        as: 'car'
      }
    ],
    where: {
      userId,
      carId: id,
      bidType: 0
    }
  }).then(async data => data);

  await Promise.all(
    bid.map(async item => {
      if(item.car) {
        if(item.car.STNKphoto) {
          const url = await minio.getUrl(item.car.STNKphoto).then(res => {
            return res;
          }).catch(err => {
            res.status(422).json({
              success: false,
              errors: err
            });
          });

          item.car.dataValues.stnkUrl = url;
        } else {
          item.car.dataValues.stnkUrl = null;
        }
      }
    })
  );

  res.json({
    success: true,
    data: {
      isBid: checkBid[0].isbid,
      bid
    }
  });
}

module.exports = {
  carsGet,
  carsGetRefactor,
  getById,
  getByIdRefactor,
  getByUserId,
  getByStatus,
  purchaseList,
  bidList,
  sell,
  sellList,
  sellRefactor,
  bidRefactor,
  like,
  view,
  viewLike,
  viewLikeLogon,
  checkBid
};
