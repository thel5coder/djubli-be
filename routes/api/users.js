/* eslint-disable linebreak-style */
const express = require('express');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const Sequelize = require('sequelize');
const models = require('../../db/models');
const keys = require('../../config/keys');
const authMiddleware = require('../../middlewares/auth');

const { Op } = Sequelize;
const router = express.Router();

const DEFAULT_LIMIT = process.env.DEFAULT_LIMIT || 10;
const MAX_LIMIT = process.env.MAX_LIMIT || 50;
const paginator = require('../../helpers/paginator');

router.get('/', passport.authenticate('admin', { session: false }), async (req, res) => {
  let { page, limit, sort } = req.query;
  const { by } = req.query;
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  let order = [['createdAt', 'desc']];
  if (!sort) sort = 'asc';
  else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';

  if (by === 'name' || by === 'email' || by === 'status' || by === 'isSuperAdmin')
    order = [[by, sort]];

  const { name, email, status, isSuperAdmin } = req.query;
  const where = {};
  if (name) {
    Object.assign(where, {
      name: {
        [Op.iLike]: `%${name}%`
      }
    });
  }
  if (email) {
    Object.assign(where, {
      email: {
        [Op.iLike]: `%${email}%`
      }
    });
  }
  if (validator.isBoolean(status ? status.toString() : '')) {
    Object.assign(where, {
      status
    });
  }
  if (validator.isBoolean(isSuperAdmin ? isSuperAdmin.toString() : '')) {
    Object.assign(where, {
      isSuperAdmin
    });
  }

  return models.Admin.findAll({
    where,
    order,
    offset,
    limit
  })
    .then(async data => {
      const count = await models.Admin.count({ where });
      const pagination = paginator.paging(page, count, limit);

      res.json({
        success: true,
        pagination,
        data
      });
    })
    .catch(() =>
      res.status(422).json({
        success: false,
        errors: 'Something wrong!!'
      })
    );
});

router.get('/id/:id', passport.authenticate('admin', { session: false }), async (req, res) => {
  const { id } = req.params;

  return models.Admin.findByPk(id)
    .then(data => {
      res.json({
        success: true,
        data
      });
    })
    .catch(() =>
      res.status(422).json({
        success: false,
        errors: 'Something wrong!!'
      })
    );
});

router.get('/token', passport.authenticate('admin', { session: false }), async (req, res) => {
  const { id } = req.user;

  return models.Admin.findByPk(id)
    .then(data => {
      res.json({
        success: true,
        data
      });
    })
    .catch(() =>
      res.status(422).json({
        success: false,
        errors: 'Something wrong!!'
      })
    );
});

router.post('/login', async (req, res) => {
  const errors = {};
  const { email, password } = req.body;

  if (validator.isEmail(email ? email.toString() : '') === false) {
    return res.status(404).json({
      success: false,
      errors: 'Email/Password is incorrect.'
    });
  }
  if (!password) {
    return res.status(404).json({
      success: false,
      errors: 'Email/Password is incorrect.'
    });
  }

  const data = await models.Admin.findOne({
    where: {
      email: {
        [Op.iLike]: email.toLowerCase()
      },
      status: true
    }
  });
  if (!data) {
    return res.status(404).json({
      success: false,
      errors: 'Email/Password is incorrect.'
    });
  }

  const isMatched = await bcrypt.compare(password, data.password);
  if (!isMatched) {
    return res.status(404).json({
      success: false,
      errors: 'Phone/Password is incorrect. Please contact Admin'
    });
  }

  const payload = {
    id: data.id
  };
  return jwt.sign(payload, keys.secretKey, { expiresIn: 8 * 3600 }, (err, token) => {
    if (err) {
      errors.jwt = 'Something wrong with JWT signing';
      return res.status(404).json(errors);
    }

    return res.json({
      success: true,
      token: `Bearer ${token}`
    });
  });
});

router.post(
  '/',
  passport.authenticate('admin', { session: false }),
  authMiddleware.checkSuperAdmin,
  async (req, res) => {
    const { name } = req.body;
    let { email, password, status, isSuperAdmin } = req.body;
    email = email.toLowerCase();
    if (validator.isBoolean(status ? status.toString() : '') === false) {
      status = false;
    }
    if (validator.isBoolean(isSuperAdmin ? isSuperAdmin.toString() : '') === false) {
      isSuperAdmin = false;
    }
    if (!name) {
      return res.status(400).json({
        success: false,
        errors: 'Invalid name'
      });
    }
    if (validator.isEmail(email ? email.toString() : '') === false) {
      return res.status(400).json({
        success: false,
        errors: 'Invalid email'
      });
    }
    if (!password) {
      return res.status(400).json({
        success: false,
        errors: 'Invalid password'
      });
    }
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        errors: 'Password minimum length is 8'
      });
    }
    password = await bcrypt.hashSync(password, 10);

    const dataUnique = await models.Admin.findOne({
      where: {
        email: {
          [Op.iLike]: email
        }
      }
    });
    if (dataUnique) {
      return res.status(400).json({
        success: false,
        errors: 'Phone or email already exist'
      });
    }

    return models.Admin.create({
      name,
      email,
      password,
      isSuperAdmin,
      status
    })
      .then(data => {
        res.json({
          success: true,
          data
        });
      })
      .catch(() => {
        res.status(422).json({
          success: false,
          errors: 'Something wrong!!'
        });
      });
  }
);

router.put(
  '/:id',
  passport.authenticate('admin', { session: false }),
  authMiddleware.checkSuperAdmin,
  async (req, res) => {
    const { id } = req.params;
    if (validator.isInt(id ? id.toString() : '') === false) {
      return res.status(400).json({
        success: false,
        errors: 'Invalid parameter'
      });
    }

    const data = await models.Admin.findByPk(id);
    if (!data) {
      return res.status(400).json({
        success: false,
        errors: 'Admin not found'
      });
    }

    const { name } = req.body;
    let { email, password, status, isSuperAdmin } = req.body;
    email = email.toLowerCase();
    if (validator.isBoolean(status ? status.toString() : '') === false) {
      status = false;
    }
    if (validator.isBoolean(isSuperAdmin ? isSuperAdmin.toString() : '') === false) {
      isSuperAdmin = false;
    }
    if (!name) {
      return res.status(400).json({
        success: false,
        errors: 'Invalid name'
      });
    }
    if (validator.isEmail(email ? email.toString() : '') === false) {
      return res.status(400).json({
        success: false,
        errors: 'Invalid email'
      });
    }
    if (!password) {
      return res.status(400).json({
        success: false,
        errors: 'Invalid password'
      });
    }
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        errors: 'Password minimum length is 8'
      });
    }
    password = await bcrypt.hashSync(password, 10);

    const dataUnique = await models.Admin.findOne({
      where: {
        email: {
          [Op.iLike]: email
        },
        id: {
          [Op.not]: id
        }
      }
    });
    if (dataUnique) {
      return res.status(400).json({
        success: false,
        errors: 'Phone or email already exist'
      });
    }

    return data
      .update({
        name,
        email,
        password,
        isSuperAdmin,
        status
      })
      .then(() => {
        res.json({
          success: true,
          data
        });
      })
      .catch(() => {
        res.status(422).json({
          success: false,
          errors: 'Something wrong!!'
        });
      });
  }
);

router.delete(
  '/:id',
  passport.authenticate('admin', { session: false }),
  authMiddleware.checkSuperAdmin,
  async (req, res) => {
    const { id } = req.params;
    if (validator.isInt(id ? id.toString() : '') === false) {
      return res.status(400).json({
        success: false,
        errors: 'Invalid parameter'
      });
    }

    const data = await models.Admin.findByPk(id);
    if (!data) {
      return res.status(400).json({
        success: false,
        errors: 'Admin not found'
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
      .catch(() => {
        res.status(422).json({
          success: false,
          errors: 'Something wrong!!'
        });
      });
  }
);

module.exports = router;
