const validator = require('validator');
const Sequelize = require('sequelize');
const models = require('../db/models');
const paginator = require('../helpers/paginator');

const { Op } = Sequelize;

const DEFAULT_LIMIT = process.env.DEFAULT_LIMIT || 10;
const MAX_LIMIT = process.env.MAX_LIMIT || 50;

async function get(req, res) {
  let { page, limit, by, sort } = req.query;
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  let order = [['createdAt', 'desc']];
  if (!sort) sort = 'asc';
  else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';

  if (by === 'id' || by === 'userId' || by === 'createdAt') order = [[by, sort]];

  const where = {
    userId: req.user.id,
    commentId: null
  };

  return models.CarsComments.findAll({
    include: [
      {
        model: models.User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'phone', 'type', 'companyType']
      },
      {
        model: models.Car,
        as: 'car'
      },
      {
        model: models.CarsComments,
        as: 'reply',
        include: [
          {
            model: models.User,
            as: 'user',
            attributes: ['id', 'name', 'email', 'phone', 'type', 'companyType']
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
      const count = await models.CarsComments.count({
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
}

async function getById(req, res) {
  const { id } = req.params;

  return models.CarsComments.findOne({
    where: {
      id
    },
    include: [
      {
        model: models.User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'phone', 'type', 'companyType']
      },
      {
        model: models.Car,
        as: 'car'
      },
      {
        model: models.CarsComments,
        as: 'reply',
        include: [
          {
            model: models.User,
            as: 'user',
            attributes: ['id', 'name', 'email', 'phone', 'type', 'companyType']
          }
        ]
      }
    ]
  })
    .then(async data => {
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
}

async function create(req, res) {
  const { commentId, carId, comment } = req.body;

  if (!carId) {
    return res.status(400).json({
      success: false,
      errors: 'car is mandatory'
    });
  } else {
    const car = await models.Car.findOne({
      where: {
        id: carId
      }
    });

    if (!car) {
      return res.status(400).json({
        success: false,
        errors: 'Car not found'
      });
    }
  }

  if (!comment) {
    return res.status(400).json({
      success: false,
      errors: 'comment is mandatory'
    });
  }

  if(commentId) {
    const carComment = await models.CarsComments.findOne({
      where: {
        id: commentId,
        carId
      }
    });

    if (!carComment) {
      return res.status(400).json({
        success: false,
        errors: 'Car Comment not found'
      });
    }
  }

  return await models.CarsComments.create({
    userId: req.user.id,
    commentId,
    carId,
    comment
  })
    .catch(err => {
      res.status(422).json({
        success: false,
        errors: err.message
      });
    })
    .then(data => {
      res.json({
        success: true,
        data
      });
    });
}

async function edit(req, res) {
  const { comment } = req.body;
  const { id } = req.params;

  if (validator.isInt(id ? id.toString() : '') === false) {
    return res.status(400).json({
      success: false,
      errors: 'Invalid Parameter'
    });
  }

  const data = await models.CarsComments.findOne({
    where: {
      id,
      userId: req.user.id
    }
  });

  if (!data) {
    return res.status(400).json({
      success: false,
      errors: 'Car Comment not found'
    });
  }

  if (!comment) {
    return res.status(400).json({
      success: false,
      errors: 'comment is mandatory'
    });
  }

  return data.update({
    comment
  })
    .catch(err => {
      res.status(422).json({
        success: false,
        errors: err.message
      });
    })
    .then(data => {
      res.json({
        success: true,
        data
      });
    });
}

async function destroy(req, res) {
  const { id } = req.params;
  if (validator.isInt(id ? id.toString() : '') === false) {
    return res.status(400).json({
      success: false,
      errors: 'Invalid Parameter'
    });
  }

  const data = await models.CarsComments.findOne({
    where: {
      id
    }
  });

  if (!data) {
    return res.status(400).json({
      success: false,
      errors: 'Cars Comments not found'
    });
  }

  const trans = await models.sequelize.transaction();
  data
    .destroy({
      transaction: trans
    })
    .catch(err => {
      trans.rollback();
      res.status(422).json({
        success: false,
        errors: err.message
      });
    });

  await models.CarsComments.destroy({
    where: {
      commentId: data.id
    },
    transaction: trans
  }).catch(err => {
    trans.rollback();
    res.status(422).json({
      success: false,
      errors: err.message
    });
  });

  trans.commit();
  return res.json({
    success: true,
    data
  });
}

module.exports = {
  get,
  getById,
  create,
  edit,
  destroy
};
