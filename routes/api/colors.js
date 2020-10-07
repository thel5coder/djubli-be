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
  // const whereCar = {};
  let whereCar = '';
  if(name) {
    Object.assign(where, {
      name: {
        [Op.iLike]: `%${name}%`
      }
    });
  }

  if(brandId) {
    // Object.assign(where, {
    //   brandId
    // });
    whereCar += ` AND "Car"."brandId" = ${brandId}`;
  }

  if(modelId) {
    // Object.assign(where, {
    //   modelId
    // });
    whereCar += ` AND "Car"."modelId" = ${modelId}`;
  }

  if(groupModelId) {
    // Object.assign(where, {
    //   groupModelId
    // });
    whereCar += ` AND "Car"."groupModelId" = ${groupModelId}`;
  }

  if(exteriorColorId) {
    // Object.assign(where, {
    //   exteriorColorId
    // });
    whereCar += ` AND "Car"."exteriorColorId" = ${exteriorColorId}`;
  }

  if(interiorType == 1) {
    whereColor = `"Car"."interiorColorId" = "Color"."id"`;
  } else if(interiorType == 2) {
    whereColor = `"Car"."exteriorColorId" = "Color"."id"`;
  }

  return models.Color.findAll({
    attributes: {
      include: [
        [
          models.sequelize.literal(`(SELECT COUNT("Car"."id") 
            FROM "Cars" as "Car" 
            WHERE ${whereColor} ${whereCar}
              AND "Car"."status" = 0
              AND "Car"."deletedAt" IS NULL
          )`),
          'countResult'
        ]
        // [
        //   models.sequelize.fn("COUNT", models.sequelize.col("car.id")), 
        //   'countResult'
        // ]
      ]
    },
    // include: [
    //   {
    //     model: models.Car,
    //     as: 'car',
    //     attributes: [],
    //     where: whereCar
    //   }
    // ],
    // subQuery: false,
    where,
    order,
    // group: ['Color.id'],
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
