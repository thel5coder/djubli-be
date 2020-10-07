/* eslint-disable linebreak-style */
const express = require('express');
const validator = require('validator');
const Sequelize = require('sequelize');
const passport = require('passport');
const models = require('../../db/models');
const carHelper = require('../../helpers/car');
const paginator = require('../../helpers/paginator');

const { Op } = Sequelize;
const router = express.Router();

const DEFAULT_LIMIT = process.env.DEFAULT_LIMIT || 10;
const MAX_LIMIT = process.env.MAX_LIMIT || 50;

router.get('/', async (req, res) => {
  let { page, limit, sort } = req.query;
  const { groupModelId, name, by } = req.query;
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
  const whereCar = {};
  if (groupModelId) {
    const groupModel = await models.GroupModel.findByPk(groupModelId);
    if(!groupModel) {
      return res.status(422).json({
        success: false,
        errors: 'groupModel not exist'
      });
    }

    Object.assign(where, {
      groupModelId
    });

    Object.assign(whereCar, {
      groupModelId,
      brandId: groupModel.brandId
    });
  }

  if(name) {
    Object.assign(where, {
      name: {
        [Op.iLike]: `%${name}%`
      }
    });
  }

  return models.Model.findAll({
    attributes: {
      include: [
        [
          models.sequelize.fn("COUNT", models.sequelize.col("car.id")), 
          'countResult'
        ]
      ]
    },
    include: [
      {
        model: models.Car,
        as: 'car',
        attributes: [],
        where: whereCar
      }
    ],
    subQuery: false,
    where,
    order,
    group: ['Model.id'],
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

router.get('/listingAll', async (req, res) => {
  const { by } = req.query;
  let { page, limit, sort } = req.query;
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (parseInt(limit) > MAX_LIMIT) limit = MAX_LIMIT;
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
        models.sequelize.fn("MAX", models.sequelize.col("car.price")), 
        'maxPrice'
      ],
      [
        models.sequelize.fn("MIN", models.sequelize.col("car.price")), 
        'minPrice'
      ],
      [
        models.sequelize.fn("COUNT", models.sequelize.col("car.id")), 
        'numberOfCar'
      ]
    ]),
    include: [
      {
        model: models.Car,
        as: 'car',
        attributes: []
      }
    ],
    subQuery: false,
    where,
    order,
    group: ['Model.id'],
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

router.get('/listingCar/:id', async (req, res) => {
  const { by, year } = req.query;
  const { id } = req.params;
  let { page, limit, sort } = req.query;
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (parseInt(limit) > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  let order = [['createdAt', 'desc']];
  if (!sort) sort = 'asc';
  else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';

  if (by === 'price' || by === 'id') order = [[by, sort]];

  const where = {
    modelId: id
  };

  const includeWhere = {};

  if (year) {
    Object.assign(includeWhere, {
      year
    });
  }

  return models.Car.findAll({
    attributes: Object.keys(models.Car.attributes).concat([
      [
        models.sequelize.fn("COUNT", models.sequelize.col("likes.id")), 
        'like'
      ],
      [
        models.sequelize.fn("COUNT", models.sequelize.col("views.id")), 
        'view'
      ]
    ]),
    include: [
      {
        model: models.ModelYear,
        as: 'modelYear',
        where: includeWhere,
        include: [
          {
            model: models.Model,
            as: 'model',
            attributes: ['name'],
            include: [
              {
                model: models.GroupModel,
                as: 'groupModel',
                attributes: ['name'],
                include: [
                  {
                    model: models.Brand,
                    as: 'brand',
                    attributes: ['name']
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        model: models.User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'phone', 'type', 'companyType']
      },
      {
        model: models.Color,
        as: 'interiorColor',
        attributes: ['name']
      },
      {
        model: models.Color,
        as: 'exteriorColor',
        attributes: ['name']
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
        include: [
          {
            model: models.File,
            as: 'file',
            attributes: {
              exclude: ['createdAt', 'updatedAt', 'deletedAt']
            }
          }
        ]
      },
      {
        model: models.ExteriorGalery,
        as: 'exteriorGalery',
        attributes: ['id', 'fileId', 'carId'],
        include: [
          {
            model: models.File,
            as: 'file',
            attributes: {
              exclude: ['createdAt', 'updatedAt', 'deletedAt']
            }
          }
        ]
      },
      {
        model: models.Like,
        as: 'likes',
        attributes: []
      },
      {
        model: models.View,
        as: 'views',
        attributes: []
      }
    ],
    subQuery: false,
    where,
    order,
    group: [
      '"Car"."id"', 
      '"modelYear"."id"', 
      '"modelYear->model"."id"', 
      '"modelYear->model->groupModel"."id"', 
      '"modelYear->model->groupModel->brand"."id"',
      '"user"."id"', 
      '"interiorColor"."id"', 
      '"exteriorColor"."id"', 
      '"meetingSchedule"."id"',
      '"interiorGalery"."id"', 
      '"interiorGalery->file"."id"', 
      '"exteriorGalery"."id"', 
      '"exteriorGalery->file"."id"'
    ],
    offset,
    limit
  })
    .then(async data => {
      const count = await models.Car.count({
        include: [
          {
            model: models.ModelYear,
            as: 'modelYear',
            where: includeWhere
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
});

module.exports = router;
