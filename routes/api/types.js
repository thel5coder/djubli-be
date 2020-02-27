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
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  const order = [['createdAt', 'desc']];
  if (!sort) sort = 'asc';
  else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';

  const where = {};

  return models.Type.findAll({
    where,
    order,
    offset,
    limit
  })
    .then(async data => {
      const count = await models.Type.count({ where });
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

router.get('/listingCar', async (req, res) => {
  let { page, limit, sort } = req.query;
  const { name, typeId, carName, carCondition } = req.query;
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  const order = [['createdAt', 'desc']];
  if (!sort) sort = 'asc';
  else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';

  const where = {};
  if (name) {
    Object.assign(where, {
      name: {
        [Op.iLike]: `%${name}%`
      }
    });
  }

  if (typeId) {
    Object.assign(where, {
      id: typeId
    });
  }

  const whereInclude = {};
  if (carName) {
    Object.assign(whereInclude, {
      name: {
        [Op.iLike]: `%${carName}%`
      }
    });
  }

  const whereCar = {};
  if (carCondition) {
    Object.assign(whereCar, {
      condition: carCondition
    });
  }
  return models.Type.findAll({
    include: [
      {
        attributes: Object.keys(models.GroupModel.attributes).concat([
          [
            models.sequelize.literal(
              `(SELECT MAX("Cars"."price") 
                FROM "Cars" 
                WHERE "Cars"."groupModelId" = "groupModel"."id" 
                  AND "Cars"."deletedAt" IS NULL
              )`
            ),
            'maxPrice'
          ],
          [
            models.sequelize.literal(
              `(SELECT MIN("Cars"."price") 
                FROM "Cars" 
                WHERE "Cars"."groupModelId" = "groupModel"."id" 
                  AND "Cars"."deletedAt" IS NULL
              )`
            ),
            'minPrice'
          ],
          [
            models.sequelize.literal(
              `(SELECT COUNT("Cars"."id") 
                FROM "Cars" 
                WHERE "Cars"."groupModelId" = "groupModel"."id" 
                  AND "Cars"."deletedAt" IS NULL
              )`
            ),
            'numberOfCar'
          ]
        ]),
        model: models.GroupModel,
        as: 'groupModel',
        where: whereInclude,
        include: [
          {
            model: models.Car,
            as: 'car',
            where: whereCar,
            attributes: Object.keys(models.Car.attributes).concat([
              [
                models.sequelize.literal(
                  `(SELECT MAX("Bargains"."bidAmount") 
                    FROM "Bargains" 
                    WHERE "Bargains"."carId" = "Car"."id"
                      AND "Bargains"."deletedAt" IS NULL
                      AND "Bargains"."bidType" = 0
                  )`
                ),
                'bidAmount'
              ],
              [
                models.sequelize.literal(
                  `(SELECT COUNT("Bargains"."id") 
                    FROM "Bargains" 
                    WHERE "Bargains"."carId" = "Car"."id"
                      AND "Bargains"."deletedAt" IS NULL
                      AND "Bargains"."bidType" = 0
                  )`
                ),
                'numberOfBidder'
              ],
              [
                models.sequelize.literal(
                  `(SELECT COUNT("Likes"."id") 
                    FROM "Likes" 
                    WHERE "Likes"."carId" = "car"."id" 
                      AND "Likes"."status" IS TRUE 
                      AND "Likes"."deletedAt" IS NULL
                  )`
                ),
                'like'
              ],
              [
                models.sequelize.literal(
                  `(SELECT COUNT("Views"."id") 
                    FROM "Views" 
                    WHERE "Views"."carId" = "car"."id" 
                      AND "Views"."deletedAt" IS NULL
                  )`
                ),
                'view'
              ]
            ]),
            include: [
              {
                model: models.User,
                as: 'user',
                attributes: ['name', 'type', 'companyType']
              },
              {
                model: models.ExteriorGalery,
                as: 'exteriorGalery',
                attributes: {
                  exclude: ['createdAt', 'updatedAt', 'deletedAt']
                },
                include: {
                  model: models.File,
                  as: 'file',
                  attributes: ['type', 'url']
                }
              },
              {
                model: models.Brand,
                as: 'brand',
                attributes: {
                  exclude: ['createdAt', 'updatedAt', 'deletedAt']
                }
              },
              {
                model: models.Model,
                as: 'model',
                attributes: {
                  exclude: ['createdAt', 'updatedAt', 'deletedAt']
                }
              },
              {
                model: models.GroupModel,
                as: 'groupModel',
                attributes: {
                  exclude: ['createdAt', 'updatedAt', 'deletedAt']
                }
              },
              {
                model: models.ModelYear,
                as: 'modelYear',
                attributes: {
                  exclude: ['createdAt', 'updatedAt', 'deletedAt']
                }
              },
              {
                model: models.Color,
                as: 'exteriorColor',
                attributes: {
                  exclude: ['createdAt', 'updatedAt', 'deletedAt']
                }
              },
              {
                model: models.Color,
                as: 'interiorColor',
                attributes: {
                  exclude: ['createdAt', 'updatedAt', 'deletedAt']
                }
              }
            ]
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
      const count = await models.Type.count({
        include: [
          {
            model: models.GroupModel,
            as: 'groupModel',
            attributes: ['name'],
            include: [
              {
                model: models.Car,
                as: 'car'
              }
            ]
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
