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
  const { by, type, companyType } = req.query;
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
  if (type) {
    Object.assign(where, {
      type: {
        [Op.eq]: type
      }
    });
  }
  if (companyType) {
    Object.assign(where, {
      companyType: {
        [Op.eq]: companyType
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

  return models.User.findOne({
    include: [
      {
        model: models.Dealer,
        as: 'dealer',
        attributes: {
          exclude: ['createdAt', 'updatedAt', 'deletedAt']
        },
        include: [
          {
            model: models.DealerSellAndBuyBrand,
            as: 'dealerSellAndBuyBrand',
            attributes: {
              exclude: ['createdAt', 'updatedAt', 'deletedAt']
            }
          },
          {
            model: models.DealerWorkshopAuthorizedBrand,
            as: 'workshopAuthorizedBrand',
            attributes: {
              exclude: ['createdAt', 'updatedAt', 'deletedAt']
            }
          },
          {
            model: models.DealerWorkshopOtherBrand,
            as: 'workshopOtherBrand',
            attributes: {
              exclude: ['createdAt', 'updatedAt', 'deletedAt']
            }
          },
          {
            model: models.DealerGallery,
            as: 'dealerGallery',
            attributes: {
              exclude: ['createdAt', 'updatedAt', 'deletedAt']
            }
          }
        ]
      },
      {
        model: models.Company,
        as: 'company',
        attributes: {
          exclude: ['createdAt', 'updatedAt', 'deletedAt']
        }
      },
      {
        model: models.UserEndUserCarDetail,
        as: 'userCar',
        attributes: {
          exclude: ['createdAt', 'updatedAt', 'deletedAt']
        },
        include: [
          {
            model: models.ModelYear,
            as: 'modelYear',
            attributes: {
              exclude: ['createdAt', 'updatedAt', 'deletedAt']
            },
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
            ]
          }
        ]
      },
      {
        model: models.UserEndUserCreditCardDetail,
        as: 'userCreditCard',
        attributes: {
          exclude: ['createdAt', 'updatedAt', 'deletedAt']
        }
      },
      {
        model: models.UserEndUserHouseDetail,
        as: 'userHouse',
        attributes: {
          exclude: ['createdAt', 'updatedAt', 'deletedAt']
        }
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
    .catch(err =>
      res.status(422).json({
        success: false,
        errors: err.message
      })
    );
});

router.get('/myListingCar', passport.authenticate('user', { session: false }), async (req, res) => {
  let { page, limit, sort } = req.query;
  const { by, brandId, modelId, groupModelId, modelYearId } = req.query;
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  let order = [['createdAt', 'desc']];
  if (!sort) sort = 'asc';
  else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';

  if (by === 'id' || by === 'price') order = [[by, sort]];

  const where = {
    userId: req.user.id
  };

  if (brandId) {
    Object.assign(where, {
      brandId: {
        [Op.eq]: brandId
      }
    });
  }

  if (modelId) {
    Object.assign(where, {
      modelId: {
        [Op.eq]: modelId
      }
    });
  }

  if (groupModelId) {
    Object.assign(where, {
      groupModelId: {
        [Op.eq]: groupModelId
      }
    });
  }

  if (modelYearId) {
    Object.assign(where, {
      modelYearId: {
        [Op.eq]: modelYearId
      }
    });
  }

  return models.Car.findAll({
    where,
    order,
    offset,
    limit
  })
    .then(async data => {
      const count = await models.Car.count({ where });
      const pagination = paginator.paging(page, count, limit);

      res.json({
        success: true,
        pagination,
        data
      });
    })
    .catch(err =>
      res.status(422).json({
        success: false,
        errors: err.message
      })
    );
});

router.post('/checkCredential', async (req, res) => {
  const { email, phone } = req.body;

  if (!email) {
    return res.status(422).json({
      success: false,
      errors: 'email field must be filled'
    });
  }

  if (!phone) {
    return res.status(422).json({
      success: false,
      errors: 'phone field must be filled'
    });
  }

  const isEmail = await models.User.findOne({
    where: {
      email
    }
  }).catch(err => {
    return res.status(422).json({
      success: false,
      errors: err.message
    });
  });

  const isPhone = await models.User.findOne({
    where: {
      phone
    }
  }).catch(err => {
    return res.status(422).json({
      success: false,
      errors: err.message
    });
  });

  return res.json({
    success: true,
    isEmail,
    isPhone
  });
});

router.post('/login', async (req, res) => {
  const errors = {};
  const { email, password, phone } = req.body;
  let userType = '';

  if (email) {
    if (validator.isEmail(email ? email.toString() : '') === false) {
      return res.status(404).json({
        success: false,
        errors: 'Email is incorrect.'
      });
    }
  }
  if (!password) {
    return res.status(404).json({
      success: false,
      errors: 'Password is incorrect.'
    });
  }

  const data = await models.User.findOne({
    where: {
      [Op.or]: [
        {
          email: {
            [Op.iLike]: email
          }
        },
        { phone: { [Op.eq]: phone } }
      ],
      status: true
    }
  });
  if (!data) {
    return res.status(404).json({
      success: false,
      errors: 'Email/Phone is incorrect.'
    });
  }

  const isMatched = await bcrypt.compare(password, data.password);
  if (!isMatched) {
    return res.status(404).json({
      success: false,
      errors: 'Password is incorrect.'
    });
  }

  if (data.type === 0 && data.companyType === 0) {
    userType = 'Member';
  } else if (data.type === 0 && data.companyType === 1) {
    userType = 'Company';
  } else if (data.type === 1) {
    userType = 'Dealer';
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
      token: `Bearer ${token}`,
      userType
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
  // User Member Attribute
  const { modelYearId } = req.body;
  const { brand, bank, ccType, ccUsedFrom } = req.body;
  const { hStatus, surfaceArea, hUsedFrom } = req.body;
  let { isCar, isHome, isCard } = false;
  // Dealer Attribute
  const { productType, website, fax, authorizedBrandId } = req.body;
  const { authorizedWorkshop, otherWorkshop, sellAndBuy } = req.body;
  // Company Attribute , fileId (dealer & company)
  const { businessType, fileId } = req.body;

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
      [Op.or]: [
        {
          email: {
            [Op.eq]: email
          }
        },
        {
          phone: {
            [Op.eq]: phone
          }
        }
      ]
    }
  });
  if (dataUnique) {
    return res.status(400).json({
      success: false,
      errors: 'email/phone already exist'
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

  if (password !== confirmPassword) {
    return res.status(400).json({
      success: true,
      errors: 'password mismatch'
    });
  }

  if (type === '0' && companyType === '1') {
    const uniqueName = await models.User.findOne({
      where: {
        [Op.and]: [{ type: 0 }, { companyType: 1 }, { name }]
      }
    });
    if (uniqueName) {
      return res.status(422).json({
        success: false,
        errors: 'Company Name already exist'
      });
    }
  }

  if (type === '1') {
    const uniqueName = await models.User.findOne({
      where: {
        [Op.and]: [{ type: 1 }, { name }]
      }
    });
    if (uniqueName) {
      return res.status(422).json({
        success: false,
        errors: 'Dealer Name already exist'
      });
    }
  }

  const hashedPassword = await bcrypt.hashSync(password, 10);

  // member attrinute
  let carModel = [];
  let { cardBrand, cardType, cardBank, cardUsedFrom } = [];
  let { homeStatus, homeArea, homeUsedFrom } = [];

  if (type === '0' && companyType === '0') {
    // mapping car detail
    if (modelYearId) {
      carModel = general.mapping(modelYearId);
      isCar = true;
    }

    // mapping credit card detail
    if (brand && bank && ccType && ccUsedFrom) {
      cardBrand = general.mapping(brand);
      cardBank = general.mapping(bank);
      cardType = general.mapping(ccType);
      cardUsedFrom = general.mapping(ccUsedFrom);
      isCard = true;
    }

    // mapping home detail
    if (hStatus && surfaceArea && hUsedFrom) {
      homeStatus = general.mapping(hStatus);
      homeArea = general.mapping(surfaceArea);
      homeUsedFrom = general.mapping(hUsedFrom);
      isHome = true;
    }
  }

  const trans = await models.sequelize.transaction();
  const errors = [];

  const data = await models.User.create(
    {
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
    },
    {
      transaction: trans
    }
  ).catch(err => {
    trans.rollback();
    return res.status(422).json({
      success: false,
      errors: err.message
    });
  });

  if (type === '0' && companyType === '0') {
    if (isCar) {
      const car = [];
      for (let i = 0; i < carModel.length; i += 1) {
        car.push({ userId: data.id, modelYearId: carModel[i] });
      }

      await models.UserEndUserCarDetail.bulkCreate(car, { transaction: trans }).catch(err => {
        errors.push(err);
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

      await models.UserEndUserCreditCardDetail.bulkCreate(card, { transaction: trans }).catch(
        err => {
          errors.push(err);
        }
      );
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

      await models.UserEndUserHouseDetail.bulkCreate(home, { transaction: trans }).catch(err => {
        errors.push(err);
      });
    }
  }

  if (type === '0' && companyType === '1') {
    const company = await models.Company.create(
      {
        userId: data.id,
        website,
        fax,
        businessType
      },
      {
        transaction: trans
      }
    ).catch(err => {
      trans.rollback();
      return res.status(422).json({
        success: false,
        errors: err.message
      });
    });

    await Promise.all(
      fileId.map(async file => {
        await models.CompanyGallery.create(
          {
            companyId: company.id,
            fileId: file
          },
          {
            transaction: trans
          }
        ).catch(err => {
          errors.push(err);
        });
      })
    );
  }

  if (type === '1') {
    const dealer = await models.Dealer.create(
      {
        userId: data.id,
        productType,
        website,
        fax,
        authorizedBrandId
      },
      { transaction: trans }
    ).catch(err => {
      trans.rollback();
      return res.status(422).json({
        success: false,
        errors: err.message
      });
    });

    await Promise.all(
      fileId.map(async file => {
        await models.DealerGallery.create(
          {
            dealerId: dealer.id,
            fileId: file
          },
          {
            transaction: trans
          }
        ).catch(err => {
          errors.push(err);
        });
      })
    );

    if (authorizedWorkshop) {
      await Promise.all(
        authorizedWorkshop.map(async brandData => {
          await models.DealerWorkshopAuthorizedBrand.create(
            {
              dealerId: dealer.id,
              brandId: brandData
            },
            {
              transaction: trans
            }
          ).catch(err => {
            errors.push(err);
          });
        })
      );
    }
    if (otherWorkshop) {
      await Promise.all(
        otherWorkshop.map(async brandData => {
          await models.DealerWorkshopOtherBrand.create(
            {
              dealerId: dealer.id,
              brandId: brandData
            },
            {
              transaction: trans
            }
          ).catch(err => {
            errors.push(err);
          });
        })
      );
    }
    if (sellAndBuy) {
      await Promise.all(
        sellAndBuy.map(async brandData => {
          await models.DealerSellAndBuyBrand.create(
            {
              dealerId: dealer.id,
              brandId: brandData
            },
            {
              transaction: trans
            }
          ).catch(err => {
            errors.push(err);
          });
        })
      );
    }
  }

  if (errors.length > 0) {
    trans.rollback();
    return res.status(422).json({
      success: false,
      errors
    });
  }
  trans.commit();

  return res.json({
    success: true,
    data
  });
});

router.post('/unhandledRegister', async (req, res) => {
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
  // User Member Attribute
  const { modelYearId } = req.body;
  const { brand, bank, ccType, ccUsedFrom } = req.body;
  const { hStatus, surfaceArea, hUsedFrom } = req.body;
  let { isCar, isHome, isCard } = false;
  // Dealer Attribute
  const { productType, website, fax, authorizedBrandId } = req.body;
  const { authorizedWorkshop, otherWorkshop, sellAndBuy } = req.body;
  // Company Attribute , fileId (dealer & company)
  const { businessType, fileId } = req.body;

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
      [Op.or]: [
        {
          email: {
            [Op.eq]: email
          }
        },
        {
          phone: {
            [Op.eq]: phone
          }
        }
      ]
    }
  });
  if (dataUnique) {
    return res.status(400).json({
      success: false,
      errors: 'email/phone already exist'
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

  if (password !== confirmPassword) {
    return res.status(400).json({
      success: true,
      errors: 'password mismatch'
    });
  }

  const hashedPassword = await bcrypt.hashSync(password, 10);

  // member attribute
  let carModel = [];
  let { cardBrand, cardType, cardBank, cardUsedFrom } = [];
  let { homeStatus, homeArea, homeUsedFrom } = [];

  if (type === '0' && companyType === '0') {
    // mapping car detail
    if (modelYearId) {
      carModel = general.mapping(modelYearId);
      isCar = true;
    }

    // mapping credit card detail
    if (brand && bank && ccType && ccUsedFrom) {
      cardBrand = general.mapping(brand);
      cardBank = general.mapping(bank);
      cardType = general.mapping(ccType);
      cardUsedFrom = general.mapping(ccUsedFrom);
      isCard = true;
    }

    // mapping home detail
    if (hStatus && surfaceArea && hUsedFrom) {
      homeStatus = general.mapping(hStatus);
      homeArea = general.mapping(surfaceArea);
      homeUsedFrom = general.mapping(hUsedFrom);
      isHome = true;
    }
  }

  const trans = await models.sequelize.transaction();
  const errors = [];

  const data = await models.User.create(
    {
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
    },
    {
      transaction: trans
    }
  ).catch(err => {
    trans.rollback();
    return res.status(422).json({
      success: false,
      errors: err.message
    });
  });

  if (type === '0' && companyType === '0') {
    if (isCar) {
      const car = [];
      for (let i = 0; i < carModel.length; i += 1) {
        car.push({ userId: data.id, modelYearId: carModel[i] });
      }

      await models.UserEndUserCarDetail.bulkCreate(car, { transaction: trans }).catch(err => {
        errors.push(err);
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

      await models.UserEndUserCreditCardDetail.bulkCreate(card, { transaction: trans }).catch(
        err => {
          errors.push(err);
        }
      );
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

      await models.UserEndUserHouseDetail.bulkCreate(home, { transaction: trans }).catch(err => {
        errors.push(err);
      });
    }
  }

  if (type === '0' && companyType === '1') {
    const company = await models.Company.create(
      {
        userId: data.id,
        website,
        fax,
        businessType
      },
      {
        transaction: trans
      }
    ).catch(err => {
      trans.rollback();
      return res.status(422).json({
        success: false,
        errors: err.message
      });
    });

    await Promise.all(
      fileId.map(async file => {
        await models.CompanyGallery.create(
          {
            companyId: company.id,
            fileId: file
          },
          {
            transaction: trans
          }
        ).catch(err => {
          errors.push(err);
        });
      })
    );
  }

  if (type === '1') {
    const dealer = await models.Dealer.create(
      {
        userId: data.id,
        productType,
        website,
        fax,
        authorizedBrandId
      },
      { transaction: trans }
    ).catch(err => {
      trans.rollback();
      return res.status(422).json({
        success: false,
        errors: err.message
      });
    });

    await Promise.all(
      fileId.map(async file => {
        await models.DealerGallery.create(
          {
            dealerId: dealer.id,
            fileId: file
          },
          {
            transaction: trans
          }
        ).catch(err => {
          errors.push(err);
        });
      })
    );

    if (authorizedWorkshop) {
      await Promise.all(
        authorizedWorkshop.map(async brandData => {
          await models.DealerWorkshopAuthorizedBrand.create(
            {
              dealerId: dealer.id,
              brandId: brandData
            },
            {
              transaction: trans
            }
          ).catch(err => {
            errors.push(err);
          });
        })
      );
    }
    if (otherWorkshop) {
      await Promise.all(
        otherWorkshop.map(async brandData => {
          await models.DealerWorkshopOtherBrand.create(
            {
              dealerId: dealer.id,
              brandId: brandData
            },
            {
              transaction: trans
            }
          ).catch(err => {
            errors.push(err);
          });
        })
      );
    }
    if (sellAndBuy) {
      await Promise.all(
        sellAndBuy.map(async brandData => {
          await models.DealerSellAndBuyBrand.create(
            {
              dealerId: dealer.id,
              brandId: brandData
            },
            {
              transaction: trans
            }
          ).catch(err => {
            errors.push(err);
          });
        })
      );
    }
  }

  if (errors.length > 0) {
    trans.rollback();
    return res.status(422).json({
      success: false,
      errors
    });
  }
  trans.commit();

  return res.json({
    success: true,
    data
  });
});

router.put('/update', passport.authenticate('user', { session: false }), async (req, res) => {
  const { id } = req.user;

  const data = await models.User.findOne({
    where: {
      id
    }
  });
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
  // User Member Attribute
  const { modelYearId } = req.body;
  const { brand, bank, ccType, ccUsedFrom } = req.body;
  const { hStatus, surfaceArea, hUsedFrom } = req.body;
  let { isCar, isHome, isCard } = false;
  // Dealer Attribute
  const { productType, website, fax, authorizedBrandId } = req.body;
  const { authorizedWorkshop, otherWorkshop, sellAndBuy } = req.body;
  // Company Attribute , fileId (dealer & company)
  const { businessType, fileId } = req.body;

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

  if (password !== confirmPassword) {
    return res.status(400).json({
      success: true,
      errors: 'password mismatch'
    });
  }

  const hashedPassword = await bcrypt.hashSync(password, 10);

  // member attribute
  let carModel = [];
  let { cardBrand, cardType, cardBank, cardUsedFrom } = [];
  let { homeStatus, homeArea, homeUsedFrom } = [];

  if (type === '0' && companyType === '0') {
    // mapping car detail
    if (modelYearId) {
      carModel = general.mapping(modelYearId);
      isCar = true;
    }

    // mapping credit card detail
    if (brand && bank && ccType && ccUsedFrom) {
      cardBrand = general.mapping(brand);
      cardBank = general.mapping(bank);
      cardType = general.mapping(ccType);
      cardUsedFrom = general.mapping(ccUsedFrom);
      isCard = true;
    }

    // mapping home detail
    if (hStatus && surfaceArea && hUsedFrom) {
      homeStatus = general.mapping(hStatus);
      homeArea = general.mapping(surfaceArea);
      homeUsedFrom = general.mapping(hUsedFrom);
      isHome = true;
    }
  }

  const trans = await models.sequelize.transaction();
  const errors = [];

  await data
    .update(
      {
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
      },
      { transaction: trans }
    )
    .catch(err => {
      trans.rollback();
      return res.status(422).json({
        success: false,
        errors: err.message
      });
    });

  if (type === '0' && companyType === '0') {
    if (isCar) {
      const car = [];
      for (let i = 0; i < carModel.length; i += 1) {
        car.push({ userId: data.id, modelYearId: carModel[i] });
      }

      await models.UserEndUserCarDetail.bulkCreate(car, { transaction: trans }).catch(err => {
        errors.push(err);
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

      await models.UserEndUserCreditCardDetail.bulkCreate(card, { transaction: trans }).catch(
        err => {
          errors.push(err);
        }
      );
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

      await models.UserEndUserHouseDetail.bulkCreate(home, { transaction: trans }).catch(err => {
        errors.push(err);
      });
    }
  }

  if (type === '0' && companyType === '1') {
    let company = await models.Company.findOne({
      where: {
        userId: data.id
      }
    });

    company = await models.Company.create(
      {
        userId: data.id,
        website,
        fax,
        businessType
      },
      {
        transaction: trans
      }
    ).catch(err => {
      errors.push(err);
    });

    await Promise.all(
      fileId.map(async file => {
        await models.CompanyGallery.create(
          {
            companyId: company.id,
            fileId: file
          },
          {
            transaction: trans
          }
        ).catch(err => {
          errors.push(err);
        });
      })
    );
  }

  if (type === '1') {
    let dealer = await models.Dealer.findOne({
      where: {
        userId: data.id
      }
    });

    dealer = await models.Dealer.update(
      {
        productType,
        website,
        fax,
        authorizedBrandId
      },
      { transaction: trans }
    ).catch(err => {
      errors.push(err);
    });

    await Promise.all(
      fileId.map(async file => {
        await models.DealerGallery.create(
          {
            dealerId: dealer.id,
            fileId: file
          },
          {
            transaction: trans
          }
        ).catch(err => {
          errors.push(err);
        });
      })
    );

    if (authorizedWorkshop) {
      await models.DealerWorkshopAuthorizedBrand.destroy(
        {
          where: {
            dealerId: dealer.id
          }
        },
        {
          transaction: trans
        }
      ).catch(err => {
        errors.push(err);
      });

      await Promise.all(
        authorizedWorkshop.map(async brandData => {
          await models.DealerWorkshopAuthorizedBrand.create(
            {
              dealerId: dealer.id,
              brandId: brandData
            },
            {
              transaction: trans
            }
          ).catch(err => {
            errors.push(err);
          });
        })
      );
    }
    if (otherWorkshop) {
      await models.DealerWorkshopOtherBrand.destroy(
        {
          where: {
            dealerId: dealer.id
          }
        },
        { transaction: trans }
      ).catch(err => {
        errors.push(err);
      });

      await Promise.all(
        otherWorkshop.map(async brandData => {
          await models.DealerWorkshopOtherBrand.create(
            {
              dealerId: dealer.id,
              brandId: brandData
            },
            {
              transaction: trans
            }
          ).catch(err => {
            errors.push(err);
          });
        })
      );
    }
    if (sellAndBuy) {
      await models.DealerSellAndBuyBrand.destroy(
        {
          where: {
            dealerId: dealer.id
          }
        },
        { transaction: trans }
      ).catch(err => {
        errors.push(err);
      });

      await Promise.all(
        sellAndBuy.map(async brandData => {
          await models.DealerSellAndBuyBrand.create(
            {
              dealerId: dealer.id,
              brandId: brandData
            },
            {
              transaction: trans
            }
          ).catch(err => {
            errors.push(err);
          });
        })
      );
    }
  }

  if (errors.length > 0) {
    trans.rollback();
    return res.status(422).json({
      success: false,
      errors
    });
  }
  trans.commit();

  return res.json({
    success: true,
    data
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
