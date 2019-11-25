/* eslint-disable linebreak-style */
const moment = require('moment');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const Sequelize = require('sequelize');
const validator = require('validator');
const models = require('../../db/models');
const keys = require('../../config/keys');
const general = require('../../helpers/general');

const { Op } = Sequelize;
const router = express.Router();

const DEFAULT_LIMIT = process.env.DEFAULT_LIMIT || 10;
const MAX_LIMIT = process.env.MAX_LIMIT || 50;
const paginator = require('../../helpers/paginator');

router.get('/', passport.authenticate('user', { session: false }), async (req, res) => {
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

  return models.User.findAll({
    where,
    order,
    offset,
    limit
  })
    .then(async data => {
      const count = await models.User.count({ where });
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

router.get('/id/:id', passport.authenticate('user', { session: false }), async (req, res) => {
  const { id } = req.params;

  return models.User.findByPk(id)
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

router.get('/token', passport.authenticate('user', { session: false }), async (req, res) => {
  const { id } = req.user;

  return models.User.findByPk(id)
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

  const data = await models.User.findOne({
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

router.post('/register', async (req, res) => {
  const {
    name,
    password,
    confirmPassword,
    phone,
    email,
    type,
    companyType,
    profileImageId,
    address,
    status
  } = req.body;
  const { modelDetailId, yearId } = req.body;
  const { brand, bank, ccType, ccUsedFrom } = req.body;
  const { hStatus, surfaceArea, hUsedFrom } = req.body;

  if (!name) {
    return res.status(400).json({
      success: false,
      errors: 'name is mandatory'
    });
  }

  if (!type) {
    return res.status(400).json({
      success: false,
      errors: 'type is mandatory'
    });
  }

  if (validator.isEmail(email ? email.toString() : '') === false) {
    return res.status(400).json({
      success: false,
      errors: 'invalid email'
    });
  }

  const dataUnique = await models.User.findOne({
    where: {
      email: {
        [Op.eq]: email
      }
    }
  });
  if (dataUnique) {
    return res.status(400).json({
      success: false,
      errors: 'email already exist'
    });
  }

  if (validator.isMobilePhone(phone ? phone.toString() : '') === false) {
    return res.status(400).json({
      success: false,
      errors: 'invalid phone'
    });
  }

  if (validator.isBoolean(status ? status.toString() : '') === false) {
    return res.status(400).json({
      success: false,
      errors: 'status must be boolean'
    });
  }

  if (!address) {
    return res.status(400).json({
      success: false,
      errors: 'address is mandatory'
    });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({
      success: true,
      errors: 'password mismatch'
    });
  }

  const hashedPassword = await bcrypt.hashSync(password, 10);
  // mapping car detail
  const carModel = general.mapping(modelDetailId);
  const carYears = general.mapping(yearId);
  // mapping credit card detail
  const cardBrand = general.mapping(brand);
  const cardBank = general.mapping(bank);
  const cardType = general.mapping(ccType);
  const cardUsedFrom = general.mapping(ccUsedFrom);
  // mapping home detail
  const homeStatus = general.mapping(hStatus);
  const homeArea = general.mapping(surfaceArea);
  const homeUsedFrom = general.mapping(hUsedFrom);

  return models.User.create({
    phone,
    email,
    emailValidAt: moment.now(),
    name,
    password: hashedPassword,
    type,
    companyType,
    profileImageId,
    address,
    status
  })
    .then(async data => {
      const car = [];
      for (let i = 0; i < carModel.length; i++) {
        car.push({ userId: data.id, modelDetailId: carModel[i], yearId: carYears[i] });
      }
      const card = [];
      for (let j = 0; j < cardBank.length; j++) {
        card.push({
          userId: data.id,
          brand: cardBrand[j],
          bank: cardBank[j],
          type: cardType[j],
          usedFrom: cardUsedFrom[j]
        });
      }
      const home = [];
      for (let k = 0; k < homeArea.length; k++) {
        home.push({
          userId: data.id,
          status: homeStatus[k],
          surfaceArea: homeArea[k],
          usedFrom: homeUsedFrom[k]
        });
      }

      await models.UserEndUserCarDetail.bulkCreate(car);
      await models.UserEndUserHouseDetail.bulkCreate(home);
      await models.UserEndUserCreditCardDetail.bulkCreate(card);
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

router.put('/:id', passport.authenticate('user', { session: false }), async (req, res) => {
  const { id } = req.params;
  if (validator.isInt(id ? id.toString() : '') === false) {
    return res.status(400).json({
      success: false,
      errors: 'Invalid parameter'
    });
  }

  const data = await models.User.findByPk(id);
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

  const dataUnique = await models.User.findOne({
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
});

router.delete('/:id', passport.authenticate('user', { session: false }), async (req, res) => {
  const { id } = req.params;
  if (validator.isInt(id ? id.toString() : '') === false) {
    return res.status(400).json({
      success: false,
      errors: 'Invalid parameter'
    });
  }

  const data = await models.User.findByPk(id);
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
});

module.exports = router;
