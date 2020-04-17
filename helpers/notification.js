/* eslint-disable array-callback-return */
const firebaseHelper = require('./firebase');
const models = require('../db/models');
const carHelper = require('../helpers/car');

async function userNotif(params) {
  const userTokens = await models.UserToken.findAll({
    where: {
      userId: params.userId
    }
  });

  if (userTokens.length <= 0) console.log(`userId:${params.userId} firebase token IS NULL`);

  userTokens.map(async ut => {
    firebaseHelper.sendNew({
      token: ut.token,
      collapseKey: params.collapseKey,
      notificationTitle: params.notificationTitle,
      notificationBody: params.notificationBody,
      notificationClickAction: params.notificationClickAction,
      dataReferenceId: params.dataReferenceId,
      type: ut.type
    });
  });
}

async function insertNotification(params) {
  const insert = {
    userId: params.userId,
    title: params.notificationTitle,
    body: params.notificationBody,
    category: params.category,
    status: params.status,
    referenceId: params.dataReferenceId
  };
  return models.Notification.create(insert)
    .then(async insert => {
      const data = await models.Notification.findByPk(insert.id, {
        include: [
          {
            model: models.Car,
            attributes: Object.keys(models.Car.attributes).concat(
              await carHelper.emitFieldCustomCar({ userId: insert.userId })
            ),
            as: 'car',
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
                // where: whereBargain,
                limit: 1,
                order: [['id', 'desc']]
              }
            ]
          }
        ]
      });
      return data;
    })
    .catch(err => {
      console.log(err);
      return err;
    });
}

module.exports = {
  userNotif,
  insertNotification
};
