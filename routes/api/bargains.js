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

  const data = await models.Bargain.findByPk(id, {
    attributes: {
      include: [
        [
          models.sequelize.literal(`(EXISTS(SELECT "r"."id" 
            FROM "BargainReaders" r 
            WHERE "r"."bargainId" = "Bargain"."id" 
              AND "r"."carId" = "Bargain"."carId"
              AND "r"."userId" != ${userId}
              AND "r"."type" = 4
              AND "r"."isRead" = TRUE
              AND "r"."deletedAt" IS NULL))`
          ), 
          'isRead'
        ]
      ]
    },
    include: [
      {
        model: models.Car,
        as: 'car',
        required: true,
        include: [
          {
            model: models.Room,
            as: 'room',
            where: models.sequelize.where(
              models.sequelize.literal(
                `(SELECT COUNT( "RoomMembers"."id" ) 
                  FROM "RoomMembers" 
                  WHERE "RoomMembers"."roomId" = "car"."roomId" 
                    AND "RoomMembers"."userId" = ${userId}
                  )`
              ),
              { [Op.gt]: 0 }
            )
          }
        ]
      }
    ]
  });

  if (!data) {
    return res.status(400).json({ 
      success: false, errors: 'data not found or you are not the author of this data' 
    });
  }

  if (data.isExtend) {
    return res.status(400).json({ 
      success: false, errors: 'You have already extended this data before' 
    });
  }

  if (data.isRead) {
    return res.status(400).json({ 
      success: false, errors: 'The user reads the offer but is not replied' 
    });
  }

  return data
    .update({
      expiredAt,
      isExtend: true
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
  return await bargainsController.negotiate(req, res);
});

router.delete('/failureNegotiation/:carId', passport.authenticate('user', { session: false }), async (req, res) => {
  const { carId } = req.params;
  const { withBid } = req.query;
  const userId = req.user.id;

  const car = await models.Car.findOne({
    where: {
      id: carId
    }
  });

  if (!car) {
    return res.status(422).json({
      success: false,
      errors: 'car not found'
    });
  }

  const where = { carId };
  if (!withBid) {
    Object.assign(where, {
      bidType: 1
    });
  }

  const trans = await models.sequelize.transaction();
  await models.Bargain.destroy({
      where,
      transaction: trans
  })
  .catch(err => {
    trans.rollback();
    return res.status(422).json({ success: false, errors: err.message });
  });

  await models.Room.destroy({
    where: {
      id: car.roomId
    },
    transaction: trans
  }).catch(err => {
    trans.rollback();
    return res.status(422).json({ success: false, errors: err.message });
  });

  await models.RoomMember.destroy({
    where: {
      roomId: car.roomId
    },
    transaction: trans
  }).catch(err => {
    trans.rollback();
    return res.status(422).json({ success: false, errors: err.message });
  });

  await car.update({ roomId: null }, { transaction: trans }).catch(err => {
    trans.rollback();
    return res.status(422).json({ success: false, errors: err.message });
  });

  trans.commit();
  return res.status(200).json({ success: true });
});

// Jual -> Nego -> Ajak Nego/Sedang Nego
router.get('/sell/nego', passport.authenticate('user', { session: false }), async (req, res) => {
  return await bargainsController.getSellNego(req, res);
});

// Beli -> Nego -> Diajak Nego/Sedang Nego
router.get('/buy/nego', passport.authenticate('user', { session: false }), async (req, res) => {
  return await bargainsController.getBuyNego(req, res);
});

module.exports = router;
