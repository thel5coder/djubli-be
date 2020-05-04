/* eslint-disable linebreak-style */
const moment = require('moment');
const express = require('express');
const validator = require('validator');
const passport = require('passport');
const Sequelize = require('sequelize');
const models = require('../../db/models');
const general = require('../../helpers/general');
const paginator = require('../../helpers/paginator');
const apiResponse = require('../../helpers/apiResponse');

const { Op } = Sequelize;
const router = express.Router();

const DEFAULT_LIMIT = process.env.DEFAULT_LIMIT || 10;
const MAX_LIMIT = process.env.MAX_LIMIT || 50;

router.get('/', passport.authenticate('user', { session: false }), async (req, res) => {
  let { page, limit, by, sort } = req.query;
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  let order = [['createdAt', 'desc']];
  if (!sort) sort = 'asc';
  else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';

  if (by === 'id' || by === 'userId' || by === 'createdAt') order = [[by, sort]];

  const where = {
  	userId: req.user.id
  };

  return models.SearchHistory.findAll({
    include: [
      {
        model: models.User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'phone']
      }
    ],
    where,
    order,
    offset,
    limit
  })
    .then(async data => {
      const count = await models.SearchHistory.count({ where });
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

router.get('/id/:id', passport.authenticate('user', { session: false }), async (req, res) => {
  const { id } = req.params;

  return models.SearchHistory.findOne({
  	where: {
  		userId: req.user.id,
  		id
  	},
    include: [
      {
        model: models.User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'phone']
      }
    ]
  })
    .then(async data => {
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
  const { title, apiURL, countResult } = req.body;

  if (!apiURL) return res.status(400).json({ success: false, errors: 'apiURL is mandatory' });
  if (!countResult)
    return res.status(400).json({ success: false, errors: 'count result is mandatory' });

  return await models.SearchHistory.create({
    userId: req.user.id,
    title,
    apiURL,
    countResult
  })
    .then(data =>
      res.json({
        success: true,
        data
      })
    )
    .catch(err =>
      res.status(422).json({
        success: false,
        errors: err.message
      })
    );
});

router.put('/:id', passport.authenticate('user', { session: false }), async (req, res) => {
  const { title, apiURL, countResult } = req.body;
  const { id } = req.params;

  if (validator.isInt(id ? id.toString() : '') === false) {
    return res.status(400).json({
      success: false,
      errors: 'Invalid Parameter'
    });
  }

  if (!apiURL) return res.status(400).json({ success: false, errors: 'apiURL is mandatory' });
  if (!countResult)
    return res.status(400).json({ success: false, errors: 'count result is mandatory' });

  const data = await models.SearchHistory.findOne({
    where: {
      userId: req.user.id,
      id
    }
  });

  if (!data) {
    return res.status(400).json({
      success: false,
      errors: 'Search History not found'
    });
  }

  return data
    .update({
      title,
      apiURL,
      countResult
    })
    .then(data =>
      res.json({
        success: true,
        data
      })
    )
    .catch(err =>
      res.status(422).json({
        success: false,
        errors: err.message
      })
    );
});

router.delete('/id/:id', passport.authenticate('user', { session: false }), async (req, res) => {
  const { id } = req.params;
  if (validator.isInt(id ? id.toString() : '') === false) {
    return res.status(400).json({
      success: false,
      errors: 'Invalid Parameter'
    });
  }

  const data = await models.SearchHistory.findOne({
    where: {
      userId: req.user.id,
      id
    }
  });

  if (!data) {
    return res.status(400).json({
      success: false,
      errors: 'Search History not found'
    });
  }

  return data
    .destroy()
    .then(data =>
      res.json({
        success: true,
        data
      })
    )
    .catch(err =>
      res.status(422).json({
        success: false,
        errors: err.message
      })
    );
});

module.exports = router;
