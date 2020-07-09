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

  return models.User.findOne({
    include: [
      {
        model: models.File,
        as: 'file',
        attributes: {
          exclude: ['createdAt', 'updatedAt', 'deletedAt']
        }
      },
      {
        model: models.Dealer,
        as: 'dealer',
        attributes: {
          exclude: ['createdAt', 'updatedAt', 'deletedAt']
        }
      },
      {
        model: models.Company,
        as: 'company',
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

router.get('/seller/:id', passport.authenticate('user', { session: false }), async (req, res) => {
  const { id } = req.params;

  return models.User.findByPk(id, {
    attributes: {
      exclude: ['createdAt', 'updatedAt', 'deletedAt', 'password'],
      include: [
        [
          models.sequelize.literal(
            '(SELECT "website" FROM "Dealers" WHERE "Dealers"."userId" = "User"."id")'
          ),
          'website'
        ],
        [
          models.sequelize.literal(
            `(CASE 
              WHEN "User"."type" = 0 AND "companyType" = 0 THEN 'End User' 
              WHEN "User"."type" = 0 AND "companyType" = 1 THEN 'Company'
              WHEN "User"."type" = 1 AND "companyType" = 0 THEN 'Dealer'
            END)`
          ),
          'sellerType'
        ]
      ]
    }
  })
    .then(data => {
      res.json({
        success: true,
        data
      });
    })
    .catch(err => {
      console.log(err);
      res.status(422).json({
        success: false,
        errors: err.message
      });
    });
});

router.get('/token', passport.authenticate('user', { session: false }), async (req, res) => {
  const { id } = req.user;

  return models.User.findOne({
    include: [
      {
        model: models.File,
        as: 'file',
        attributes: {
          exclude: ['createdAt', 'updatedAt', 'deletedAt']
        }
      },
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

  let isEmail;
  let isPhone;

  if (email) {
    isEmail = await models.User.findOne({
      where: {
        email
      }
    }).catch(err => {
      res.status(422).json({
        success: false,
        errors: err.message
      });
    });
  }

  if (phone) {
    isPhone = await models.User.findOne({
      where: {
        phone
      }
    }).catch(err =>
      res.status(422).json({
        success: false,
        errors: err.message
      })
    );
  }

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

  // if (data.type == 0 && data.companyType == 0) {
  //   userType = 'Member';
  // } else if (data.type == 0 && data.companyType == 1) {
  //   userType = 'Company';
  // } else if (data.type == 1) {
  //   userType = 'Dealer';
  // }

  if (data.type == 0 && data.companyType == 0) userType = 'End User';
  else if (data.type == 0 && data.companyType == 1) userType = 'End User';
  else if (data.type == 1 && data.companyType == 0) userType = 'Dealer';
  else if (data.type == 1 && data.companyType == 1) userType = 'Dealer';
  else userType = 'unknown';

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
      userType,
      type: data.type,
      companyType: data.companyType
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
    status,
    cityId,
    subdistrictId
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

  if (typeof type === 'undefined') {
    return res.status(400).json({
      success: false,
      errors: 'type is mandatory'
    });
  }

  if (typeof companyType === 'undefined') {
    return res.status(400).json({
      success: false,
      errors: 'companyType is mandatory'
    });
  }

  if (!cityId) {
    return res.status(400).json({
      success: false,
      errors: 'cityId is mandatory'
    });
  }

  if (!subdistrictId) {
    return res.status(400).json({
      success: false,
      errors: 'subdistrictId is mandatory'
    });
  }

  if(cityId && subdistrictId) {
    const getCity = await models.City.findByPk(cityId);
    if(!getCity) {
      return res.status(400).json({
        success: false,
        errors: 'city not found'
      });
    } else {
      const getSubdistrict = await models.SubDistrict.findOne({
        where: {
          id: subdistrictId,
          cityId
        }
      });

      if(!getSubdistrict) {
        return res.status(400).json({
          success: false,
          errors: 'subdistrict not found'
        });
      }
    }
  }

  if (validator.isEmail(email ? email.toString() : '') === false) {
    return res.status(400).json({
      success: false,
      errors: 'invalid email'
    });
  }

  const dataUnique = await models.User.findOne({
    where: {
      [Op.or]: [ { email }, { phone: phone.toString() } ]
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

  // if (validator.isBoolean(status ? status.toString() : '') === false) {
  if (!typeof status === "boolean") {
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

  if (type == 0 && companyType == 1) {
    const uniqueName = await models.User.findOne({
      where: {
        type,
        companyType,
        name
      }
    });

    if (uniqueName) {
      return res.status(422).json({
        success: false,
        errors: 'Company Name already exist'
      });
    }
  }

  if (type == 1) {
    const uniqueName = await models.User.findOne({
      where: {
        type,
        name
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

  if (type == 0 && companyType == 0) {
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
      status,
      cityId,
      subdistrictId
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

  if (type == 0 && companyType == 0) {
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

  if (type == 0 && companyType == 1) {
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

    if (fileId && fileId.length) {
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
  }

  if (type == 1) {
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

    if (fileId && fileId.length) {
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
    }

    if (authorizedWorkshop && authorizedWorkshop.length) {
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

    if (otherWorkshop && otherWorkshop.length) {
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

    if (sellAndBuy && sellAndBuy.length) {
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

  if (typeof type === 'undefined') {
    return res.status(400).json({
      success: false,
      errors: 'type is mandatory'
    });
  }

  if (typeof companyType === 'undefined') {
    return res.status(400).json({
      success: false,
      errors: 'companyType is mandatory'
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

  if (type == 0 && companyType == 0) {
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

  if (type == 0 && companyType == 0) {
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

  if (type == 0 && companyType == 1) {
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

    if (fileId) {
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
  }

  if (type == 1) {
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

    if (fileId) {
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
    }

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
      status,
      cityId,
      subdistrictId
    } = req.body;

    // User Member Attribute
    const { carId, modelYearId } = req.body;
    const { cardId, brand, bank, ccType, ccUsedFrom } = req.body;
    const { houseId, hStatus, surfaceArea, hUsedFrom } = req.body;
    let { isCar, isHome, isCard } = false;
    // Dealer Attribute
    const { productType, website, fax, authorizedBrandId } = req.body;
    const { authorizedWorkshop, otherWorkshop, sellAndBuy } = req.body;
    // Company Attribute , fileId (dealer & company)
    const { businessType, fileId } = req.body;

    if (email) {
      if (validator.isEmail(email ? email.toString() : '') === false) {
        return res.status(400).json({
          success: false,
          errors: 'invalid email'
        });
      }
    }

    if (phone) {
      if (validator.isMobilePhone(phone ? phone.toString() : '') === false) {
        return res.status(400).json({
          success: false,
          errors: 'invalid phone'
        });
      }
    }

    if (status) {
      if (validator.isBoolean(status ? status.toString() : '') === false) {
        return res.status(400).json({
          success: false,
          errors: 'status must be boolean'
        });
      }
    }

    if(cityId && subdistrictId) {
      const getCity = await models.City.findByPk(cityId);
      if(!getCity) {
        return res.status(400).json({
          success: false,
          errors: 'city not found'
        });
      } else {
        const getSubdistrict = await models.SubDistrict.findOne({
          where: {
            id: subdistrictId,
            cityId
          }
        });

        if(!getSubdistrict) {
          return res.status(400).json({
            success: false,
            errors: 'subdistrict not found'
          });
        }
      }
    }

    // let hashedPassword = await bcrypt.hashSync(data.password, 10);
    let hashedPassword = data.password;
    if (password && confirmPassword) {
      if (password !== confirmPassword) {
        return res.status(400).json({
          success: true,
          errors: 'password mismatch'
        });
      }
      hashedPassword = await bcrypt.hashSync(password, 10);
    }

    // member attribute
    let { userEndUserCarId, carModel } = [];
    let { userEndUserCardId, cardBrand, cardType, cardBank, cardUsedFrom } = [];
    let { userEndUserHouseId, homeStatus, homeArea, homeUsedFrom } = [];

    if (type == 0 && companyType == 0) {
      // mapping car detail
      if (carId && modelYearId) {
        userEndUserCarId = general.mapping(carId);
        carModel = general.mapping(modelYearId);
        isCar = true;
      }

      // mapping credit card detail
      if (cardId && brand && bank && ccType && ccUsedFrom) {
        userEndUserCardId = general.mapping(cardId);
        cardBrand = general.mapping(brand);
        cardBank = general.mapping(bank);
        cardType = general.mapping(ccType);
        cardUsedFrom = general.mapping(ccUsedFrom);
        isCard = true;
      }

      // mapping home detail
      if (houseId && hStatus && surfaceArea && hUsedFrom) {
        userEndUserHouseId = general.mapping(houseId);
        homeStatus = general.mapping(hStatus);
        homeArea = general.mapping(surfaceArea);
        homeUsedFrom = general.mapping(hUsedFrom);
        isHome = true;
      }
    }

    // Get Company
    async function getCompanyById() {
      return await models.Company.findOne({
        where: {
          userId: id
        }
      });
    }

    // Get Dealer
    async function getDealerById() {
      return await models.Dealer.findOne({
        where: {
          userId: id
        }
      });
    }

    const trans = await models.sequelize.transaction();
    const errors = [];

    await data
      .update(
        {
          phone: phone || data.phone,
          email: email || data.email,
          emailValidAt: moment.now(),
          name: name || data.name,
          password: hashedPassword,
          type,
          companyType,
          profileImageId,
          address,
          status,
          cityId,
          subdistrictId
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

    if (type == 0 && companyType == 0) {
      if (isCar) {
        const car = [];
        for (let i = 0; i < carModel.length; i += 1) {
          car.push({
            id: userEndUserCarId[i],
            userId: data.id,
            modelYearId: carModel[i]
          });
        }

        await Promise.all(
          car.map(async item => {
            if (item.id) {
              await models.UserEndUserCarDetail.update(item, {
                where: {
                  id: item.id
                },
                transaction: trans
              }).catch(err => {
                errors.push(err);
              });
            } else {
              const checkModelyearExist = await models.UserEndUserCarDetail.findOne({
                where: {
                  userId: item.userId,
                  modelYearId: item.modelYearId
                },
                transaction: trans
              })

              if(checkModelyearExist) {
                trans.rollback();
                return res.status(400).json({
                  success: false,
                  errors: 'Modelyear already exists'
                });
              }

              await models.UserEndUserCarDetail.create(item, {
                transaction: trans
              }).catch(err => {
                errors.push(err);
              });
            }
          })
        );
      }

      if (isCard) {
        const card = [];

        for (let j = 0; j < cardBank.length; j += 1) {
          card.push({
            id: userEndUserCardId[j],
            userId: data.id,
            brand: cardBrand[j],
            bank: cardBank[j],
            type: cardType[j],
            usedFrom: cardUsedFrom[j]
          });
        }

        await Promise.all(
          card.map(async item => {
            if (item.id) {
              await models.UserEndUserCreditCardDetail.update(item, {
                where: {
                  id: item.id
                },
                transaction: trans
              }).catch(err => {
                errors.push(err);
              });
            } else {
              await models.UserEndUserCreditCardDetail.create(item, {
                transaction: trans
              }).catch(err => {
                errors.push(err);
              });
            }
          })
        );
      }

      if (isHome) {
        const home = [];
        for (let k = 0; k < homeArea.length; k += 1) {
          home.push({
            id: userEndUserHouseId[k],
            userId: data.id,
            status: homeStatus[k],
            surfaceArea: homeArea[k],
            usedFrom: homeUsedFrom[k]
          });
        }

        await Promise.all(
          home.map(async item => {
            if (item.id) {
              await models.UserEndUserHouseDetail.update(item, {
                where: {
                  id: item.id
                },
                transaction: trans
              }).catch(err => {
                errors.push(err);
              });
            } else {
              await models.UserEndUserHouseDetail.create(item, {
                transaction: trans
              }).catch(err => {
                errors.push(err);
              });
            }
          })
        );
      }
    }

    if (type == 0 && companyType == 1) {
      getCompanyById()
        .then(company => {
          (async trans => {
            await models.Company.create(
              {
                userId: id,
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
          })().then(result => {
            (async trans => {
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
            })();
          });
        })
        .catch(err => {
          trans.rollback();
          errors.push(err);
        });
    }

    if (type == 1) {
      getDealerById()
        .then(dealer => {
          (async trans => {
            await models.Dealer.update(
              {
                productType,
                website,
                fax,
                authorizedBrandId
              },
              {
                where: {
                  id: dealer.id
                }
              },
              {
                transaction: trans
              }
            ).catch(err => {
              console.log(err);
              errors.push(err);
            });
          })().then(result => {
            (async trans => {
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
            })();
          });

          if (authorizedWorkshop) {
            (async trans => {
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
            })();
          }
          if (otherWorkshop) {
            (async trans => {
              await models.DealerWorkshopOtherBrand.destroy(
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
            })();
          }
          if (sellAndBuy) {
            (async trans => {
              await models.DealerSellAndBuyBrand.destroy(
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
            })();
          }
        })
        .catch(err => {
          trans.rollback();
          errors.push(err);
        });
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
  }
);

router.delete('/firebase', passport.authenticate('user', { session: false }), async (req, res) => {
  const userId = req.user.id;
  const tokenExists = await models.UserToken.findAll({
    where: { userId }
  });

  if (tokenExists.length <= 0)
    return res.status(400).json({ success: false, errors: 'token not found' });

  tokenExists.map(async tokenExist => {
    await tokenExist.destroy();
  });

  return res.status(200).json({ success: true, message: `token deleted` });
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

router.post(
  '/changePassword',
  passport.authenticate('user', { session: false }),
  async (req, res) => {
    const { id } = req.user;
    const data = await models.User.findByPk(id);
    if (!data) {
      return res.status(400).json({
        success: false,
        errors: 'Invalid parameter'
      });
    }

    // Check Old Password
    const { oldPassword, password, confirmPassword } = req.body;
    const compareOldPassword = await bcrypt.compare(oldPassword, data.password);
    if (!compareOldPassword) {
      return res.status(400).json({
        success: false,
        errors: 'Maaf password Anda salah!'
      });
    }

    // Hash password with bcrypt
    let hashedPassword = data.password;
    if (password) {
      hashedPassword = await new Promise((resolve, reject) => {
        bcrypt.genSalt(10, (error, salt) => {
          bcrypt.hash(password, salt, (errorHash, hashedPass) => {
            if (errorHash) reject(errorHash);
            resolve(hashedPass);
          });
        });
      });
    }

    // Check confirmPassword with hashedPassword
    const comparePassword = await bcrypt.compare(confirmPassword, hashedPassword);
    if (!comparePassword) {
      return res.status(400).json({
        success: false,
        errors: 'Konfirmasi password Anda salah!'
      });
    }

    return data
      .update({
        password: hashedPassword
      })
      .then(() => {
        res.json({
          success: true,
          message: 'Selamat, password Anda berhasil diganti.'
        });
      })
      .catch(err => {
        res.status(422).json({
          success: false,
          errors: 'Something wrong!!',
          backend: err.message
        });
      });
  }
);

router.post('/firebase', passport.authenticate('user', { session: false }), async (req, res) => {
  const { token, type, version } = req.body;
  const userId = req.user.id;

  if (!token) return res.status(400).json({ success: false, errors: 'Invalid token' });
  if (!type) return res.status(400).json({ success: false, errors: 'Invalid type' });
  if (type !== 'ios' && type !== 'android')
    return res.status(400).json({ success: false, errors: 'Invalid type' });

  const tokenExists = await models.UserToken.findOne({
    where: { userId, token, type }
  });

  if (tokenExists) return res.json({ success: true, data: tokenExists });

  // return res.status(200).json({ success: true, data: req.body });
  return models.UserToken.create({
    userId,
    token,
    type,
    version: version || null
  })
    .then(async data => {
      res.json({ success: true, data });
    })
    .catch(() => {
      res.status(422).json({ success: false, errors: 'Something wrong!!' });
    });
});

module.exports = router;
