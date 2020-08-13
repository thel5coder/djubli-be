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
  if (parseInt(limit) > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  const order = [['createdAt', 'desc']];
  if (!sort) sort = 'asc';
  else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';

  const where = {};

  return models.GroupModel.findAll({
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
    ],
    where,
    order,
    offset,
    limit
  })
    .then(async data => {
      const count = await models.GroupModel.count({ where });
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

  return models.GroupModel.findOne({
    include: [
      {
        model: models.Type,
        as: 'type',
        attribute: ['id', 'name', 'status']
      }
    ],
    where: {
      id
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

router.get('/brand/:id', async (req, res) => {
  const { id } = req.params;

  return models.GroupModel.findAll({
    include: [
      {
        model: models.Type,
        as: 'type',
        attribute: ['id', 'name', 'status']
      }
    ],
    where: {
      brandId: id
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
  const { name, brandId, typeId } = req.body;
  if (!name) {
    return res.status(400).json({
      success: false,
      errors: 'name is mandatory'
    });
  }
  if (!brandId) {
    return res.status(400).json({
      success: false,
      errors: 'brandId is mandatory'
    });
  }
  if (!typeId) {
    return res.status(400).json({
      success: false,
      errors: 'typeId is mandatory'
    });
  }

  const dataUnique = await models.GroupModel.findOne({
    where: {
      name: {
        [Op.iLike]: this.name
      }
    }
  });
  if (dataUnique) {
    return res.status(400).json({
      success: false,
      errors: 'GroupModel name already exist'
    });
  }

  return models.GroupModel.create({
    name,
    brandId,
    typeId
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

router.put('/id/:id', async (req, res) => {
  const { id } = req.params;
  if (validator.isInt(id ? id.toString() : '') === false) {
    return res.status(400).json({
      success: false,
      errors: 'Invalid Parameter'
    });
  }
  const data = await models.GroupModel.findByPk(id);
  if (!data) {
    return res.status(400).json({
      success: false,
      errors: 'GroupModel not found'
    });
  }

  const { name, brandId, typeId } = req.body;

  if (!name) {
    return res.status(400).json({
      success: false,
      errors: 'name is mandatory'
    });
  }

  const dataUnique = await models.GroupModel.findOne({
    where: {
      name: {
        [Op.iLike]: this.name
      }
    }
  });
  if (dataUnique) {
    return res.status(400).json({
      success: false,
      errors: 'GroupModel name already exist'
    });
  }

  return data
    .update({
      name,
      brandId,
      typeId
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
  const data = await models.GroupModel.findByPk(id);
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
