/* eslint-disable linebreak-style */
const express = require('express');
const validator = require('validator');
const passport = require('passport');
const Sequelize = require('sequelize');
const models = require('../../db/models');
const paginator = require('../../helpers/paginator');
const carHelper = require('../../helpers/car');
const calculateDistance = require('../../helpers/calculateDistance');
const notification = require('../../helpers/notification');

const router = express.Router();

const { Op } = Sequelize;
const DEFAULT_LIMIT = process.env.DEFAULT_LIMIT || 10;
const MAX_LIMIT = process.env.MAX_LIMIT || 50;

router.get('/', passport.authenticate('user', { session: false }), async (req, res) => {
  const { id } = req.user;
  const { modelYearId } = req.query;
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
    tabType
  } = req.query;
  let { page, limit, sort, by } = req.query;
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  if (!by) by = 'id';
  const array = [
    'id',
    'carId',
    'price',
    'paymentMethod',
    'haveSeenCar',
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
    case 'km':
      order.push([Sequelize.literal(`"car.${by}" ${sort}`)]);
      break;
    case 'price':
      order.push([Sequelize.literal(`"car.${by}" ${sort}`)]);
      break;
    case 'condition':
      order.push([Sequelize.literal(`"car.${by}" ${sort}`)]);
      break;
    case 'view':
      order.push([Sequelize.literal(`"car.${by}" ${sort}`)]);
      break;
    case 'like':
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

  const where = {};
  if(tabType == 0) {
    const whereBargainUser = Sequelize.literal(`(SELECT "Bargains"."userId" 
      FROM "Bargains" 
      WHERE "Bargains"."id" = "Purchase"."bargainId"
        AND "Bargains"."deletedAt" IS null)`);

    Object.assign(where, [
      Sequelize.where(whereBargainUser, {
        [Op.eq]: id
      })
    ]);
  } else if(tabType == 1) {
    Object.assign(where, {
      [Op.or]: [
        {
          userId: id,
          bargainId: {
            [Op.not]: null
          },
          isAccept: true
        },
        {
          userId: id,
          bargainId: null
        }
      ]
    });
  }

  const whereCar = {};
  const whereModelYear = {};
  const whereProfile = {};
  const customFields = {
    fields: ['like', 'view', 'islike', 'isBid'],
    id
  };

  if (modelYearId) {
    const modelYearExists = await models.ModelYear.findByPk(modelYearId);
    if (!modelYearExists)
      return apiResponse._error({ res, errors: 'model year not found', code: 404 });
    Object.assign(whereCar, { modelYearId });
  }
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
    await calculateDistance.CreateOrReplaceCalculateDistance();
    const distances = Sequelize.literal(
      `(SELECT calculate_distance(${latitude}, ${longitude}, (SELECT CAST(COALESCE(NULLIF((SELECT split_part("car"."location", ',', 1)), ''), '0') AS NUMERIC) AS "latitude"), (SELECT CAST(COALESCE(NULLIF((SELECT split_part("car"."location", ',', 2)), ''), '0') AS NUMERIC) AS "longitude"), 'K'))`
    );
    // Object.assign(whereCar, { where: Sequelize.where(distances, { [Op.lte]: 10 }) });
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
    },
    {
      model: models.Bargain,
      as: 'bargain',
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
  ];

  return models.Purchase.findAll({
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
      const count = await models.Purchase.count({
        include: includes,
        where
      });
      const pagination = paginator.paging(page, count, limit);

      data.map(item => {
        item.dataValues.status = 'Tunggu DP';
      });

      res.json({
        success: true,
        pagination,
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

async function getByModelYearId(req, res, params) {
  const { auth } = params;
  const { modelYearId } = req.params;
  let { page, limit, sort, by } = req.query;
  let offset = 0;

  if (validator.isInt(modelYearId ? modelYearId.toString() : '') === false)
    return res.status(422).json({
      success: false,
      errors: `model year not found`
    });

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  if (!by) by = 'id';
  const array = [
    'id',
    'carId',
    'price',
    'paymentMethod',
    'haveSeenCar',
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
    case 'km':
    case 'price':
    case 'condition':
      order.push([{ model: models.Car, as: 'car' }, by, sort]);
      break;
    case 'view':
    case 'like':
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

  const where = {};
  const whereCar = {};
  if (modelYearId) {
    const modelYearExists = await models.ModelYear.findByPk(modelYearId);
    if (!modelYearExists) {
      return res.status(404).json({
        success: true,
        errors: `model year not found`
      });
    }
    Object.assign(whereCar, { modelYearId });
  }

  const includes = [
    {
      model: models.Car,
      as: 'car',
      attributes: {
        include: await carHelper.customFields({
          fields: auth ? ['like', 'view', 'islike', 'isBid'] : ['like', 'view'],
          id: auth ? req.user.id : null
        })
      },
      include: await carHelper.extraInclude(),
      where: whereCar
    }
  ];
  return models.Purchase.findAll({
    attributes: ['id', 'carId', 'price', 'paymentMethod', 'haveSeenCar'],
    include: includes,
    where,
    order,
    offset,
    limit
  })
    .then(async data => {
      const count = await models.Purchase.count({ include: includes, where });
      const pagination = paginator.paging(page, count, limit);

      res.json({
        success: true,
        pagination,
        data
      });
    })
    .catch(err => {
      res.status(422).json({
        success: true,
        errors: err.message
      });
    });
}

router.get('/models/years/:modelYearId', async (req, res) =>
  getByModelYearId(req, res, { auth: false })
);

router.get(
  '/logon/models/years/:modelYearId',
  passport.authenticate('user', { session: false }),
  async (req, res) => getByModelYearId(req, res, { auth: true })
);

router.get('/id/:id', passport.authenticate('user', { session: false }), async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  return models.Purchase.findOne({
    include: [
      {
        model: models.Car,
        as: 'car',
        attributes: {
          include: await carHelper.customFields({
            fields: ['like', 'view', 'islike', 'isBid'],
            id: userId
          })
        },
        include: await carHelper.extraInclude()
      },
      {
        model: models.User,
        as: 'user',
        attributes: {
          exclude: ['createdAt', 'updatedAt', 'deletedAt', 'password']
        }
      }
    ],
    where: { id }
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

  return models.Purchase.create(
    {
      carId,
      userId: req.user.id,
      price: carData.price,
      paymentMethod,
      haveSeenCar
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
