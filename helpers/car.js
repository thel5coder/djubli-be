/* eslint-disable linebreak-style */

const models = require('../db/models');
const attributes = [
  {
    model: models.ModelYear,
    as: 'modelYear',
    attributes: ['id', 'year', 'modelId']
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
];

async function customFields(params) {
  const fields = [];

  params.fields.map(async field => {
    switch (field) {
      case 'like':
        fields.push([
          models.sequelize.literal(
            `(SELECT COUNT("Likes"."id") FROM "Likes" WHERE "Likes"."carId" = "car"."id" AND "Likes"."status" IS TRUE AND "Likes"."deletedAt" IS NULL)`
          ),
          'like'
        ]);
        break;
      case 'view':
        fields.push([
          models.sequelize.literal(
            `(SELECT COUNT("Views"."id") FROM "Views" WHERE "Views"."carId" = "car"."id" AND "Views"."deletedAt" IS NULL)`
          ),
          'view'
        ]);
        break;
      case 'islike':
        fields.push([
          models.sequelize.literal(
            `(SELECT COUNT("Likes"."id") FROM "Likes" WHERE "Likes"."carId" = "car"."id" AND "Likes"."status" IS TRUE AND "Likes"."userId" = ${params.id} AND "Likes"."deletedAt" IS NULL)`
          ),
          'islike'
        ]);
        break;
      case 'isBid':
        fields.push([
          models.sequelize.literal(
            `(SELECT COUNT("Bargains"."id") FROM "Bargains" WHERE "Bargains"."userId" = ${params.id} AND "Bargains"."carId" = "car"."id" AND "Bargains"."expiredAt" >= (SELECT NOW()) AND "Bargains"."deletedAt" IS NULL)`
          ),
          'isBid'
        ]);
        break;
      case 'isBidFromLike':
        fields.push([
          models.sequelize.literal(
            `(SELECT COUNT("Bargains"."id") FROM "Bargains" WHERE "Bargains"."userId" = ${params.id} AND "Bargains"."carId" = "car"."id" AND "Bargains"."expiredAt" >= (SELECT NOW()) AND "Bargains"."bidType" = 0 AND "Bargains"."deletedAt" IS NULL)`
          ),
          'isBid'
        ]);
        break;
      case 'numberOfBidder':
        fields.push([
          models.sequelize.literal(
            `(SELECT COUNT("Bargains"."id") FROM "Bargains" WHERE "Bargains"."carId" = "car"."id" AND "Bargains"."deletedAt" IS NULL AND "Bargains"."bidType" = 0)`
          ),
          'numberOfBidder'
        ]);
        break;
      case 'highestBidder':
        fields.push([
          models.sequelize.literal(
            `(SELECT MAX("Bargains"."bidAmount") FROM "Bargains" WHERE "Bargains"."carId" = "car"."id" AND "Bargains"."deletedAt" IS NULL AND "Bargains"."bidType" = 0
              )`
          ),
          'highestBidder'
        ]);
        break;
      case 'bidAmount':
        fields.push([
          models.sequelize.literal(
            `(SELECT MAX("Bargains"."bidAmount") FROM "Bargains" WHERE "Bargains"."carId" = "car"."id" AND "Bargains"."deletedAt" IS NULL AND "Bargains"."bidType" = 0 AND "Bargains"."userId" = ${params.id})`
          ),
          'bidAmount'
        ]);
        break;

      default:
        break;
    }
  });
  return fields;
}

module.exports = {
  attributes,
  customFields
};
