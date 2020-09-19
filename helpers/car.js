/* eslint-disable linebreak-style */

const Sequelize = require('sequelize');
const models = require('../db/models');
const distanceHelper = require('./distance');
const { Op } = Sequelize;

async function customFields(params) {
  if(!params.whereQuery) {
    params.whereQuery = '';
  } else {
    params.whereQuery = params.whereQuery.replace(/"Car"/g, '"c"');
  }

  const fields = [];
  let car = 'upperCase' in params ? (params.upperCase ? 'Car' : 'car') : 'car';
  car = 'customCar' in params ? params.customCar : car;
  let modelYear = 'modelYearLowerCase' in params ? 'modelYear' : 'ModelYear';
  modelYear = 'modelYearLowerCasePrefix' in params ? `${modelYear}s` : modelYear;
  const modelYearId = params.modelYearId || `"${modelYear}"."id"`;

  params.fields.map(async field => {
    switch (field) {

      // Like & View
      case 'like':
        fields.push([
          models.sequelize.literal(
            `(SELECT COUNT("Likes"."id") 
              FROM "Likes" 
              WHERE "Likes"."carId" = "${car}"."id" 
                AND "Likes"."status" IS TRUE 
                AND "Likes"."deletedAt" IS NULL
            )`
          ),
          'like'
        ]);
        break;

      case 'view':
        fields.push([
          models.sequelize.literal(
            `(SELECT COUNT("Views"."id") 
              FROM "Views" 
              WHERE "Views"."carId" = "${car}"."id" 
                AND "Views"."deletedAt" IS NULL
            )`
          ),
          'view'
        ]);
        break;

      case 'jumlahLike':
        fields.push([
          models.sequelize.literal(
            `(SELECT COUNT("Likes"."carId") 
              FROM "Likes" 
              WHERE "Likes"."carId" = "${car}"."id" 
                AND "Likes"."status" IS TRUE 
                AND "Likes"."deletedAt" IS NULL
            )`
          ),
          'jumlahLike'
        ]);
        break;

      case 'jumlahView':
        fields.push([
          models.sequelize.literal(
            `(SELECT COUNT("Views"."carId") 
              FROM "Views" 
              WHERE "Views"."carId" = "${car}"."id" 
                AND "Views"."deletedAt" IS NULL
            )`
          ),
          'jumlahView'
        ]);
        break;

      case 'islike':
        fields.push([
          models.sequelize.literal(
            `(SELECT COUNT("Likes"."id") 
              FROM "Likes" 
              WHERE "Likes"."carId" = "${car}"."id" 
                AND "Likes"."status" IS TRUE 
                AND "Likes"."userId" = ${params.id} 
                AND "Likes"."deletedAt" IS NULL
            )`
          ),
          'islike'
        ]);
        break;
      // Like & View

      // Bargain & Purchase
      case 'isBid':
        fields.push([
          models.sequelize.literal(
            `(SELECT COUNT("Bargains"."id") 
              FROM "Bargains" 
              WHERE "Bargains"."userId" = ${params.id} 
                AND "Bargains"."carId" = "${car}"."id" 
                AND "Bargains"."expiredAt" >= (SELECT NOW())
                AND "Bargains"."bidType" = 0 
                AND "Bargains"."deletedAt" IS NULL
            )`
          ),
          'isBid'
        ]);
        break;

      case 'sumBargains':
        fields.push([
          models.sequelize.literal(
            `(SELECT COUNT("Bargains"."id") 
              FROM "Bargains" 
              WHERE "Bargains"."userId" = ${params.id} 
                AND "Bargains"."carId" = "${car}"."id" 
                AND "Bargains"."expiredAt" >= (SELECT NOW()) 
                AND "Bargains"."deletedAt" IS NULL
            )`
          ),
          'sumBargains'
        ]);
        break;

      case 'numberOfBidder':
        fields.push([
          models.sequelize.literal(
            `(SELECT COUNT("Bargains"."id") 
              FROM "Bargains" 
              WHERE "Bargains"."carId" = "${car}"."id" 
                AND "Bargains"."deletedAt" IS NULL 
                AND "Bargains"."bidType" = 0
                AND (SELECT COUNT("b"."id")
                  FROM "Bargains" b
                  WHERE "b"."deletedAt" IS NULL
                    AND "b"."negotiationType" IN (4,7,8)
                    AND "b"."carId" = "Bargains"."carId") = 0
            )`
          ),
          'numberOfBidder'
        ]);
        break;

      case 'numberOfBidderModelYear':
        fields.push([
          models.sequelize.literal(
            `(SELECT COUNT("Bargains"."id") 
              FROM "Bargains" 
              LEFT JOIN "Cars" as "c" 
                ON "Bargains"."carId" = "c"."id" 
              WHERE "c"."modelYearId" = "${modelYear}"."id"
                AND "Bargains"."deletedAt" IS NULL 
                AND "Bargains"."bidType" = 0 
                ${params.whereQuery}
                AND (SELECT COUNT("b"."id")
                  FROM "Bargains" b
                  WHERE "b"."deletedAt" IS NULL
                    AND "b"."negotiationType" IN (4,7,8)
                    AND "b"."carId" = "Bargains"."carId") = 0
            )`
          ),
          'numberOfBidder'
        ]);
        break;

      case 'highestBidder':
        fields.push([
          models.sequelize.literal(
            `(SELECT MAX("Bargains"."bidAmount") 
              FROM "Bargains" 
              WHERE "Bargains"."carId" = "${car}"."id" 
                AND "Bargains"."deletedAt" IS NULL 
                AND "Bargains"."bidType" = 0
                AND (SELECT COUNT("b"."id")
                  FROM "Bargains" b
                  WHERE "b"."deletedAt" IS NULL
                    AND "b"."negotiationType" IN (4,7,8)
                    AND "b"."carId" = "Bargains"."carId") = 0
            )`
          ),
          'highestBidder'
        ]);
        break;

      case 'bidAmount':
        let whereUserId = ``;
        if(params.id) {
          whereUserId = ` AND "Bargains"."userId" = ${params.id}`
        }

        fields.push([
          models.sequelize.literal(
            `(SELECT MAX("Bargains"."bidAmount") 
              FROM "Bargains" 
              WHERE "Bargains"."carId" = "${car}"."id" 
                AND "Bargains"."deletedAt" IS NULL 
                AND "Bargains"."bidType" = 0
                AND (SELECT COUNT("b"."id")
                  FROM "Bargains" b
                  WHERE "b"."deletedAt" IS NULL
                    AND "b"."negotiationType" IN (4,7,8)
                    AND "b"."carId" = "Bargains"."carId") = 0
                ${whereUserId}
            )`
          ),
          'bidAmount'
        ]);
        break;

      case 'bidAmountModelYears':
        fields.push([
          models.sequelize.literal(
            `(SELECT MAX("Bargains"."bidAmount") 
              FROM "Bargains" 
              WHERE "Bargains"."carId" = "${car}"."id" 
                AND "Bargains"."deletedAt" IS NULL 
                AND "Bargains"."bidType" = 0
                AND (SELECT COUNT("b"."id")
                  FROM "Bargains" b
                  WHERE "b"."deletedAt" IS NULL
                    AND "b"."negotiationType" IN (4,7,8)
                    AND "b"."carId" = "Bargains"."carId") = 0
            )`
          ),
          'bidAmount'
        ]);
        break;

      case 'highestBidderModelYear':
        fields.push([
          models.sequelize.literal(
            `(SELECT MAX("Bargains"."bidAmount") 
              FROM "Bargains" 
              LEFT JOIN "Cars" as "c" 
                ON "Bargains"."carId" = "c"."id" 
              WHERE "c"."modelYearId" = "${modelYear}"."id" 
                AND "Bargains"."deletedAt" IS NULL 
                AND "Bargains"."bidType" = 0 
                AND (SELECT COUNT("b"."id")
                  FROM "Bargains" b
                  WHERE "b"."deletedAt" IS NULL
                    AND "b"."negotiationType" IN (4,7,8)
                    AND "b"."carId" = "Bargains"."carId") = 0
                ${params.whereQuery}
            )`
          ),
          'highestBidder'
        ]);
        break;

      case 'highestBidderCarId':
        fields.push([
          models.sequelize.literal(
            `(SELECT "Bargains"."carId" 
              FROM "Bargains" 
              LEFT JOIN "Cars" as "c" 
                ON "Bargains"."carId" = "c"."id" 
              WHERE "c"."modelYearId" = "${modelYear}"."id" 
                AND "Bargains"."deletedAt" IS NULL 
                AND "Bargains"."bidType" = 0 
                AND (SELECT COUNT("b"."id")
                  FROM "Bargains" b
                  WHERE "b"."deletedAt" IS NULL
                    AND "b"."negotiationType" IN (4,7,8)
                    AND "b"."carId" = "Bargains"."carId") = 0
                ${params.whereQuery} 
              ORDER BY "Bargains"."bidAmount" 
              DESC LIMIT 1
            )`
          ),
          'highestBidderCarId'
        ]);
        break;

      case 'numberOfPurchase':
        fields.push([
          models.sequelize.literal(
            `(SELECT COUNT("Purchase"."id") 
              FROM "Purchases" as "Purchase" 
              LEFT JOIN "Cars" as "c" 
                ON "Purchase"."carId" = "c"."id" 
              WHERE "c"."status" = 2 
                AND "c"."modelYearId" = ${modelYearId} 
                AND "c"."deletedAt" IS NULL ${params.whereQuery}
            )`
          ),
          'numberOfPurchase'
        ]);
        break;

      case 'purchase':
        fields.push([
          models.sequelize.literal(
            `(SELECT COUNT("Purchase"."id") 
              FROM "Purchases" as "Purchase" 
              LEFT JOIN "Cars" as "c" 
                ON "Purchase"."carId" = "c"."id" 
              WHERE "c"."status" = 2 
                AND "c"."modelYearId" = ${modelYearId} 
                AND "c"."deletedAt" IS NULL ${params.whereQuery}
            )`
          ),
          'purchase'
        ]);
        break;

      case 'lastPurchaseAmount':
        fields.push([
          models.sequelize.literal(
            `(COALESCE((SELECT "Purchase"."price"
              FROM "Purchases" as "Purchase" 
              LEFT JOIN "Cars" as "c" 
                ON "Purchase"."carId" = "c"."id" 
              WHERE "c"."status" = 2 
                AND "c"."modelYearId" = ${modelYearId} 
                AND "c"."deletedAt" IS NULL ${params.whereQuery}
              ORDER BY "Purchase"."id"
              LIMIT 1
            ), 0))`
          ),
          'lastPurchaseAmount'
        ]);
        break;
      // Bargain & Purchase

      // Car
      case 'latitude':
        fields.push([
          models.sequelize.literal(`(SELECT split_part("${car}"."location", ',', 1))`),
          'latitude'
        ]);
        break;

      case 'longitude':
        fields.push([
          models.sequelize.literal(`(SELECT split_part("${car}"."location", ',', 2))`),
          'longitude'
        ]);
        break;

      case 'distance':
        const queryLatitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("${car}"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude")`;
        const queryLongitude = `(SELECT CAST(COALESCE(NULLIF((SELECT split_part("${car}"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude")`;
        const distances = distanceHelper.calculate(params.latitude, params.longitude, queryLatitude, queryLongitude);
        fields.push([
          models.sequelize.literal(distances),
          'distance'
        ]);
        break;

      case 'Brands':
        fields.push([
          models.sequelize.literal(
            `(SELECT "Brands"."name" 
              FROM "Brands" 
              WHERE "Brands"."id" = "${car}"."brandId" 
                AND "Brands"."deletedAt" IS NULL
            )`
          ),
          'Brands'
        ]);
        break;

      case 'Model':
        fields.push([
          models.sequelize.literal(
            `(SELECT "Models"."name" 
              FROM "Models" 
              WHERE "Models"."id" = "${car}"."modelId" 
                AND "Models"."deletedAt" IS NULL
            )`
          ),
          'Model'
        ]);
        break;      

      case 'numberOfCar':
        const statusQuery = ` AND "c"."status" IN (0,1)`;
        const defaultQuery = params.whereQuery.includes('"c"."status"') ? params.whereQuery : statusQuery;
        fields.push([
          models.sequelize.literal(
            `(SELECT COUNT("c"."id") 
              FROM "Cars" as "c" 
              WHERE "c"."modelYearId" = "${modelYear}"."id" 
                AND "c"."deletedAt" IS NULL
                ${defaultQuery}
            )`
          ),
          'numberOfCar'
        ]);
        break;

      case 'maxPrice':
        fields.push([
          models.sequelize.literal(
            `(SELECT MAX("c"."price") 
              FROM "Cars" as "c" 
              WHERE "c"."modelYearId" = "${modelYear}"."id" 
                AND "c"."deletedAt" IS NULL ${params.whereQuery}
            )`
          ),
          'maxPrice'
        ]);
        break;

      case 'minPrice':
        fields.push([
          models.sequelize.literal(
            `(SELECT MIN("c"."price") 
              FROM "Cars" as "c" 
              WHERE "c"."modelYearId" = "${modelYear}"."id" 
                AND "c"."deletedAt" IS NULL ${params.whereQuery}
            )`
          ),
          'minPrice'
        ]);
        break;

      case 'groupModelTypeId':
        fields.push([
          models.sequelize.literal(
            `(SELECT "GroupModels"."typeId" 
              FROM "GroupModels" 
              WHERE "GroupModels"."id" = "${car}"."groupModelId" 
                AND "GroupModels"."deletedAt" IS NULL
            )`
          ),
          'groupModelTypeId'
        ]);
        break;

      case 'maxPriceModel':
        fields.push([
          models.sequelize.literal(
            `(SELECT MAX("c"."price") 
              FROM "Cars" as "c" 
              WHERE "c"."modelId" = "Model"."id" 
                AND "c"."deletedAt" IS NULL ${params.whereQuery}
            )`
          ),
          'maxPrice'
        ]);
        break;

      case 'minPriceModel':
        fields.push([
          models.sequelize.literal(
            `(SELECT MIN("c"."price") 
              FROM "Cars" as "c" 
              WHERE "c"."modelId" = "Model"."id" 
                AND "c"."deletedAt" IS NULL ${params.whereQuery}
            )`
          ),
          'minPrice'
        ]);
        break;

      case 'maxKm':
        fields.push([
          models.sequelize.literal(
            `(SELECT MAX("c"."km") 
              FROM "Cars" as "c" 
              WHERE "c"."modelId"="Model"."id" 
                AND "c"."deletedAt" IS NULL ${params.whereQuery}
            )`
          ),
          'maxKm'
        ]);
        break;

      case 'minKm':
        fields.push([
          models.sequelize.literal(
            `(SELECT MIN("c"."km") 
              FROM "Cars" as "c" 
              WHERE "c"."modelId"="Model"."id" 
                AND "c"."deletedAt" IS NULL ${params.whereQuery}
            )`
          ),
          'minKm'
        ]);
        break;

      case 'maxYear':
        fields.push([
          models.sequelize.literal(
            `(SELECT "ModelYear"."year" 
              FROM "Cars" as "c" 
              LEFT JOIN "ModelYears" as "ModelYear" 
                ON "c"."modelYearId" = "ModelYear"."id" 
              WHERE "c"."modelId"="Model"."id" 
                AND "c"."deletedAt" IS NULL ${params.whereQuery} 
              ORDER BY "ModelYear"."year" 
              DESC LIMIT 1
            )`
          ),
          'maxYear'
        ]);
        break;

      case 'minYear':
        fields.push([
          models.sequelize.literal(
            `(SELECT "ModelYear"."year" 
              FROM "Cars" as "c" 
              LEFT JOIN "ModelYears" as "ModelYear" 
                ON "c"."modelYearId" = "ModelYear"."id" 
              WHERE "c"."modelId"="Model"."id" 
                AND "c"."deletedAt" IS NULL ${params.whereQuery} 
              ORDER BY "ModelYear"."year" 
              ASC LIMIT 1
            )`
          ),
          'minYear'
        ]);
        break;
      // Car

      default:
        break;
    }
  });
  return fields;
}

async function extraInclude(params) {
  const includes = [];
  const wheres = { modelYear: {}, whereProfile: {} };
  let modelYear = {
    model: models.ModelYear,
    as: 'modelYear',
    attributes: ['id', 'year', 'modelId'],
    where: wheres.modelYear
  };

  if (params) {
    switch (params.key) {
      case 'user':
        includes.push(
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
        );
        break;
      case 'whereModelYear':
        Object.assign(wheres.modelYear, {
          [Op.and]: [
            { year: { [Op.gte]: params.year[0] } }, 
            { year: { [Op.lte]: params.year[1] } }
          ]
        });
        break;
      case 'noModelYear':
        modelYear = {};
        break;
      case 'whereProfile':
        Object.assign(wheres, {
          whereProfile: params.whereProfile
        });
        break;
      default:
        break;
    }
  }

  const attribute = [
    {
      model: models.User,
      as: 'user',
      attributes: ['id', 'name', 'email', 'phone', 'type', 'companyType'],
      include: includes
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

  if (Object.keys(modelYear).length > 0) attribute.push(modelYear);
  // if (Object.keys(wheres.whereProfile).length > 0) {
  // if (wheres.whereProfile) {
  //   Object.assign(attribute[0], {
  //     where: wheres.whereProfile
  //   });
  // }

  return attribute;
}

// unused functions
async function emitJual(params) {
  console.log(params);
  console.log(`emit`);
  console.log(``);

  const { id, userId, notifJualStatus } = params;
  const where = {};
  const whereBargain = {};
  return models.Car.findByPk(id, {
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
          `(SELECT "Brands"."name" 
            FROM "Brands" 
            WHERE "Brands"."id" = "Car"."brandId" 
              AND "Brands"."deletedAt" IS NULL
          )`
        ),
        'Brands'
      ],
      [
        models.sequelize.literal(
          `(SELECT "Models"."name" 
            FROM "Models" 
            WHERE "Models"."id" = "Car"."modelId" 
              AND "Models"."deletedAt" IS NULL
          )`
        ),
        'Model'
      ],
      [
        models.sequelize.literal(
          `(SELECT COUNT("Likes"."carId") 
            FROM "Likes" 
            WHERE "Likes"."carId" = "Car"."id" 
              AND "Likes"."status" IS TRUE 
              AND "Likes"."deletedAt" IS NULL
          )`
        ),
        'jumlahLike'
      ],
      [
        models.sequelize.literal(
          `(SELECT COUNT("Views"."carId") 
            FROM "Views" 
            WHERE "Views"."carId" = "Car"."id" 
              AND "Views"."deletedAt" IS NULL
          )`
        ),
        'jumlahView'
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
              AND (SELECT COUNT("b"."id")
                FROM "Bargains" b
                WHERE "b"."deletedAt" IS NULL
                  AND "b"."negotiationType" IN (4,7,8)
                  AND "b"."carId" = "Bargains"."carId") = 0
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
              AND "Bargains"."userId" = ${userId}
          )`
        ),
        'bidAmount'
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
        model: models.Brand,
        as: 'brand',
        attributes: ['id', 'name', 'logo']
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
          exclude: ['picture', 'pictureUrl', 'createdAt', 'updatedAt', 'deletedAt']
        }
      },
      {
        required: false,
        model: models.Bargain,
        as: 'bargain',
        attributes: {
          exclude: ['deletedAt']
        },
        where: whereBargain,
        limit: 1,
        order: [['id', 'desc']]
      }
    ],
    where
  })
    .then(async emit => {
      return { notifJualStatus: notifJualStatus ? notifJualStatus : null, emit };
    })
    .catch(err => {
      return err;
    });
}
// unused functions

module.exports = {
  extraInclude,
  customFields,

  // unused functions
  emitJual
  // unused functions
};
