const moment = require('moment');
const validator = require('validator');
const Sequelize = require('sequelize');
const models = require('../db/models');
const paginator = require('../helpers/paginator');
const carHelper = require('../helpers/car');

const { Op } = Sequelize;

const DEFAULT_LIMIT = process.env.DEFAULT_LIMIT || 10;
const MAX_LIMIT = process.env.MAX_LIMIT || 50;

const whereQueryBargain = userId => `(SELECT COUNT("bc"."id")
  FROM (SELECT * 
    FROM "Bargains"
    WHERE "Bargains"."deletedAt" IS NULL
        AND "Bargains"."carId" = "car"."id"
    ORDER BY "Bargains"."createdAt" DESC
    LIMIT 1) AS bc
  WHERE "bc"."userId" <> ${userId}
    AND (SELECT COUNT("BargainReaders"."id") 
      FROM "BargainReaders" 
      WHERE "BargainReaders"."carId" = "car"."id"
        AND "BargainReaders"."bargainId" = "bc"."id"
        AND "BargainReaders"."userId" = ${userId}
        AND "BargainReaders"."deletedAt" IS NULL
    ) = 0
) > 0`;

const isOnNego = userId => `(CASE WHEN ((SELECT COUNT("Bargains"."id")
  FROM "Bargains" 
  WHERE "Bargains"."carId" = "Notification"."referenceId" 
    AND "Bargains"."negotiationType" IS NOT NULL
    AND ("Bargains"."negotiationType" IN (7,8) 
      OR ("Bargains"."negotiationType" = 3 AND "Bargains"."userId" = ${userId})
    )
    AND "Bargains"."deletedAt" IS NULL) = 0 
  AND (SELECT COUNT("Bargains"."id")
    FROM "Bargains" 
    WHERE "Bargains"."carId" = "Notification"."referenceId" 
      AND "Bargains"."negotiationType" IN (1,2,3,4,5,6)
      AND "Bargains"."deletedAt" IS NULL) > 0
  ) THEN true
ELSE false END)`;

async function getAll(req, res) {
  const { category, id, fullResponse, action } = req.query;
  const userId = req.user.id;
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
    'title',
    'body',
    'category',
    'status',
    'referenceId',
    'action',
    'createdAt'
  ];

  if (array.indexOf(by) < 0) by = 'createdAt';
  sort = ['asc', 'desc'].indexOf(sort) < 0 ? 'asc' : sort;
  const order = [[by, sort]];

  const where = { 
    userId,
    [Op.and]: [
      models.sequelize.literal(`(SELECT COUNT("Cars"."id") 
        FROM "Cars" 
        WHERE "Cars"."id" = "Notification"."referenceId" 
            AND "Cars"."deletedAt" IS NULL
        ) > 0`
      )
    ]
  };

  const whereCountUnRead = { userId, action: 0 };
  const whereCountSee = { userId, action: 1 };
  if (id) Object.assign(where, { id });
  if (category) {
    Object.assign(where, { category });
    Object.assign(whereCountUnRead, { category });
    Object.assign(whereCountSee, { category });
  }

  const include = [];
  let includeAttribute = [];
  
  if (fullResponse && JSON.parse(fullResponse) == true) {
    includeAttribute = [
      [ models.sequelize.literal(isOnNego(userId)), 'isOnNego' ]
    ];

    include.push({
      model: models.Car,
      attributes: Object.keys(models.Car.attributes).concat(
        [
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
            models.sequelize.literal(whereQueryBargain(userId)), 
            'isRead'
          ]
        ]
      ),
      required: false,
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
          separate: true,
          model: models.Bargain,
          as: 'bargain',
          attributes: {
            exclude: ['deletedAt']
          },
          order: [['id', 'desc']]
        },
        {
          model: models.Room,
          subQuery: false,
          attributes: {
            exclude: ['createdAt', 'updatedAt', 'deletedAt']
          },
          as: 'room',
          include: [
            {
              required: true,
              model: models.RoomMember,
              attributes: {
                exclude: ['createdAt', 'updatedAt', 'deletedAt']
              },
              as: 'members',
              include: [
                {
                  model: models.User,
                  attributes: {
                    exclude: ['password', 'deletedAt']
                  },
                  as: 'member',
                  include: [
                    {
                      model: models.File,
                      as: 'file',
                      attributes: {
                        exclude: ['type', 'createdAt', 'updatedAt', 'deletedAt']
                      }
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    });
  }

  if(action) {
    const actionArr = [0, 1, 2];
    if (actionArr.indexOf(Number(action)) < 0) {
      return res.status(400).json({ 
        success: false, 
        errors: 'Invalid action' 
      });
    }

    Object.assign(where, { action });
  }

  return models.Notification.findAll({
    attributes: {
      exclude: ['deletedAt'],
      include: includeAttribute
    },
    subQuery: true,
    include,
    where,
    order,
    offset,
    limit
  })
    .then(async data => {
      const unRead = await models.Notification.count({ where: whereCountUnRead });
      const seen = await models.Notification.count({ where: whereCountSee });
      const count = await models.Notification.count({ where });

      const notification = { unRead, seen };
      const pagination = paginator.paging(page, count, limit);

      if(fullResponse && JSON.parse(fullResponse) == true) {
        await Promise.all(
          data.map(async item => {
            const dataBargain = item.dataValues.car.dataValues.bargain;
            const sellerId = item.dataValues.car.dataValues.userId;
            const userIdLastBargain = dataBargain.length ? dataBargain[0].userId : null;
            item.dataValues.car.dataValues.statusNego = generateStatusNego(dataBargain, sellerId, userIdLastBargain, userId);
          })
        );
      }

      res.json({
        success: true,
        notification,
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

async function read(req, res) {
  const { id, category } = req.body;
  const update = { action: 1 };
  const where = { action: 0 };

  if(id) {
    const notifExists = await models.Notification.findByPk(id);
    if(notifExists.action == 1) {
      return res.status(200).json({ 
        success: true, 
        message: 'changed', 
        data: notifExists 
      });
    }

    Object.assign(where, { id });
  }

  if(category) {
    Object.assign(where, { category });
  } 

  return models.Notification.update(update, { where })
    .then(async data => {
      return res.status(200).json({ success: true, message: 'success update', data });
    })
    .catch(err => {
      return res.status(200).json({ success: false, errors: 'Something wrong!' });
    });
}

async function unRead(req, res) {
  const { category } = req.body;
  const update = { action: 0 };
  const where = { action: 1 };

  if(category) {
    Object.assign(where, { category });
  } 

  return models.Notification.update(update, {
    where
  })
    .then(async data => {
      return res.status(200).json({ success: true, message: 'update unRead', data });
    })
    .catch(err => {
      return res.status(200).json({ success: false, errors: 'Something wrong!' });
    });
}

async function click(req, res) {
  const { id, category } = req.body;
  const update = { action: 2 };
  const where = { action: 1 };

  if(id) {
    const notifExists = await models.Notification.findByPk(id);
    if(notifExists.action == 2) {
      return res.status(200).json({ 
        success: true, 
        message: 'has been seen', 
        data: notifExists 
      });
    }

    Object.assign(where, { id });
  }

  if(category) {
    Object.assign(where, { category });
  }

  return models.Notification.update(update, { where })
    .then(async data => {
      return res.status(200).json({ success: true, message: 'success update', data });
    })
    .catch(err => {
      return res.status(200).json({ success: false, errors: 'Something wrong!' });
    });
}

async function unClick(req, res) {
  const { category } = req.body;
  const update = { action: 1 };
  const where = { action: 2 };

  if(category) {
    Object.assign(where, { category });
  }

  return models.Notification.update(update, {
    where
  })
    .then(async data => {
      return res.status(200).json({ success: true, message: 'update unClick', data });
    })
    .catch(err => {
      return res.status(200).json({ success: false, errors: 'Something wrong!' });
    });
}

async function countCategory(req, res) {
  const userId = req.user.id;
  const notifications = [];
  const total = { unRead: 0, seen: 0 };
  const categories = await models.Notification.aggregate('category', 'DISTINCT', {
    plain: false,
    where: { userId }
  });

  const waitingPromise = await categories.map(async category => {
    const unRead = await models.Notification.count({
      where: { userId, action: 0, category: category.DISTINCT }
    });

    const seen = await models.Notification.count({
      where: { userId, action: 1, category: category.DISTINCT }
    });

    notifications.push({ category: category.DISTINCT, unRead, seen });
    Object.assign(total, { unRead: total.unRead + unRead, seen: total.seen + seen });
  });

  await Promise.all(waitingPromise);
  return res.status(200).json({ success: true, total, data: notifications });
}

function generateStatusNego(dataBargain, sellerId, userIdLastBargain, userId) {
  let negotiationType = [0,1,2,5,6];
  let statusNego = '';

  if (dataBargain.length == 0 || (dataBargain.length > 0 && userIdLastBargain == userId)) {
    statusNego = 'Tunggu Jawaban';
  } else if (dataBargain.length > 0 && userIdLastBargain != userId) {
    statusNego = 'Jawaban Anda Ditunggu';
  }

  if(sellerId != userId) {
    if(dataBargain.length && dataBargain[0].negotiationType == 3 && dataBargain[0].userId != userId) {
      statusNego = 'Penjual Keluar Nego';
    }
  } else {
    negotiationType.shift();
    if(dataBargain.length && dataBargain[0].negotiationType == 3 && dataBargain[0].userId != userId) {
      statusNego = 'Pembeli Keluar Nego';
    }
  }

  if(dataBargain.length && 
    moment.utc(dataBargain[0].expiredAt).format('YYYY-MM-DD HH:mm:ss') < moment().tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss') && 
    negotiationType.includes(dataBargain[0].negotiationType)
  ) {
    statusNego = 'Waktu Habis';
  }

  if(dataBargain.length && dataBargain[0].negotiationType == 4) {
    statusNego = 'Nego Berhasil';
  }

  return statusNego;
}

module.exports = {
  getAll,
  read,
  unRead,
  click,
  unClick,
  countCategory
};
