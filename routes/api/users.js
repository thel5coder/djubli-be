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
  const { modelYearId } = req.body;
  const { brand, bank, ccType, ccUsedFrom } = req.body;
  const { hStatus, surfaceArea, hUsedFrom } = req.body;
  let { isCar, isHome, isCard } = false;

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
  let carModel = [];
  if (modelYearId) {
    carModel = general.mapping(modelYearId);
    isCar = true;
  }

  // mapping credit card detail
  let { cardBrand, cardType, cardBank, cardUsedFrom } = [];
  if (brand && bank && ccType && ccUsedFrom) {
    cardBrand = general.mapping(brand);
    cardBank = general.mapping(bank);
    cardType = general.mapping(ccType);
    cardUsedFrom = general.mapping(ccUsedFrom);
    isCard = true;
  }

  // mapping home detail
  let { homeStatus, homeArea, homeUsedFrom } = [];
  if (hStatus && surfaceArea && hUsedFrom) {
    homeStatus = general.mapping(hStatus);
    homeArea = general.mapping(surfaceArea);
    homeUsedFrom = general.mapping(hUsedFrom);
    isHome = true;
  }

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
      if (isCar) {
        const car = [];
        for (let i = 0; i < carModel.length; i += 1) {
          car.push({ userId: data.id, modelYearId: carModel[i] });
        }

        await models.UserEndUserCarDetail.bulkCreate(car)
          .then(() => {
            console.log('car detail inserted');
          })
          .catch(err => {
            res.status(400).json({
              success: false,
              errors: err.message
            });
          });
      }

      if (isCard) {
        const card = [];
        for (let j = 0; j < cardBank.length; j += 1) {
          card.push({
            userId: data.id,
            brand: cardBrand[j],
            bank: cardBank[j],
            type: cardType[j],
            usedFrom: cardUsedFrom[j]
          });
        }

        await models.UserEndUserCreditCardDetail.bulkCreate(card)
          .then(() => {
            console.log('card detail inserted');
          })
          .catch(err => {
            res.status(400).json({
              success: false,
              errors: err.message
            });
          });
      }

      if (isHome) {
        const home = [];
        for (let k = 0; k < homeArea.length; k += 1) {
          home.push({
            userId: data.id,
            status: homeStatus[k],
            surfaceArea: homeArea[k],
            usedFrom: homeUsedFrom[k]
          });
        }

        await models.UserEndUserHouseDetail.bulkCreate(home)
          .then(() => {
            console.log('home detail inserted');
          })
          .catch(err => {
            res.status(400).json({
              success: false,
              errors: err.message
            });
          });
      }
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
      errors: 'User not found'
    });
  }

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
  const { modelYearId } = req.body;
  const { brand, bank, ccType, ccUsedFrom } = req.body;
  const { hStatus, surfaceArea, hUsedFrom } = req.body;
  let { isCar, isHome, isCard } = false;

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
  let carModel = [];
  if (modelYearId) {
    carModel = general.mapping(modelYearId);
    isCar = true;
  }

  // mapping credit card detail
  let { cardBrand, cardType, cardBank, cardUsedFrom } = [];
  if (brand && bank && ccType && ccUsedFrom) {
    cardBrand = general.mapping(brand);
    cardBank = general.mapping(bank);
    cardType = general.mapping(ccType);
    cardUsedFrom = general.mapping(ccUsedFrom);
    isCard = true;
  }

  // mapping home detail
  let { homeStatus, homeArea, homeUsedFrom } = [];
  if (hStatus && surfaceArea && hUsedFrom) {
    homeStatus = general.mapping(hStatus);
    homeArea = general.mapping(surfaceArea);
    homeUsedFrom = general.mapping(hUsedFrom);
    isHome = true;
  }

  return data
    .update({
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
    .then(async () => {
      if (isCar) {
        const car = [];
        for (let i = 0; i < carModel.length; i += 1) {
          car.push({ userId: data.id, modelYearId: carModel[i] });
        }

        await models.UserEndUserCarDetail.bulkCreate(car)
          .then(() => {
            console.log('car detail inserted');
          })
          .catch(err => {
            res.status(400).json({
              success: false,
              errors: err.message
            });
          });
      }

      if (isCard) {
        const card = [];
        for (let j = 0; j < cardBank.length; j += 1) {
          card.push({
            userId: data.id,
            brand: cardBrand[j],
            bank: cardBank[j],
            type: cardType[j],
            usedFrom: cardUsedFrom[j]
          });
        }

        await models.UserEndUserCreditCardDetail.bulkCreate(card)
          .then(() => {
            console.log('card detail inserted');
          })
          .catch(err => {
            res.status(400).json({
              success: false,
              errors: err.message
            });
          });
      }

      if (isHome) {
        const home = [];
        for (let k = 0; k < homeArea.length; k += 1) {
          home.push({
            userId: data.id,
            status: homeStatus[k],
            surfaceArea: homeArea[k],
            usedFrom: homeUsedFrom[k]
          });
        }

        await models.UserEndUserHouseDetail.bulkCreate(home)
          .then(() => {
            console.log('home detail inserted');
          })
          .catch(err => {
            res.status(400).json({
              success: false,
              errors: err.message
            });
          });
      }
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
