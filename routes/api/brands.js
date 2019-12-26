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

router.get('/', passport.authenticate('user', { session: false }), async (req, res) => {
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

  return models.Brand.findAll({
    where,
    order,
    offset,
    limit
  })
    .then(async data => {
      const count = await models.Brand.count({ where });
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

  if (by === 'id' || by === 'numberOfCar') order = [[by, sort]];

  const where = {};

  return models.Brand.findAll({
    attributes: Object.keys(models.Brand.attributes).concat([
      [
        models.sequelize.literal(
          '(SELECT MAX("Cars"."price") FROM "Cars" WHERE "Cars"."brandId" = "Brand"."id")'
        ),
        'maxPrice'
      ],
      [
        models.sequelize.literal(
          '(SELECT MIN("Cars"."price") FROM "Cars" WHERE "Cars"."brandId" = "Brand"."id")'
        ),
        'minPrice'
      ],
      [
        models.sequelize.literal(
          '(SELECT COUNT("Cars"."id") FROM "Cars" WHERE "Cars"."brandId" = "Brand"."id")'
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
      const count = await models.Brand.count({ where });
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
      brandId: id
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
        const count = await models.ModelYear.count({ where });
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
