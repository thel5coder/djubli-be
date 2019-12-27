/* eslint-disable linebreak-style */
const express = require('express');
const validator = require('validator');
const Sequelize = require('sequelize');
const passport = require('passport');
const models = require('../../db/models');
const paginator = require('../../helpers/paginator');

const { Op } = Sequelize;
const router = express.Router();

const DEFAULT_LIMIT = process.env.DEFAULT_LIMIT || 10;
const MAX_LIMIT = process.env.MAX_LIMIT || 50;

router.get('/', async (req, res) => {
  let { page, limit, sort, groupModelId } = req.query;
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  const order = [['createdAt', 'desc']];
  if (!sort) sort = 'asc';
  else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';

  const where = {};
  if (groupModelId) {
    Object.assign(where, {
      groupModelId: {
        [Op.eq]: groupModelId
      }
    });
  }

  return models.Model.findAll({
    where,
    order,
    offset,
    limit
  })
    .then(async data => {
      const count = await models.Model.count({ where });
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

router.get('/listingAll', passport.authenticate('user', { session: false }), async (req, res) => {
  const { by } = req.query;
  let { page, limit, sort } = req.query;
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  let order = [['createdAt', 'desc']];
  if (!sort) sort = 'asc';
  else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';

  if (by === 'id') order = [[by, sort]];
  else if (by === 'numberOfCar') order = [[models.sequelize.col('numberOfCar'), sort]];

  const where = {};

  return models.Model.findAll({
    attributes: Object.keys(models.Model.attributes).concat([
      [
        models.sequelize.literal(
          '(SELECT MAX("Cars"."price") FROM "Cars" WHERE "Cars"."modelId" = "Model"."id")'
        ),
        'maxPrice'
      ],
      [
        models.sequelize.literal(
          '(SELECT MIN("Cars"."price") FROM "Cars" WHERE "Cars"."modelId" = "Model"."id")'
        ),
        'minPrice'
      ],
      [
        models.sequelize.literal(
          '(SELECT COUNT("Cars"."id") FROM "Cars" WHERE "Cars"."modelId" = "Model"."id")'
        ),
        'numberOfCar'
      ]
    ]),
    where,
    order,
    offset,
    limit
  })
    .then(async data => {
      const count = await models.Model.count({ where });
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

router.get(
  '/listingCar/:id',
  passport.authenticate('user', { session: false }),
  async (req, res) => {
    const { by, year } = req.query;
    const { id } = req.params;
    let { page, limit, sort } = req.query;
    let offset = 0;

    if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;
    if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
    else page = 1;

    let order = [['createdAt', 'desc']];
    if (!sort) sort = 'asc';
    else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';

    if (by === 'price' || by === 'id') order = [[by, sort]];

    const where = {
      modelId: id
    };

    const inludeWhere = {};

    if (year) {
      Object.assign(inludeWhere, {
        year: {
          [Op.eq]: year
        }
      });
    }

    return models.Car.findAll({
      include: [
        {
          model: models.ModelYear,
          as: 'modelYear',
          where: inludeWhere
        }
      ],
      where,
      order,
      offset,
      limit
    })
      .then(async data => {
        const count = await models.Car.count({
          include: [
            {
              model: models.ModelYear,
              as: 'modelYear',
              where: inludeWhere
            }
          ],
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
  }
);

module.exports = router;
