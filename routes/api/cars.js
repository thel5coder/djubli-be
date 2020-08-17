/* eslint-disable linebreak-style */
const moment = require('moment');
const express = require('express');
const validator = require('validator');
const randomize = require('randomatic');
const passport = require('passport');
const Sequelize = require('sequelize');
const models = require('../../db/models');
const imageHelper = require('../../helpers/s3');
const general = require('../../helpers/general');
const paginator = require('../../helpers/paginator');
const carsController = require('../../controller/carsController');
const apiResponse = require('../../helpers/apiResponse');
const notification = require('../../helpers/notification');

const { Op } = Sequelize;
const router = express.Router();

const DEFAULT_LIMIT = process.env.DEFAULT_LIMIT || 10;
const MAX_LIMIT = process.env.MAX_LIMIT || 50;

// Withot Login
router.get('/', async (req, res) => {
  return await carsController.carsGet(req, res);
});

// With Login
router.get('/logon', passport.authenticate('user', { session: false }), async (req, res) => {
  return await carsController.carsGet(req, res, true);
});

router.get('/user/:id', async (req, res) => {
  return await carsController.getByUserId(req, res);
});

// Get By Status
router.get('/status/:status', async (req, res) => {
  return await carsController.getByStatus(req, res);
});

router.get('/purchase_list/status/:status', passport.authenticate('user', { session: false }), async (req, res) => {
  return await carsController.purchaseList(req, res);
});

router.get('/bid_list', passport.authenticate('user', { session: false }), async (req, res) => {
  return await carsController.bidList(req, res);
});

router.get('/bid/list', passport.authenticate('user', { session: false }), async (req, res) => {
  return await carsController.bidList(req, res);
});

// With Login
router.get('/sell_list/status/:status', passport.authenticate('user', { session: false }), async (req, res) => {
  return await carsController.sellList(req, res);
});

// Withot Login
router.get('/sell/list/status/:status', async (req, res) => {
  return await carsController.sellList(req, res);
});

router.get('/id/:id', async (req, res) => {
  return await carsController.getById(req, res);
});

router.get('/like/:id', async (req, res) => {
  return await carsController.like(req, res);
});

router.get('/view/:id', async (req, res) => {
  return await carsController.view(req, res);
});

router.get('/viewLike', async (req, res) => {
  return await carsController.viewLike(req, res);
});

router.get('/views/like', async (req, res) => {
  return await carsController.viewLike(req, res);
});

// router get list car by like(Login)
router.get('/viewLikeLogon', passport.authenticate('user', { session: false }), async (req, res) => {
  return await carsController.viewLikeLogon(req, res);
});

router.get('/categories', async (req, res) => {
  return await carsController.getCategory(req, res);
});

// Update Status
router.put('/status/:id', passport.authenticate('user', { session: false }), async (req, res) => {
  const { id } = req.params;
  if (validator.isInt(id ? id.toString() : '') === false) {
    return res.status(400).json({
      success: false,
      errors: 'Invalid Parameter'
    });
  }

  const data = await models.Car.findByPk(id);
  if (!data) {
    return res.status(400).json({
      success: false,
      errors: 'Transaksi not found'
    });
  }

  const { status } = req.body;

  if (!status) {
    return res.status(400).json({
      success: false,
      errors: 'status is mandatory'
    });
  }

  return data
    .update({
      status
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

router.post('/', passport.authenticate('user', { session: false }), async (req, res) => {
  return await carsController.sell(req, res);
});

router.put('/:id', passport.authenticate('user', { session: false }), async (req, res) => {
  const { id } = req.params;
  const { price, location, km, meetingSchedules, address, cityId, subdistrictId } = req.body;
  const { images } = req.files;
  const update = {};

  if (validator.isInt(id ? id.toString() : '') === false)
    return res.status(400).json({ success: false, errors: 'invalid id' });
  if (price) {
    if (validator.isInt(price ? price.toString() : '') === false)
      return res.status(422).json({ success: false, errors: 'invalid price' });

    Object.assign(update, { price });
  }
  if (location) {
    let locations = location.split(',');
    locations[0] = general.customReplace(locations[0], ' ', '');
    locations[1] = general.customReplace(locations[1], ' ', '');
    if (validator.isNumeric(locations[0] ? locations[0].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid latitude' });
    if (validator.isNumeric(locations[1] ? locations[1].toString() : '') === false)
      return apiResponse._error({ res, errors: 'invalid longitude' });

    Object.assign(update, { location });
  }
  if (km) {
    if (validator.isInt(km ? km.toString() : '') === false)
      return res.status(422).json({ success: false, errors: 'invalid km' });

    Object.assign(update, { km });
  }
  if (address) Object.assign(update, { address });

  const result = {};
  let isUpload = false;
  if (images) {
    const tname = randomize('0', 4);
    result.name = `djublee/images/car/${tname}${moment().format('x')}${unescape(
      images[0].originalname
    ).replace(/\s/g, '')}`;
    result.mimetype = images[0].mimetype;
    result.data = images[0].buffer;
    isUpload = true;
    Object.assign(update, { STNKphoto: result.name });
  }

  let checkDetails = { status: true, message: `ingredient oke` };
  if (meetingSchedules) {
    meetingSchedules.map(d => {
      if (validator.isInt(d.id ? d.id.toString() : '') === false) {
        Object.assign(checkDetails, { status: false, message: `invalid id ${d.id}` });
        return;
      }
      if (validator.isInt(d.day ? d.day.toString() : '') === false) {
        Object.assign(checkDetails, { status: false, message: `invalid day ${d.id}` });
        return;
      }
      // if (validator.isInt(d.startTime ? d.startTime.toString() : '') === false) {
      if (!d.startTime) {
        Object.assign(checkDetails, { status: false, message: `invalid startTime ${d.id}` });
        return;
      }
      if (!d.endTime) {
        Object.assign(checkDetails, { status: false, message: `invalid endTime ${d.id}` });
        return;
      }
    });
    if (!checkDetails.status)
      return apiResponse._error({
        res,
        status: checkDetails.status,
        errors: checkDetails.message,
        data: null
      });
  }

  if (cityId) {
    const cityExist = await models.City.findByPk(cityId);
    if (!cityExist) return res.status(404).json({ success: false, errors: 'city not found' });
    Object.assign(update, { cityId });
  }
  if (subdistrictId) {
    const subDistrictExist = await models.SubDistrict.findOne({
      where: {
        id: subdistrictId,
        cityId
      }
    });
    if (!subDistrictExist)
      return res.status(404).json({ success: false, errors: 'sub district not found' });
    Object.assign(update, { subdistrictId });
  }

  const carExists = await models.Car.findByPk(id);
  if (!carExists) return apiResponse._error({ res, errors: `car not found` });
  Object.assign(update, { oldPrice: carExists.price });

  let isCheaper = false;
  const userNotifs = [];
  if (price) {
    isCheaper = price < carExists.price ? true : isCheaper;
    if (isCheaper) {
      // notif ke penyuka
      const likers = await models.Like.aggregate('userId', 'DISTINCT', {
        plain: false,
        where: { carId: id }
      });
      likers.map(async liker => {
        userNotifs.push({
          userId: liker.DISTINCT,
          collapseKey: null,
          notificationTitle: `Harga Mobil Turun`,
          notificationBody: `Mobil yang anda suka menurunkan harga`,
          notificationClickAction: `carPriceDiskon`,
          dataReferenceId: id,
          category: 3, // like
          status: 1, // menurunkan harga
          tab: `tabLike`
        });
      });

      const bidders = await models.Bargain.aggregate('userId', 'DISTINCT', {
        plain: false,
        where: { carId: id }
      });
      bidders.map(async bidder => {
        userNotifs.push({
          userId: bidder.DISTINCT,
          collapseKey: null,
          notificationTitle: `Harga Mobil Turun`,
          notificationBody: `Mobil yang anda tawar menurunkan harga`,
          notificationClickAction: `carPriceDiskon`,
          dataReferenceId: id,
          category: 2, // bid
          status: 2, // menurunkan harga
          tab: `tabBeli`
        });
      });
    }
  }

  // console.log(userNotifs.length);
  // return res
  //   .status(200)
  //   .json({
  //     success: true,
  //     userNotifs,
  //     price,
  //     status: price < carExists.price ? `lebih murah` : `tidak`,
  //     data: carExists
  //   });

  const trans = await models.sequelize.transaction();
  const errors = [];

  await carExists
    .update(update, {
      transaction: trans
    })
    .then(async () => {
      if (meetingSchedules) {
        meetingSchedules.map(async d => {
          if (d.id > 0) {
            return models.MeetingSchedule.update(
              {
                day: d.day,
                startTime: d.startTime,
                endTime: d.endTime
              },
              {
                where: { id: d.id }
              }
            );
          } else {
            return models.MeetingSchedule.create({
              carId: carExists.id,
              day: d.day,
              startTime: d.startTime,
              endTime: d.endTime
            });
          }
        });
      }
    })
    .catch(async err => {
      trans.rollback();
      return res.status(422).json({
        success: false,
        errors: err.message
      });
    });

  if (errors.length > 0) {
    trans.rollback();
    return res.status(422).json({
      success: false,
      errors
    });
  }

  trans.commit();
  if (isUpload) imageHelper.uploadToS3(result);

  if (userNotifs.length > 0) {
    userNotifs.map(async userNotif => {
      const emit = await notification.insertNotification(userNotif);
      req.io.emit(`${userNotif.tab}-${userNotif.userId}`, emit);
      notification.userNotif(userNotif);
      console.log(userNotif);
    });
  }

  const data = await models.Car.findByPk(id, {
    include: [
      {
        model: models.MeetingSchedule,
        as: 'meetingSchedule',
        attributes: ['id', 'carId', 'day', 'startTime', 'endTime']
      }
    ]
  });

  return res.status(200).json({ success: true, data });
});

router.post('/like/:id', passport.authenticate('user', { session: false }), async (req, res) => {
  const { id } = req.params;
  const car = await models.Car.findOne({
    where: {
      id
    }
  });

  if (!car) {
    return res.status(404).json({
      success: false,
      errors: 'data not found'
    });
  }

  const user = await models.Like.findOne({
    where: {
      [Op.and]: [{ userId: req.user.id }, { carId: id }]
    }
  });
  if (user) {
    if (user.status === true) {
      return user
        .update({
          status: false
        })
        .then(data => {
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
    return user
      .update({
        status: true
      })
      .then(data => {
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

  return models.Like.create({
    userId: req.user.id,
    carId: car.id,
    status: true
  })
    .then(data => {
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

router.post('/view/:id', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  const car = await models.Car.findOne({
    where: {
      id
    }
  });

  if (!car) {
    return res.status(404).json({
      success: false,
      errors: 'data not found'
    });
  }

  let user = null;
  if (userId) {
    user = userId;
  }

  return models.View.create({
    userId: user,
    carId: car.id
  })
    .then(data => {
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

router.delete('/id/:id', passport.authenticate('user', { session: false }), async (req, res) => {
  const { id } = req.params;
  if (validator.isInt(id ? id.toString() : '') === false) {
    return res.status(400).json({
      success: false,
      errors: 'Invalid Parameter'
    });
  }

  const data = await models.Car.findByPk(id);
  if (!data) {
    return res.status(400).json({
      success: false,
      errors: 'Car not found'
    });
  }

  const bargainData = await models.Bargain.findAll({
    where: {
      carId: id
    }
  });
  const bargains = [];
  if (bargainData) {
    bargainData.map(dataB => {
      bargains.push(dataB.id.toString());
    });
    console.log(bargains);
  }

  // like
  const likeData = await models.Like.findAll({
    where: {
      carId: id
    }
  });
  const likes = [];
  if (likeData) {
    likeData.map(dataL => {
      likes.push(dataL.id.toString());
    });
    console.log(likes);
  }

  // view
  const viewData = await models.View.findAll({
    where: {
      carId: id
    }
  });
  const views = [];
  if (viewData) {
    viewData.map(dataV => {
      views.push(dataV.id.toString());
    });
    console.log(views);
  }

  const trans = await models.sequelize.transaction();

  models.Car.destroy({ where: { id } }, { transaction: trans }).catch(err => {
    trans.rollback();
    return res.status(422).json({
      success: false,
      errors: err.message
    });
  });

  if (bargains !== []) {
    models.Bargain.destroy(
      {
        where: {
          id: { $in: bargains }
        }
      },
      {
        transaction: trans
      }
    ).catch(err => {
      trans.rollback();
      return res.status(422).json({
        success: false,
        errors: err.message
      });
    });
  }

  if (likes !== []) {
    models.Like.destroy(
      {
        where: {
          id: { $in: likes }
        }
      },
      {
        transaction: trans
      }
    ).catch(err => {
      trans.rollback();
      return res.status(422).json({
        success: false,
        errors: err.message
      });
    });
  }

  if (views !== []) {
    models.View.destroy(
      {
        where: {
          id: { $in: views }
        }
      },
      {
        transaction: trans
      }
    ).catch(err => {
      trans.rollback();
      return res.status(422).json({
        success: false,
        errors: err.message
      });
    });
  }

  trans.commit();
  return res.json({
    success: true,
    data
  });
});

router.delete('/meet/schedules/:id', passport.authenticate('user', { session: false }), async (req, res) => {
  const { id } = req.params;
  if (validator.isInt(id ? id.toString() : '') === false)
    return res.status(400).json({ success: false, errors: 'Invalid Parameter' });

  const data = await models.MeetingSchedule.findByPk(id);
  if (!data) return res.status(400).json({ success: false, errors: 'Schedule not found' });

  return data.destroy(id)
    .then(async data => {
      return apiResponse._success({ res, data });
    })
    .catch(err => {
      return apiResponse._error({ res, errors: err });
    });
});

module.exports = router;
