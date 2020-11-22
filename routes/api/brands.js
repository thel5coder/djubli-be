/* eslint-disable linebreak-style */
const express = require('express');
const validator = require('validator');
const Sequelize = require('sequelize');
const models = require('../../db/models');
const carHelper = require('../../helpers/car');
const paginator = require('../../helpers/paginator');
const minio = require('../../helpers/minio');

const { Op } = Sequelize;
const router = express.Router();

const DEFAULT_LIMIT = process.env.DEFAULT_LIMIT || 10;
const MAX_LIMIT = process.env.MAX_LIMIT || 50;

router.get('/', async (req, res) => {
  let { page, limit, sort } = req.query;
  const { name, by } = req.query;
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
  if(name) {
    Object.assign(where, {
      name: {
        [Op.iLike]: `%${name}%`
      }
    });
  }

  return models.Brand.findAll({
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
        attributes: []
      }
    ],
    subQuery: false,
    where,
    order,
    group: ['Brand.id'],
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

  return models.Brand.findAll({
    attributes: Object.keys(models.Brand.attributes).concat([
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
    group: ['Brand.id'],
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

  const includeWhere = {};
  const where = {
    brandId: id
  };

  if (year) {
    Object.assign(includeWhere, {
      year
    });
  }

  const addAttributes = {
    fields: [
      'like',
      'view'
    ],
    upperCase: true,
  };

  const addAttribute = await carHelper.customFields(addAttributes);
  return models.Car.findAll({
    attributes: Object.keys(models.Car.attributes).concat(addAttribute),
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
            where: includeWhere
          }
        ],
        where
      });
      const pagination = paginator.paging(page, count, limit);

      await Promise.all(
        data.map(async item => {
          if(item.modelYear.picture) {
            const url = await minio.getUrl(item.modelYear.picture).then(res => {
              return res;
            }).catch(err => {
              res.status(422).json({
                success: false,
                errors: err
              });
            });

            item.modelYear.dataValues.pictureUrl = url;
          } else {
            item.modelYear.dataValues.pictureUrl = null;
          }

          await Promise.all(
            item.interiorGalery.map(async itemInteriorGalery => {
              if(itemInteriorGalery.file.url) {
                const url = await minio.getUrl(itemInteriorGalery.file.url).then(res => {
                  return res;
                }).catch(err => {
                  res.status(422).json({
                    success: false,
                    errors: err
                  });
                });

                itemInteriorGalery.file.dataValues.fileUrl = url;
              } else {
                itemInteriorGalery.file.dataValues.fileUrl = null;
              }
            }),

            item.exteriorGalery.map(async itemExteriorGalery => {
              if(itemExteriorGalery.file.url) {
                const url = await minio.getUrl(itemExteriorGalery.file.url).then(res => {
                  return res;
                }).catch(err => {
                  res.status(422).json({
                    success: false,
                    errors: err
                  });
                });

                itemExteriorGalery.file.dataValues.fileUrl = url;
              } else {
                itemExteriorGalery.file.dataValues.fileUrl = null;
              }
            })
          );
        })
      );

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
