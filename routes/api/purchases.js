/* eslint-disable linebreak-style */
const express = require('express');
const validator = require('validator');
const passport = require('passport');
const models = require('../../db/models');
const paginator = require('../../helpers/paginator');

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

  const where = {
    userId: req.user.id
  };

  return models.Purchase.findAll({
    include: [
      {
        model: models.Car,
        as: 'car',
        attributes: {
          include: [
            [
              models.sequelize.literal(
                '(SELECT COUNT("Likes"."id") FROM "Likes" WHERE "Likes"."carId" = "car"."id" AND "Likes"."status" IS TRUE AND "Likes"."deletedAt" IS NULL)'
              ),
              'like'
            ],
            [
              models.sequelize.literal(
                '(SELECT COUNT("Views"."id") FROM "Views" WHERE "Views"."carId" = "car"."id" AND "Views"."deletedAt" IS NULL)'
              ),
              'view'
            ]
          ]
        },
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
        // attributes: ['condition']
      },
      {
        model: models.User,
        as: 'user',
        attributes: {
          exclude: ['createdAt', 'updatedAt', 'deletedAt', 'password']
        }
      }
    ],
    where,
    order,
    offset,
    limit
  })
    .then(async data => {
      const count = await models.Purchase.count({ where });
      const pagination = paginator.paging(page, count, limit);

      res.json({
        success: true,
        data,
        pagination
      });
    })
    .catch(err => {
      res.status(422).json({
        success: true,
        errors: err.message
      });
    });
});

router.get('/id/:id', async (req, res) => {
  const { id } = req.params;

  return models.Purchase.findOne({
    include: [
      {
        model: models.Car,
        as: 'car',
        attributes: {
          include: [
            [
              models.sequelize.literal(
                '(SELECT COUNT("Likes"."id") FROM "Likes" WHERE "Likes"."carId" = "car"."id" AND "Likes"."status" IS TRUE AND "Likes"."deletedAt" IS NULL)'
              ),
              'like'
            ],
            [
              models.sequelize.literal(
                '(SELECT COUNT("Views"."id") FROM "Views" WHERE "Views"."carId" = "car"."id" AND "Views"."deletedAt" IS NULL)'
              ),
              'view'
            ]
          ]
        },
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
        // attributes: ['condition']
      },
      {
        model: models.User,
        as: 'user',
        attributes: {
          exclude: ['createdAt', 'updatedAt', 'deletedAt', 'password']
        }
      }
    ],
    where: { id }
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

router.post('/', passport.authenticate('user', { session: false }), async (req, res) => {
  const { carId, paymentMethod, haveSeenCar } = req.body;

  const userData = await models.Car.findOne({
    where: { id: carId }
  });
  if (!userData) {
    return res.status(404).json({
      success: false,
      errors: 'User not found'
    });
  }

  const carData = await models.Car.findOne({
    where: { id: carId }
  });
  if (!carData) {
    return res.status(404).json({
      success: false,
      errors: 'Car not found'
    });
  }

  const trans = await models.sequelize.transaction();

  await carData
    .update(
      {
        status: 2
      },
      {
        transaction: trans
      }
    )
    .catch(err => {
      trans.rollback();
      res.status(422).json({
        success: false,
        errors: err.message
      });
    });

  return models.Purchase.create(
    {
      carId,
      userId: req.user.id,
      price: carData.price,
      paymentMethod,
      haveSeenCar
    },
    {
      transaction: trans
    }
  )
    .then(data => {
      trans.commit();
      res.json({
        success: true,
        data
      });
    })
    .catch(err => {
      trans.rollback();
      res.status(422).json({
        success: false,
        errors: err.message
      });
    });
});

router.put('/id/:id', passport.authenticate('user', { session: false }), async (req, res) => {
  const { id } = req.params;
  if (validator.isInt(id ? id.toString() : '') === false) {
    return res.status(400).json({
      success: false,
      errors: 'Invalid Parameter'
    });
  }

  const data = await models.Purchase.findByPk(id);
  if (!data) {
    return res.status(400).json({
      success: false,
      errors: 'Purchase not found'
    });
  }

  const { carId, userId, price, paymentMethod, haveSeenCar } = req.body;

  return data
    .update({
      carId,
      userId,
      price,
      paymentMethod,
      haveSeenCar
    })
    .then(() => {
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

router.delete('/:id', passport.authenticate('user', { session: false }), async (req, res) => {
  const { id } = req.params;
  if (validator.isInt(id ? id.toString() : '') === false) {
    return res.status(400).json({
      success: false,
      errors: 'Invalid Parameter'
    });
  }
  const data = await models.Purchase.findByPk(id);
  if (!data) {
    return res.status(400).json({
      success: false,
      errors: 'data not found'
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
    .catch(err => {
      res.status(422).json({
        success: true,
        errors: err.message
      });
    });
});

module.exports = router;
