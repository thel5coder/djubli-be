/* eslint-disable linebreak-style */
const express = require('express');
const validator = require('validator');
const passport = require('passport');
const Sequelize = require('sequelize');
const models = require('../../db/models');
const moment = require('moment');
const paginator = require('../../helpers/paginator');
const carHelper = require('../../helpers/car');
const purchaseController = require('../../controller/purchaseController');
const notification = require('../../helpers/notification');

const router = express.Router();

const { Op } = Sequelize;
const DEFAULT_LIMIT = process.env.DEFAULT_LIMIT || 10;
const MAX_LIMIT = process.env.MAX_LIMIT || 50;

router.get('/', passport.authenticate('user', { session: false }), async (req, res) => {
  return await purchaseController.get(req, res);
});

// Without Login
router.get('/models/years/:modelYearId', async (req, res) => {
  return await purchaseController.getByModelYearId(req, res, { auth: false });
});

// With Login
router.get('/logon/models/years/:modelYearId', passport.authenticate('user', { session: false }), async (req, res) => {
  return await purchaseController.getByModelYearId(req, res, { auth: true });
});

router.get('/id/:id', passport.authenticate('user', { session: false }), async (req, res) => {
  return await purchaseController.getById(req, res);
});

router.post('/', passport.authenticate('user', { session: false }), async (req, res) => {
  const { carId, paymentMethod, haveSeenCar, bargainId } = req.body;

  if(!carId) {
    return res.status(404).json({
      success: false,
      errors: 'carId is mandatory'
    });
  }

  if(!paymentMethod) {
    return res.status(404).json({
      success: false,
      errors: 'payment method is mandatory'
    });
  }

  const carData = await models.Car.findOne({
    where: { id: carId }
  });

  if (!carData) {
    return res.status(404).json({
      success: false,
      errors: 'Car not found'
    });
  }

  const userNotifs = [];
  const likers = await models.Like.aggregate('userId', 'DISTINCT', {
    plain: false,
    where: { carId: carData.id }
  });

  likers.map(async liker => {
    userNotifs.push({
      userId: liker.DISTINCT,
      collapseKey: null,
      notificationTitle: `Mobil Terjual`,
      notificationBody: `Mobil yang anda suka telah terjual`,
      notificationClickAction: `carPriceSold`,
      dataReferenceId: carData.id,
      category: 3, // like
      status: 2, // mobil terjual
      typeNotif: 'tabLike'
    });
  });

  // return res.status(200).json({ success: true, data: userNotifs });

  const trans = await models.sequelize.transaction();
  await carData.update({ status: 2 }, { transaction: trans }).catch(err => {
    trans.rollback();
    res.status(422).json({
      success: false,
      errors: err.message
    });
  });

  if(bargainId) {
    await models.Bargain.destroy({
      where: {
        id: bargainId
      },
      transaction: trans
    }).catch(err => {
      trans.rollback();
      res.status(422).json({
        success: false,
        errors: err.message
      });
    });
  }

  const expiredAtPurchase = moment().add(2, 'd').format('YYYY-MM-DD HH:mm:ss');
  return models.Purchase.create(
    {
      carId,
      userId: req.user.id,
      price: carData.price,
      paymentMethod,
      haveSeenCar,
      expiredAt: expiredAtPurchase
    },
    { transaction: trans }
  )
    .then(async data => {
      trans.commit();

      userNotifs.push({
        userId: carData.userId,
        collapseKey: null,
        notificationTitle: `Notifikasi Jual`,
        notificationBody: `mobil terjual`,
        notificationClickAction: `carPurchase`,
        dataReferenceId: carData.id,
        category: 1,
        status: 1,
        typeNotif: 'tabJual'
      });

      userNotifs.map(async userNotif => {
        const emit = await notification.insertNotification(userNotif);
        req.io.emit(`${userNotif.typeNotif}-${userNotif.userId}`, emit);
        notification.userNotif(userNotif);
      });

      res.status(200).json({ success: true, data });
    })
    .catch(err => {
      trans.rollback();
      res.status(422).json({
        success: false,
        errors: err.message
      });
    });
});

router.put('/id/:id', passport.authenticate('user', { session: false }), async (req, res) => {
  const { id } = req.params;
  if (validator.isInt(id ? id.toString() : '') === false) {
    return res.status(400).json({
      success: false,
      errors: 'Invalid Parameter'
    });
  }

  const data = await models.Purchase.findByPk(id);
  if (!data) {
    return res.status(400).json({
      success: false,
      errors: 'Purchase not found'
    });
  }

  const { carId, userId, price, paymentMethod, haveSeenCar } = req.body;

  return data
    .update({
      carId,
      userId,
      price,
      paymentMethod,
      haveSeenCar
    })
    .then(() => {
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

router.delete('/:id', passport.authenticate('user', { session: false }), async (req, res) => {
  const { id } = req.params;
  if (validator.isInt(id ? id.toString() : '') === false) {
    return res.status(400).json({
      success: false,
      errors: 'Invalid Parameter'
    });
  }
  const data = await models.Purchase.findByPk(id);
  if (!data) {
    return res.status(400).json({
      success: false,
      errors: 'data not found'
    });
  }

  return data
    .destroy()
    .then(() => {
      res.json({
        success: true,
        data
      });
    })
    .catch(err => {
      res.status(422).json({
        success: true,
        errors: err.message
      });
    });
});

router.put('/bargainId/:bargainId', passport.authenticate('user', { session: false }), async (req, res) => {
  const { bargainId } = req.params;
  const { id } = req.user;
  const { isAccept } = req.body;

  if (validator.isInt(bargainId ? bargainId.toString() : '') === false) {
    return res.status(400).json({
      success: false,
      errors: 'Invalid Parameter'
    });
  }

  const data = await models.Purchase.findOne({
    where: {
      bargainId,
      userId: id
    }
  });

  if (!data) {
    return res.status(400).json({
      success: false,
      errors: 'Purchase not found'
    });
  }
  
  return data
    .update({
      isAccept
    })
    .then(() => {
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

module.exports = router;
