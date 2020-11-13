/* eslint-disable linebreak-style */
const moment = require('moment');
const express = require('express');
const validator = require('validator');
const Sequelize = require('sequelize');
const randomize = require('randomatic');
const models = require('../../db/models');
const minio = require('../../helpers/minio');
const paginator = require('../../helpers/paginator');

const { Op } = Sequelize;
const router = express.Router();

const DEFAULT_LIMIT = process.env.DEFAULT_LIMIT || 10;
const MAX_LIMIT = process.env.MAX_LIMIT || 50;

router.get('/', async (req, res) => {
  let { page, limit, sort } = req.query;
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (parseInt(limit) > MAX_LIMIT) limit = MAX_LIMIT;
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

router.get('/id/:id', async (req, res) => {
  const { id } = req.params;

  return models.Brand.findByPk(id)
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
  const { name, status } = req.body;
  const { images } = req.files;

  if (!name) {
    return res.status(400).json({
      success: false,
      errors: 'name is mandatory'
    });
  }

  const dataUnique = await models.Brand.findOne({
    where: {
      name: {
        [Op.iLike]: this.name
      }
    }
  });
  if (dataUnique) {
    return res.status(400).json({
      success: false,
      errors: 'Brand name already exist'
    });
  }

  let logo = null;
  const result = {};
  if (images) {
    const tname = randomize('0', 4);
    result.name = `djublee/images/brand/${tname}${moment().format('x')}${unescape(
      images[0].originalname
    ).replace(/\s/g, '')}`;
    result.mimetype = images[0].mimetype;
    result.data = images[0].buffer;
    logo = result.name;
  }

  const trans = await models.sequelize.transaction();
  const data = await models.Brand.create(
    { name, status, logo }, 
    { transaction: trans }
  ).catch(err => {
    trans.rollback();
    return res.status(422).json({
      success: false,
      errors: err.message
    });
  });

  if (Object.keys(result).length > 0) {
    await minio.upload(result.name, result.data).then(res => {
      console.log(`etag min.io: ${res.etag}`);
    }).catch(err => {
      trans.rollback();
      return res.status(422).json({
        success: false,
        errors: err
      });
    });
  }

  trans.commit();
  return res.json({
    success: true,
    data
  });
});

router.put('/id/:id', async (req, res) => {
  const { id } = req.params;
  if (validator.isInt(id ? id.toString() : '') === false) {
    return res.status(400).json({
      success: false,
      errors: 'Invalid Parameter'
    });
  }

  const data = await models.Brand.findByPk(id);
  const oldLogo = data.logo;
  if (!data) {
    return res.status(400).json({
      success: false,
      errors: 'Brand not found'
    });
  }

  const { name, status } = req.body;
  const { images } = req.files;

  if (!name) {
    return res.status(400).json({
      success: false,
      errors: 'name is mandatory'
    });
  }

  const dataUnique = await models.Brand.findOne({
    where: {
      name: {
        [Op.iLike]: this.name
      }
    }
  });
  if (dataUnique) {
    return res.status(400).json({
      success: false,
      errors: 'Brand name already exist'
    });
  }

  let logo = null;
  const result = {};
  if (images) {
    const tname = randomize('0', 4);
    result.name = `djublee/images/brand/${tname}${moment().format('x')}${unescape(
      images[0].originalname
    ).replace(/\s/g, '')}`;
    result.mimetype = images[0].mimetype;
    result.data = images[0].buffer;
    logo = result.name;
  }

  const trans = await models.sequelize.transaction();
  await data.update(
    { name, status, logo },
    { transaction: trans }
  ).catch(err => {
    trans.rollback();
    return res.status(422).json({
      success: false,
      errors: err.message
    });
  });

  if (Object.keys(result).length > 0) {
    if(oldLogo) {
      // delete old file
      await minio.destroy(oldLogo).catch(err => {
        trans.rollback();
        return res.status(422).json({
          success: false,
          errors: err
        });
      });
    }

    await minio.upload(result.name, result.data).then(res => {
      console.log(`etag min.io: ${res.etag}`);
    }).catch(err => {
      trans.rollback();
      return res.status(422).json({
        success: false,
        errors: err
      });
    });
  }

  trans.commit();
  return res.json({
    success: true,
    data
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
  const data = await models.Brand.findByPk(id);
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
