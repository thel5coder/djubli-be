/* eslint-disable linebreak-style */
const express = require('express');
const validator = require('validator');
const Sequelize = require('sequelize');
const models = require('../../db/models');
const paginator = require('../../helpers/paginator');

const { Op } = Sequelize;
const router = express.Router();

const DEFAULT_LIMIT = process.env.DEFAULT_LIMIT || 10;
const MAX_LIMIT = process.env.MAX_LIMIT || 50;

router.get('/', async (req, res) => {
  let { page, limit, sort } = req.query;
  const { name, by, brandId, modelId, groupModelId, exteriorColorId, interiorType } = req.query;
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (parseInt(limit) > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  let order = [['createdAt', 'desc']];
  if (!sort) sort = 'asc';
  else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';

  if (by === 'name') order = [[by, sort]];
  if (by === 'countResult') order = [[models.sequelize.literal('"countResult"'), sort]];

  const where = {};
  let whereColor = `("Car"."interiorColorId" = "Color"."id" OR 
    "Car"."exteriorColorId" = "Color"."id")`;
  const whereCar = {};
  if(name) {
    Object.assign(where, {
      name: {
        [Op.iLike]: `%${name}%`
      }
    });
  }

  if(brandId) {
    Object.assign(whereCar, {
      brandId
    });
  }

  if(modelId) {
    Object.assign(whereCar, {
      modelId
    });
  }

  if(groupModelId) {
    Object.assign(whereCar, {
      groupModelId
    });
  }

  if(exteriorColorId) {
    Object.assign(whereCar, {
      exteriorColorId
    });
  }

  const include = [];
  const includeAttribute = [];
  if(interiorType == 1) {
    include.push(
      {
        model: models.Car,
        as: 'interiorColorCar',
        attributes: [],
        required: false,
        where: whereCar
      }
    );

    includeAttribute.push(
      [
        models.sequelize.fn("COUNT", models.sequelize.col("interiorColorCar.id")), 
        'countResult'
      ]
    );
  } else if(interiorType == 2) {
    include.push(
      {
        model: models.Car,
        as: 'exteriorColorCar',
        attributes: [],
        required: false,
        where: whereCar
      }
    );

    includeAttribute.push(
      [
        models.sequelize.fn("COUNT", models.sequelize.col("exteriorColorCar.id")), 
        'countResult'
      ]
    );
  } else if(!interiorType) {
    include.push(
      {
        model: models.Car,
        as: 'exteriorColorCar',
        attributes: [],
        required: false,
        where: whereCar
      },
      {
        model: models.Car,
        as: 'interiorColorCar',
        attributes: [],
        required: false,
        where: whereCar
      }
    );

    includeAttribute.push(
      [
        models.sequelize.literal(' COUNT("exteriorColorCar"."id")+COUNT("interiorColorCar"."id")'), 
        'countResult'
      ]
    );
  }

  return models.Color.findAll({
    attributes: {
      include: includeAttribute
    },
    include,
    subQuery: false,
    where,
    order,
    group: ['Color.id'],
    offset,
    limit
  })
    .then(async data => {
      const count = await models.Color.count({ where });
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

module.exports = router;
