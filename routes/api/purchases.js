/* eslint-disable linebreak-style */
const express = require('express');
const validator = require('validator');
const passport = require('passport');
const Sequelize = require('sequelize');
const models = require('../../db/models');
const paginator = require('../../helpers/paginator');
const carHelper = require('../../helpers/car');

const router = express.Router();

const DEFAULT_LIMIT = process.env.DEFAULT_LIMIT || 10;
const MAX_LIMIT = process.env.MAX_LIMIT || 50;

router.get('/', passport.authenticate('user', { session: false }), async (req, res) => {
  const { id } = req.user;
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

  const where = {
    userId: id
  };

  return models.Purchase.findAll({
    attributes: {
      exclude: ['deletedAt']
    },
    include: [
      {
        model: models.Car,
        as: 'car',
        attributes: {
          include: await carHelper.customFields({ fields: ['like', 'view', 'islike', 'isBid'], id })
        },
        include: await carHelper.attributes(),
        where: {}
      }
    ],
    where,
    order,
    offset,
    limit
  })
    .then(async data => {
      const count = await models.Purchase.count({ where });
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
});

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
        include: await carHelper.attributes()
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
  const { carId, paymentMethod, haveSeenCar } = req.body;

  const userData = await models.Car.findOne({
    where: { id: carId }
  });
  if (!userData) {
    return res.status(404).json({
      success: false,
      errors: 'User not found'
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

  const trans = await models.sequelize.transaction();

  await carData
    .update(
      {
        status: 2
      },
      {
        transaction: trans
      }
    )
    .catch(err => {
      trans.rollback();
      res.status(422).json({
        success: false,
        errors: err.message
      });
    });

  return models.Purchase.create(
    {
      carId,
      userId: req.user.id,
      price: carData.price,
      paymentMethod,
      haveSeenCar
    },
    {
      transaction: trans
    }
  )
    .then(data => {
      trans.commit();
      res.json({
        success: true,
        data
      });
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

module.exports = router;
