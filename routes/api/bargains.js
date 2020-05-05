/* eslint-disable linebreak-style */
const express = require('express');
const validator = require('validator');
const passport = require('passport');
const Sequelize = require('sequelize');
const moment = require('moment');
const models = require('../../db/models');
const paginator = require('../../helpers/paginator');
const notification = require('../../helpers/notification');
// const carHelper = require('../../helpers/car');

const { Op } = Sequelize;
const router = express.Router();

const DEFAULT_LIMIT = process.env.DEFAULT_LIMIT || 10;
const MAX_LIMIT = process.env.MAX_LIMIT || 50;

router.get('/', async (req, res) => {
  let { page, limit, sort, by } = req.query;
  const { userId, carId, bidType, negotiationType, expiredAt } = req.query;
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  if (!by) by = 'createdAt';
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
    'createdAt',
    'updatedAt'
  ];
  if (array.indexOf(by) < 0) by = 'id';

  if (sort !== 'desc') sort = 'asc';
  else sort = 'desc';

  const order = [[by, sort]];
  const where = {};

  if (carId) {
    Object.assign(where, {
      carId: {
        [Op.eq]: carId
      }
    });
  }

  if (userId) {
    Object.assign(where, {
      userId: {
        [Op.eq]: userId
      }
    });
  }

  if (bidType) {
    Object.assign(where, {
      bidType: {
        [Op.eq]: bidType
      }
    });
  }

  if (expiredAt) {
    Object.assign(where, {
      expiredAt: {
        [Op.lte]: expiredAt
      }
    });
  }

  if (negotiationType) {
    Object.assign(where, {
      negotiationType: {
        [Op.eq]: negotiationType
      }
    });
  }

  return models.Bargain.findAll({
    include: [
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
          }
        ]
      },
      {
        model: models.Car,
        as: 'car',
        attributes: {
          include: [
            [
              models.sequelize.literal(
                '(SELECT COUNT("Likes"."id") FROM "Likes" WHERE "Likes"."carId" = "car"."id" AND "Likes"."status" IS TRUE AND "Likes"."deletedAt" IS NULL)'
              ),
              'like'
            ],
            [
              models.sequelize.literal(
                '(SELECT COUNT("Views"."id") FROM "Views" WHERE "Views"."carId" = "car"."id" AND "Views"."deletedAt" IS NULL)'
              ),
              'view'
            ]
          ]
        },
        include: [
          {
            model: models.User,
            as: 'user',
            attributes: ['name', 'type', 'companyType'],
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
            model: models.ModelYear,
            as: 'modelYear',
            attributes: ['id', 'year', 'modelId']
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
        ]
      }
    ],
    where,
    order,
    offset,
    limit
  })
    .then(async data => {
      const count = await models.Bargain.count({ where });
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
  return models.Bargain.findByPk(id)
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

router.post('/bid', passport.authenticate('user', { session: false }), async (req, res) => {
  const { userId, carId, bidAmount, haveSeenCar, paymentMethod, expiredAt } = req.body;

  if (!bidAmount)
    return res.status(400).json({ success: false, errors: 'bidAmount must be filled' });
  if (!paymentMethod)
    return res.status(400).json({ success: false, errors: 'paymentMethod must be filled' });
  if (!expiredAt)
    return res.status(400).json({ success: false, errors: 'expiredAt must be filled' });
  if (!moment(expiredAt, 'YYYY-MM-DD HH:mm:ss', true).isValid())
    return res.status(400).json({ success: false, errors: 'Invalid expired date' });

  const checkIsBid = await models.Bargain.findAll({
    where: {
      carId,
      userId,
      expiredAt: {
        [Op.gte]: models.sequelize.literal('(SELECT NOW())')
      }
    }
  });
  if (checkIsBid.length)
    return res.status(400).json({ success: false, errors: 'You have bid this car' });

  const carExists = await models.Car.findByPk(carId);
  if (!carExists) return res.status(404).json({ success: false, errors: 'car not found' });
  if (carExists.roomId) return res.status(422).json({ success: false, errors: `car can't bid` });

  // return res.status(200).json({ success: true, userId, data: carExists });
  return models.Bargain.create({
    userId,
    carId,
    bidAmount,
    haveSeenCar,
    paymentMethod,
    expiredAt,
    bidType: 0
  })
    .then(async data => {
      const room = await models.Room.create();
      models.RoomMember.create({ roomId: room.id, userId: carExists.userId });
      models.RoomMember.create({ roomId: room.id, userId });
      await models.Bargain.update({ roomId: room.id }, { where: { id: data.id } });
      Object.assign(data, { roomId: room.id });
      carExists.update({ roomId: room.id });

      const userNotif = {
        userId: carExists.userId,
        collapseKey: null,
        notificationTitle: `Notifikasi Jual`,
        notificationBody: `penawaran baru`,
        notificationClickAction: `carNegotiate`,
        dataReferenceId: carId,
        category: 1,
        status: 3
      };
      const emit = await notification.insertNotification(userNotif);
      req.io.emit(`tabJual-${carExists.userId}`, emit);
      notification.userNotif(userNotif);

      res.status(200).json({ success: true, data });
    })
    .catch(err => {
      res.status(422).json({
        success: false,
        errors: err.message
      });
    });
});

router.put('/bid/:id', passport.authenticate('user', { session: false }), async (req, res) => {
  const carId = req.params.id;
  const userId = req.user.id;
  const { bidAmount, haveSeenCar, paymentMethod } = req.body;

  if (!bidAmount)
    return res.status(400).json({ success: false, errors: 'bidAmount must be filled' });
  if (!paymentMethod)
    return res.status(400).json({ success: false, errors: 'paymentMethod must be filled' });

  const data = await models.Bargain.findOne({
    where: {
      carId,
      userId,
      bidType: 0,
      negotiationType: null
    }
  });

  if (!data) return res.status(400).json({ success: false, errors: 'Transaksi not found' });

  return data
    .update({
      bidAmount,
      haveSeenCar,
      paymentMethod
    })
    .then(async data => {
      const carExists = await models.Car.findByPk(carId);

      const userNotif = {
        userId: carExists.userId,
        collapseKey: null,
        notificationTitle: `Notifikasi Jual`,
        notificationBody: `penawaran berubah`,
        notificationClickAction: `carOffer`,
        dataReferenceId: carId,
        category: 1,
        status: 4
      };
      const emit = await notification.insertNotification(userNotif);
      req.io.emit(`tabJual-${carExists.userId}`, emit);
      notification.userNotif(userNotif);

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
});

router.post('/negotiate', passport.authenticate('user', { session: false }), async (req, res) => {
  const { id } = req.user;
  const {
    userId,
    carId,
    bidAmount,
    haveSeenCar,
    paymentMethod,
    expiredAt,
    negotiationType,
    comment,
    carPrice
  } = req.body;

  if (validator.isInt(userId ? userId.toString() : '') === false)
    return res.status(406).json({ success: false, errors: 'type of userId must be int' });
  if (validator.isInt(carId ? carId.toString() : '') === false)
    return res.status(406).json({ success: false, errors: 'type of carId must be int' });
  if (validator.isInt(negotiationType ? negotiationType.toString() : '') === false)
    return res.status(406).json({ success: false, errors: 'type of negotiationType must be int' });
  if (validator.isBoolean(haveSeenCar ? haveSeenCar.toString() : '') === false)
    return res.status(406).json({ success: false, errors: 'type of haveSeenCar must be boolean' });
  if (!bidAmount)
    return res.status(400).json({ success: false, errors: 'bidAmount must be filled' });
  if (!paymentMethod)
    return res.status(400).json({ success: false, errors: 'paymentMethod must be filled' });
  if (!expiredAt)
    return res.status(400).json({ success: false, errors: 'expiredAt must be filled' });
  if (!moment(expiredAt, 'YYYY-MM-DD HH:mm:ss', true).isValid())
    return res.status(400).json({ success: false, errors: 'Invalid expired date' });
  if (!carPrice) return res.status(400).json({ success: false, errors: 'carPrice must be filled' });
  if (validator.isInt(carPrice ? carPrice.toString() : '') === false)
    return res.status(406).json({ success: false, errors: 'type of carPrice must be int' });

  const carExists = await models.Car.findByPk(carId, {
    include: [
      {
        model: models.Room,
        as: 'room',
        include: [
          {
            required: false,
            model: models.RoomMember,
            as: 'members',
            where: {
              userId: {
                [Op.ne]: req.user.id
              }
            }
          }
        ]
      }
    ]
  });
  if (!carExists) return res.status(404).json({ success: false, errors: 'car not found' });
  if (!carExists.roomId) return res.status(422).json({ success: false, errors: 'room null' });
  // saat pembeli yang nego, dia masuk tab mana

  const userNotifs = [];
  if (id === carExists.userId) {
    userNotifs.push({
      userId: carExists.room.members[0].userId,
      collapseKey: null,
      notificationTitle: `Notifikasi Nego Beli`,
      notificationBody: `Diajak ke ruang nego`,
      notificationClickAction: `carNegotiate`,
      dataReferenceId: carId,
      category: 4,
      status: 2,
      tab: `tabNego-${carExists.room.members[0].userId}`
    });
  } else {
    userNotifs.push({
      userId: carExists.room.members[0].userId,
      collapseKey: null,
      notificationTitle: `Notifikasi Nego Jual`,
      notificationBody: `Pembeli menjawab`,
      notificationClickAction: `carNegotiate`,
      dataReferenceId: carId,
      category: 4,
      status: 1,
      tab: `tabNego-${carExists.room.members[0].userId}`
    });
  }

  const create = {
    userId,
    carId,
    bidAmount,
    haveSeenCar,
    paymentMethod,
    expiredAt,
    bidType: 1,
    negotiationType,
    comment,
    carPrice
  };

  // return res.status(200).json({ success: true, data: carExists });
  const trans = await models.sequelize.transaction();
  const data = await models.Bargain.create(create, {
    transaction: trans
  }).catch(err => {
    trans.rollback();
    return res.status(422).json({ success: false, errors: err.message });
  });

  trans.commit();
  req.io.emit(`negotiation-car${carId}`, data);

  // const userNotif = {
  //   userId: carExists.room.members[0].userId,
  //   collapseKey: null,
  //   notificationTitle: `Notifikasi Jual`,
  //   notificationBody: `penawaran baru`,
  //   notificationClickAction: `carNegotiate`,
  //   dataReferenceId: carId,
  //   category: 1,
  //   status: 3
  // };
  // const emit = await notification.insertNotification(userNotif);
  // req.io.emit(`tabJual-${carExists.room.members[0].userId}`, emit);
  // notification.userNotif(userNotif);

  userNotifs.map(async userNotif => {
    const emit = await notification.insertNotification(userNotif);
    req.io.emit(`${userNotif.tab}-${userNotif.userId}`, emit);
    notification.userNotif(userNotif);
    console.log(userNotif);
  });

  return res.status(200).json({ success: true, data });
});

router.delete(
  '/failureNegotiation/:id',
  passport.authenticate('user', { session: false }),
  async (req, res) => {
    const { id } = req.params;

    return models.Bargain.destroy({
      where: {
        [Op.and]: [{ carId: id }, { bidType: 1 }]
      }
    })
      .then(() => {
        res.json({
          success: true
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

// Jual -> Nego -> Ajak Nego/Sedang Nego
router.get('/sell/nego', passport.authenticate('user', { session: false }), async (req, res) => {
  const { id } = req.user;
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
    negotiationType,
    by
  } = req.query;
  let { page, limit, sort } = req.query;
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  let order = [
    ['createdAt', 'desc'],
    [{ model: models.Bargain, as: 'bargain' }, 'createdAt', 'desc']
  ];
  if (!sort) sort = 'asc';
  else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';

  if (by === 'price' || by === 'id') order = [[by, sort]];

  const whereBargain = {};

  if (negotiationType == 0) {
    Object.assign(whereBargain, {
      negotiationType: {
        [Op.eq]: negotiationType
      }
    });
  } else if (negotiationType == 1) {
    Object.assign(whereBargain, {
      [Op.or]: [
        { negotiationType: 1 },
        { negotiationType: 2 },
        { negotiationType: 3 },
        { negotiationType: 4 },
        { negotiationType: 5 },
        { negotiationType: 6 }
      ]
    });
  }

  const where = {
    userId: {
      [Op.eq]: id
    }
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

  return models.Car.findAll({
    attributes: {
      include: [
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
        ]
      ]
    },
    include: [
      {
        model: models.ModelYear,
        as: 'modelYear',
        attributes: ['id', 'year', 'modelId'],
        where: whereYear
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
      },
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
        model: models.Bargain,
        as: 'bargain',
        where: whereBargain,
        attributes: {
          exclude: ['updatedAt', 'deletedAt']
        },
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
          }
        ]
      },
      {
        model: models.Room,
        attributes: {
          exclude: ['createdAt', 'updatedAt', 'deletedAt']
        },
        as: 'room',
        include: [
          {
            required: false,
            model: models.RoomMember,
            attributes: {
              exclude: ['createdAt', 'updatedAt', 'deletedAt']
            },
            as: 'members',
            where: {
              userId: {
                [Op.ne]: id
              }
            },
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
    ],
    where,
    order,
    offset,
    limit
  })
    .then(async data => {
      const count = await models.Car.count({
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

// Beli -> Nego -> Diajak Nego/Sedang Nego
router.get('/buy/nego', passport.authenticate('user', { session: false }), async (req, res) => {
  const { id } = req.user;
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
    negotiationType,
    by
  } = req.query;
  let { page, limit, sort } = req.query;
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  let order = [
    ['createdAt', 'desc']
    // [{ model: models.Bargain, as: 'bargain' }, 'createdAt', 'desc']
  ];
  if (!sort) sort = 'asc';
  else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';

  if (by === 'price' || by === 'id') order = [[by, sort]];

  const whereBargain = {
    // userId: {
    //   [Op.eq]: id
    // }
  };

  if (negotiationType == 0) {
    Object.assign(whereBargain, {
      [Op.or]: [{ negotiationType: { [Op.is]: null } }, { negotiationType }]
    });
    order.push([{ model: models.Bargain, as: 'bargain' }, 'id', 'desc']);
  } else if (negotiationType == 1) {
    Object.assign(whereBargain, {
      [Op.or]: [
        { negotiationType: 1 },
        { negotiationType: 2 },
        { negotiationType: 3 },
        { negotiationType: 4 },
        { negotiationType: 5 },
        { negotiationType: 6 }
      ]
    });
  }

  const where = {};
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

  return models.Car.findAll({
    attributes: {
      include: [
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
        ]
      ]
    },
    include: [
      {
        model: models.ModelYear,
        as: 'modelYear',
        attributes: ['id', 'year', 'modelId'],
        where: whereYear
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
      },
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
        model: models.Bargain,
        as: 'bargain',
        where: whereBargain,
        attributes: {
          exclude: ['updatedAt', 'deletedAt']
        },
        // order: [['id', 'asc']],
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
