/* eslint-disable linebreak-style */
const moment = require('moment');
const express = require('express');
const validator = require('validator');
const Sequelize = require('sequelize');
const randomize = require('randomatic');
const models = require('../../db/models');
const imageHelper = require('../../helpers/s3');
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

  return models.ModelYear.findAll({
    where,
    include: [
      {
        model: models.Model,
        as: 'model',
        attributes: {
          exclude: ['createdAt', 'updatedAt', 'deletedAt']
        },
        include: [
          {
            model: models.GroupModel,
            as: 'groupModel',
            attributes: {
              exclude: ['createdAt', 'updatedAt', 'deletedAt']
            },
            include: [
              {
                model: models.Type,
                as: 'type',
                attributes: {
                  exclude: ['createdAt', 'updatedAt', 'deletedAt']
                }
              },
              {
                model: models.Brand,
                as: 'brand',
                attributes: {
                  exclude: ['createdAt', 'updatedAt', 'deletedAt']
                }
              }
            ]
          }
        ]
      }
    ],
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
});

router.get('/id/:id', async (req, res) => {
  const { id } = req.params;

  return models.ModelYear.findByPk(id)
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

router.get('/model/:id', async (req, res) => {
  const { id } = req.params;

  return models.ModelYear.findAll({
    where: {
      modelId: id
    }
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

router.post('/', async (req, res) => {
  const { year, modelId, price } = req.body;
  const { images } = req.files;

  if (!year) return res.status(422).json({ success: false, errors: 'year mandatory' });
  if (!modelId) return res.status(422).json({ success: false, errors: 'modelId mandatory' });
  if (!price) return res.status(422).json({ success: false, errors: 'price mandatory' });

  const modelExist = await models.Model.findByPk(modelId);
  if (!modelExist) return res.status(404).json({ success: false, errors: 'modelId not found' });

  const create = {
    year,
    modelId,
    price
  };

  let picture = null;
  const result = {};
  if (images) {
    const tname = randomize('0', 4);
    const img = images[0].mimetype.split('/');
    result.name = `djublee/images/modelYear/${tname}${moment().format('x')}${unescape(
      `.${img[1]}`
    ).replace(/\s/g, '')}`;
    result.mimetype = images[0].mimetype;
    result.data = images[0].buffer;
    picture = result.name;
    // imageHelper.uploadToS3(result);
    Object.assign(create, { picture });
  }

  // return res.json({ success: true, data: create });
  return models.ModelYear.create(create)
    .then(data => {
      if (picture) imageHelper.uploadToS3(result);
      res.json({ success: true, data });
    })
    .catch(err => {
      res.status(422).json({ success: false, errors: err.message });
    });
});

router.put('id/:id', async (req, res) => {
  const { id } = req.params;
  if (validator.isInt(id ? id.toString() : '') === false) {
    return res.status(400).json({
      success: false,
      errors: 'Invalid Parameter'
    });
  }

  const data = await models.ModelYear.findByPk(id);
  if (!data) {
    return res.status(400).json({
      success: false,
      errors: 'ModelYear not found'
    });
  }

  const { year, modelId } = req.body;
  const { images } = req.files;

  let picture = null;
  if (images) {
    const result = {};
    const tname = randomize('0', 4);
    result.name = `djublee/images/modelYear/${tname}${moment().format('x')}${unescape(
      images[0].originalname
    ).replace(/\s/g, '')}`;
    result.mimetype = images[0].mimetype;
    result.data = images[0].buffer;
    picture = result.name;
    imageHelper.uploadToS3(result);
  }

  return data
    .update({
      year,
      picture,
      modelId
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

router.delete('/id/:id', async (req, res) => {
  const { id } = req.params;
  if (validator.isInt(id ? id.toString() : '') === false) {
    return res.status(400).json({
      success: false,
      errors: 'Invalid Parameter'
    });
  }
  const data = await models.ModelYear.findByPk(id);
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
