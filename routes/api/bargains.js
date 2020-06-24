/* eslint-disable linebreak-style */
const express = require('express');
const validator = require('validator');
const passport = require('passport');
const Sequelize = require('sequelize');
const moment = require('moment');
const models = require('../../db/models');
const paginator = require('../../helpers/paginator');
const notification = require('../../helpers/notification');
const bargainsController = require('../../controller/bargainsController');
// const carHelper = require('../../helpers/car');

const { Op } = Sequelize;
const router = express.Router();

const DEFAULT_LIMIT = process.env.DEFAULT_LIMIT || 10;
const MAX_LIMIT = process.env.MAX_LIMIT || 50;

router.get('/', async (req, res) => {
  return await bargainsController.bargainsList(req, res);
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

  const checkIfUserHasBid = await models.Bargain.findAll({
    where: {
      carId,
      userId,
      expiredAt: {
        [Op.gte]: models.sequelize.literal('(SELECT NOW())')
      }
    }
  });

  if (checkIfUserHasBid.length)
    return res.status(400).json({ success: false, errors: 'You have bid this car' });

  const carExists = await models.Car.findByPk(carId);
  if (!carExists) return res.status(404).json({ success: false, errors: 'car not found' });
  if (carExists.roomId) {
    const checkIfCarUnderNegotiate = await models.Bargain.findOne({
      where: {
        carId,
        roomId: carExists.roomId,
        expiredAt: {
          [Op.gte]: models.sequelize.literal('(SELECT NOW())')
        },
        bidType: 1
      }
    });

    if(checkIfCarUnderNegotiate) {
      return res.status(422).json({ success: false, errors: `you can't bid this car, because someone under negotiation` });
    }
  }

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

router.put('/extend/:id', passport.authenticate('user', { session: false }), async (req, res) => {
  const id = req.params.id;
  const userId = req.user.id;
  const { expiredAt } = req.body;

  if (!expiredAt)
    return res.status(400).json({ success: false, errors: 'expiredAt must be filled' });
  if (!moment(expiredAt, 'YYYY-MM-DD HH:mm:ss', true).isValid())
    return res.status(400).json({ success: false, errors: 'Invalid expired date' });

  const data = await models.Bargain.findOne({
    where: {
      id,
      userId
    }
  });

  if (!data) {
    return res.status(400).json({ 
      success: false, errors: 'data not found or you are not the author of this data' 
    });
  }

  return data
    .update({
      expiredAt
    })
    .then(async data => {
      const userNotif = {
        userId: data.userId,
        collapseKey: null,
        notificationTitle: 'Notifikasi Extend Waktu Penawaran',
        notificationBody: `Waktu penawaran diperpanjang sampai ${expiredAt}`,
        notificationClickAction: `carOffer`,
        dataReferenceId: data.carId,
        category: 4,
        status: 4
      };

      const emit = await notification.insertNotification(userNotif);
      req.io.emit(`extend-${data.carId}`, emit);
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
    bidderId,
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
  if (bidderId && validator.isInt(bidderId ? bidderId.toString() : '') === false)
    return res.status(406).json({ success: false, errors: 'type of bidderId must be int' });
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
    bidderId,
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

  if(negotiationType == 4) {
    await models.Purchase.create({
      userId: carExists.room.members[0].userId,
      carId,
      price: bidAmount,
      paymentMethod,
      bargainId: data.id
    }, {
      transaction: trans
    }).catch(err => {
      trans.rollback();
      return res.status(422).json({ success: false, errors: err.message });
    });
  }

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
  '/failureNegotiation/:carId',
  passport.authenticate('user', { session: false }),
  async (req, res) => {
    const { carId } = req.params;
    const { withBid } = req.body;

    const car = await models.Car.findByPk(carId);
    if(!car) {
      return res.status(422).json({ 
        success: false, errors: 'car not found' 
      });
    }

    const where = {
      carId
    }

    if(withBid) {
      const roomMembers = await models.RoomMember.findAll({
        where: {
          roomId: car.roomId
        }
      });

      let usersId = roomMembers.map(item => item.userId);
      const where = {
        usersId
      }
    } else {
      Object.assign(where, {
        bidType: 1
      });
    }

    return models.Bargain.destroy({
      where
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
  return await bargainsController.getSellNego(req, res);
});

// Beli -> Nego -> Diajak Nego/Sedang Nego
router.get('/buy/nego', passport.authenticate('user', { session: false }), async (req, res) => {
  return await bargainsController.getBuyNego(req, res);
});

module.exports = router;
