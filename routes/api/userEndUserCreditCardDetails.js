/* eslint-disable linebreak-style */
const express = require('express');
const validator = require('validator');
const models = require('../../db/models');
const passport = require('passport');
const paginator = require('../../helpers/paginator');

const router = express.Router();

const DEFAULT_LIMIT = process.env.DEFAULT_LIMIT || 10;
const MAX_LIMIT = process.env.MAX_LIMIT || 50;

router.get('/', async (req, res) => {
  let { page, limit, sort } = req.query;
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  const order = [['createdAt', 'desc']];
  if (!sort) sort = 'asc';
  else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';

  const where = {};

  return models.UserEndUserCreditCardDetail.findAll({
    where,
    order,
    offset,
    limit
  })
    .then(async data => {
      const count = await models.UserEndUserCreditCardDetail.count({ where });
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

router.delete('/:id', passport.authenticate('user', { session: false }), async (req, res) => {
  const { id } = req.params;
  if (validator.isInt(id ? id.toString() : '') === false) {
    return res.status(400).json({
      success: false,
      errors: 'Invalid parameter'
    });
  }

  const data = await models.UserEndUserCreditCardDetail.findByPk(id);
  if (!data) {
    return res.status(400).json({
      success: false,
      errors: 'User End User Credit Card Detail not found'
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
    .catch(() => {
      res.status(422).json({
        success: false,
        errors: 'Something wrong!!'
      });
    });
});

module.exports = router;
