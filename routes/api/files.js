/* eslint-disable linebreak-style */
const moment = require('moment');
const express = require('express');
const validator = require('validator');
const randomize = require('randomatic');
const models = require('../../db/models');
const minio = require('../../helpers/minio');
const paginator = require('../../helpers/paginator');

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

  return models.File.findAll({ where, order, offset, limit })
    .then(async data => {
      const count = await models.File.count({ where });
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

  return models.File.findByPk(id)
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
  const { type } = req.body;
  const { images } = req.files;

  if (!type) {
    return res.status(400).json({
      success: false,
      errors: ' type must be filled '
    });
  }

  let url = null;
  const result = {};
  if (images) {
    const tname = randomize('0', 4);
    result.name = `djublee/images/file/${tname}${moment().format('x')}${unescape(
      images[0].originalname
    ).replace(/\s/g, '')}`;
    result.mimetype = images[0].mimetype;
    result.data = images[0].buffer;
    url = result.name;
  }

  const trans = await models.sequelize.transaction();
  const data = await models.File.create(
    { url, type },
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

  const data = await models.File.findByPk(id);
  const oldUrl = data.url;
  if (!data) {
    return res.status(400).json({
      success: false,
      errors: 'File not found'
    });
  }

  const { images } = req.files;

  let url = null;
  const result = {};
  if (images) {
    const tname = randomize('0', 4);
    result.name = `djublee/images/file/${tname}${moment().format('x')}${unescape(
      images[0].originalname
    ).replace(/\s/g, '')}`;
    result.mimetype = images[0].mimetype;
    result.data = images[0].buffer;
    url = result.name;
  }

  const trans = await models.sequelize.transaction();
  await data.update(
    { url },
    { transaction: trans }
  ).catch(err => {
    trans.rollback();
    return res.status(422).json({
      success: false,
      errors: err.message
    });
  });

  if (Object.keys(result).length > 0) {
    if(oldUrl) {
      // delete old file
      await minio.destroy(oldUrl).catch(err => {
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

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  if (validator.isInt(id ? id.toString() : '') === false) {
    return res.status(400).json({
      success: false,
      errors: 'Invalid Parameter'
    });
  }
  const data = await models.File.findByPk(id);
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
