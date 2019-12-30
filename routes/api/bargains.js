/* eslint-disable linebreak-style */
const express = require('express');
const validator = require('validator');
const passport = require('passport');
const Sequelize = require('sequelize');
const models = require('../../db/models');
const paginator = require('../../helpers/paginator');

const { Op } = Sequelize;
const router = express.Router();

const DEFAULT_LIMIT = process.env.DEFAULT_LIMIT || 10;
const MAX_LIMIT = process.env.MAX_LIMIT || 50;

router.get('/', async (req, res) => {
  let { page, limit, sort } = req.query;
  const { userId, carId, bidType, negotiationType, expiredAt } = req.query;
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  const order = [['createdAt', 'desc']];
  if (!sort) sort = 'asc';
  else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';

  const where = {};

  if (carId) {
    Object.assign(where, {
      dealerId: {
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

  if (validator.isInt(userId ? userId.toString() : '') === false) {
    return res.status(406).json({
      success: false,
      errors: 'type of userId must be int'
    });
  }

  if (validator.isInt(carId ? carId.toString() : '') === false) {
    return res.status(406).json({
      success: false,
      errors: 'type of carId must be int'
    });
  }

  if (validator.isBoolean(haveSeenCar ? haveSeenCar.toString() : '') === false) {
    return res.status(406).json({
      success: false,
      errors: 'type of haveSeenCar must be boolean'
    });
  }

  if (!bidAmount) {
    return res.status(400).json({
      success: false,
      errors: 'bidAmount must be filled'
    });
  }

  if (!paymentMethod) {
    return res.status(400).json({
      success: false,
      errors: 'paymentMethod must be filled'
    });
  }

  if (!expiredAt) {
    return res.status(400).json({
      success: false,
      errors: 'expiredAt must be filled'
    });
  }

  return models.Bargain.create({
    userId,
    carId,
    bidAmount,
    haveSeenCar,
    paymentMethod,
    expiredAt,
    bidType: 0
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

router.post('/negotiate', passport.authenticate('user', { session: false }), async (req, res) => {
  const {
    userId,
    carId,
    bidAmount,
    haveSeenCar,
    paymentMethod,
    expiredAt,
    negotiationType,
    comment
  } = req.body;

  if (validator.isInt(userId ? userId.toString() : '') === false) {
    return res.status(406).json({
      success: false,
      errors: 'type of userId must be int'
    });
  }

  if (validator.isInt(carId ? carId.toString() : '') === false) {
    return res.status(406).json({
      success: false,
      errors: 'type of carId must be int'
    });
  }

  if (validator.isInt(negotiationType ? negotiationType.toString() : '') === false) {
    return res.status(406).json({
      success: false,
      errors: 'type of negotiationType must be int'
    });
  }

  if (validator.isBoolean(haveSeenCar ? haveSeenCar.toString() : '') === false) {
    return res.status(406).json({
      success: false,
      errors: 'type of haveSeenCar must be boolean'
    });
  }

  if (!bidAmount) {
    return res.status(400).json({
      success: false,
      errors: 'bidAmount must be filled'
    });
  }

  if (!paymentMethod) {
    return res.status(400).json({
      success: false,
      errors: 'paymentMethod must be filled'
    });
  }

  if (!expiredAt) {
    return res.status(400).json({
      success: false,
      errors: 'expiredAt must be filled'
    });
  }

  return models.Bargain.create({
    userId,
    carId,
    bidAmount,
    haveSeenCar,
    paymentMethod,
    expiredAt,
    bidType: 1,
    negotiationType,
    comment
  })
    .then(data => {
      req.io.emit(`negotiation-car${carId}`, data);

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

router.delete(
  '/failureNegotiation/:id',
  passport.authenticate('user', { session: false }),
  async (req, res) => {
    const { id } = req.params;

    return models.Bargain.delete({
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

module.exports = router;
