const validator = require('validator');
const Sequelize = require('sequelize');
const models = require('../db/models');
const paginator = require('../helpers/paginator');

const { Op } = Sequelize;

const DEFAULT_LIMIT = process.env.DEFAULT_LIMIT || 10;
const MAX_LIMIT = process.env.MAX_LIMIT || 50;

async function bargainsList(req, res) {
  let { page, limit, sort, by } = req.query;
  const { userId, carId, bidType, negotiationType, expiredAt, paymentMethod, haveSeenCar, profileUser, readerId } = req.query;
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  // if (limit > MAX_LIMIT) limit = MAX_LIMIT; // FOR CHAT
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  if (!by) by = 'createdAt';
  const array = [
    'id',
    'userId',
    'carId',
    'bidAmount',
    'haveSeenCar',
    'paymentMethod',
    'expiredAt',
    'comment',
    'bidType',
    'negotiationType',
    'createdAt',
    'updatedAt'
  ];
  if (array.indexOf(by) < 0) by = 'id';

  if (sort !== 'desc') sort = 'asc';
  else sort = 'desc';

  const order = [[by, sort]];
  const where = {};
  const whereUser = {};

  if (carId) {
    Object.assign(where, {
      carId
    });
  }

  if (userId) {
    Object.assign(where, {
      userId
    });
  }

  if (bidType) {
    Object.assign(where, {
      bidType
    });
  }

  if (expiredAt) {
    Object.assign(where, {
      expiredAt: {
        [Op.lte]: expiredAt
      }
    });
  }

  if (negotiationType) {
    Object.assign(where, {
      negotiationType
    });
  }

  if (paymentMethod) {
    Object.assign(where, {
      paymentMethod
    });
  }

  if (haveSeenCar) {
    Object.assign(where, {
      haveSeenCar
    });
  }

  if (profileUser == 'End User') {
    Object.assign(whereUser, {
      [Op.or]: [
        { type: 0, companyType: 0 },
        { type: 0, companyType: 1 }
      ]
    });
  }

  if (profileUser == 'Dealer') {
    Object.assign(whereUser, {
      [Op.or]: [
        { type: 1, companyType: 0 },
        { type: 1, companyType: 1 }
      ]
    });
  }

  return models.Bargain.findAll({
    attributes: {
      include: [
        [
          models.sequelize.literal(`(EXISTS(SELECT "b"."id" 
            FROM "Bargains" b 
            WHERE "b"."carId" = "Bargain"."carId" 
              AND "b"."bidderId" = "Bargain"."userId"
              AND "b"."bidType" = 1
              AND "b"."negotiationType" NOT IN (3, 4)
              AND "b"."expiredAt" >= (SELECT NOW())
              AND "b"."deletedAt" IS NULL))`
          ), 
          'isNego'
        ],
        [
          models.sequelize.literal(`(EXISTS(SELECT "r"."id" 
            FROM "BargainReaders" r 
            WHERE "r"."bargainId" = "Bargain"."id" 
              AND "r"."carId" = "Bargain"."carId"
              AND "r"."userId" = "Bargain"."userId"
              AND "r"."type" = 4
              AND "r"."isRead" = TRUE
              AND "r"."deletedAt" IS NULL))`
          ), 
          'isRead'
        ]
      ]
    },
    include: [
      {
        model: models.User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'phone', 'type', 'companyType', 'address'],
        where: whereUser,
        include: [
          {
            model: models.File,
            as: 'file',
            attributes: {
              exclude: ['createdAt', 'updatedAt', 'deletedAt']
            }
          }
        ]
      },
      {
        model: models.Car,
        as: 'car',
        attributes: {
          include: [
            [
              models.sequelize.literal(
                '(SELECT COUNT("Likes"."id") FROM "Likes" WHERE "Likes"."carId" = "car"."id" AND "Likes"."status" IS TRUE AND "Likes"."deletedAt" IS NULL)'
              ),
              'like'
            ],
            [
              models.sequelize.literal(
                '(SELECT COUNT("Views"."id") FROM "Views" WHERE "Views"."carId" = "car"."id" AND "Views"."deletedAt" IS NULL)'
              ),
              'view'
            ]
          ]
        },
        include: [
          {
            model: models.User,
            as: 'user',
            attributes: ['id', 'name', 'email', 'phone', 'type', 'companyType', 'address'],
            include: [
              {
                model: models.File,
                as: 'file',
                attributes: {
                  exclude: ['createdAt', 'updatedAt', 'deletedAt']
                }
              }
            ]
          },
          {
            model: models.ModelYear,
            as: 'modelYear',
            attributes: ['id', 'year', 'modelId']
          },
          {
            model: models.Brand,
            as: 'brand',
            attributes: ['id', 'name', 'logo', 'status']
          },
          {
            model: models.Model,
            as: 'model',
            attributes: ['id', 'name', 'groupModelId']
          },
          {
            model: models.GroupModel,
            as: 'groupModel',
            attributes: ['id', 'name', 'brandId']
          },
          {
            model: models.ExteriorGalery,
            as: 'exteriorGalery',
            attributes: ['id', 'fileId', 'carId'],
            include: [
              {
                model: models.File,
                as: 'file',
                attributes: {
                  exclude: ['createdAt', 'updatedAt', 'deletedAt']
                }
              }
            ]
          }
        ]
      }
    ],
    subQuery: false,
    where,
    order,
    offset,
    limit
  })
    .then(async data => {
      const findAndCount = await models.Bargain.findAndCountAll({ 
        attributes: {
          include: [
            [
              models.sequelize.literal(`(EXISTS(SELECT "b"."id" 
                FROM "Bargains" b 
                WHERE "b"."carId" = "Bargain"."carId" 
                  AND "b"."bidderId" = "Bargain"."userId"
                  AND "b"."bidType" = 1
                  AND "b"."negotiationType" NOT IN (3, 4)
                  AND "b"."expiredAt" >= (SELECT NOW())
                  AND "b"."deletedAt" IS NULL))`
              ), 
              'isNego'
            ]
          ]
        },
        include: [
          {
            model: models.User,
            as: 'user',
            where: whereUser
          },
          {
            model: models.Car,
            as: 'car'
          }
        ],
        where
      });

      let isNego = false;
      let bidderName = '';
      findAndCount.rows.map(item => {
        if(item.dataValues.isNego) {
          isNego = true;
          bidderName = item.dataValues.user.name;
        }
      });

      const count = findAndCount.count;
      const pagination = paginator.paging(page, count, limit);

      if(readerId && readerId !== '') {
        await Promise.all(
          data.map(async item => {
            const findBargainReader = await models.BargainReader.findOne({
              where: {
                userId: readerId,
                bargainId: item.id
              }
            });

            if(!findBargainReader) {
              await models.BargainReader.create({
                userId: readerId,
                bargainId: item.id,
                carId: item.carId,
                type: 4,
                isRead: true
              })
                .catch(err => {
                  res.status(422).json({
                    success: false,
                    errors: 'failed to read bargain chat'
                  });
                });
            }
          })
        );
      }

      res.json({
        success: true,
        pagination,
        data: {
          isNego,
          bidderName,
          bidderList: data
        }
      });
    })
    .catch(err => {
      res.status(422).json({
        success: false,
        errors: err.message
      });
    });
}

async function getSellNego(req, res) {
  const { id } = req.user;
  const {
    groupModelId,
    modelId,
    brandId,
    condition,
    modelYearId,
    minPrice,
    maxPrice,
    minYear,
    maxYear,
    negotiationType,
    by
  } = req.query;
  let { page, limit, sort } = req.query;
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  let order = [
    ['createdAt', 'desc'],
    [{ model: models.Bargain, as: 'bargain' }, 'id', 'desc']
  ];

  if (!sort) sort = 'asc';
  else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';

  if (by === 'price' || by === 'id') order = [[by, sort]];

  const whereBargain = {
    bidType: 1
  };

  const where = {
    userId: {
      [Op.eq]: id
    }
  };

  if (negotiationType == '0') {
    Object.assign(whereBargain, {
      negotiationType: {
        [Op.eq]: negotiationType
      }
    });

    // so that it doesn't appear on the "jual->nego->ajak nego" page
    // when the data is already on the "jual->nego->sedang nego" page
    Object.assign(where, {
      [Op.and]: [
           models.sequelize.literal(`(SELECT COUNT("Bargains"."id") 
            FROM "Bargains" 
            WHERE "Bargains"."carId" = "Car"."id" 
              AND "Bargains"."negotiationType" IN (1, 2, 4, 5, 6)
              AND "Bargains"."deletedAt" IS NULL
            ) = 0`
          )
      ]
    });
  } else if (negotiationType == '1') {
    Object.assign(whereBargain, {
      negotiationType: {
        [Op.in]: [1, 2, 4, 5, 6]
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

  if (groupModelId) {
    Object.assign(where, {
      groupModelId: {
        [Op.eq]: groupModelId
      }
    });
  }

  if (condition) {
    Object.assign(where, {
      condition: {
        [Op.eq]: condition
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

  if (brandId) {
    Object.assign(where, {
      brandId: {
        [Op.eq]: brandId
      }
    });
  }

  if (minPrice && maxPrice) {
    Object.assign(where, {
      price: {
        [Op.and]: [{ [Op.gte]: minPrice }, { [Op.lte]: maxPrice }]
      }
    });
  } else if (minPrice) {
    Object.assign(where, {
      price: {
        [Op.gte]: minPrice
      }
    });
  } else if (maxPrice) {
    Object.assign(where, {
      price: {
        [Op.lte]: maxPrice
      }
    });
  }

  const whereYear = {};
  if (minYear && maxYear) {
    Object.assign(whereYear, {
      year: {
        [Op.and]: [{ [Op.gte]: minYear }, { [Op.lte]: maxYear }]
      }
    });
  } else if (minYear) {
    Object.assign(whereYear, {
      year: {
        [Op.gte]: minYear
      }
    });
  } else if (maxYear) {
    Object.assign(whereYear, {
      year: {
        [Op.lte]: maxYear
      }
    });
  }

  return models.Car.findAll({
    attributes: {
      include: [
        [
          models.sequelize.literal(
            `(SELECT COUNT("Likes"."id") 
              FROM "Likes" 
              WHERE "Likes"."carId" = "Car"."id" 
                AND "Likes"."status" IS TRUE 
                AND "Likes"."deletedAt" IS NULL
            )`
          ),
          'like'
        ],
        [
          models.sequelize.literal(
            `(SELECT COUNT("Views"."id") 
              FROM "Views" 
              WHERE "Views"."carId" = "Car"."id" 
                AND "Views"."deletedAt" IS NULL
            )`
          ),
          'view'
        ]
      ]
    },
    include: [
      {
        model: models.ModelYear,
        as: 'modelYear',
        attributes: ['id', 'year', 'modelId'],
        where: whereYear
      },
      {
        model: models.Brand,
        as: 'brand',
        attributes: ['id', 'name', 'logo', 'status']
      },
      {
        model: models.Model,
        as: 'model',
        attributes: ['id', 'name', 'groupModelId']
      },
      {
        model: models.GroupModel,
        as: 'groupModel',
        attributes: ['id', 'name', 'brandId']
      },
      {
        model: models.Color,
        as: 'interiorColor',
        attributes: ['id', 'name', 'hex']
      },
      {
        model: models.Color,
        as: 'exteriorColor',
        attributes: ['id', 'name', 'hex']
      },
      {
        model: models.MeetingSchedule,
        as: 'meetingSchedule',
        attributes: ['id', 'carId', 'day', 'startTime', 'endTime']
      },
      {
        model: models.InteriorGalery,
        as: 'interiorGalery',
        attributes: ['id', 'fileId', 'carId'],
        include: [
          {
            model: models.File,
            as: 'file',
            attributes: {
              exclude: ['createdAt', 'updatedAt', 'deletedAt']
            }
          }
        ]
      },
      {
        model: models.ExteriorGalery,
        as: 'exteriorGalery',
        attributes: ['id', 'fileId', 'carId'],
        include: [
          {
            model: models.File,
            as: 'file',
            attributes: {
              exclude: ['createdAt', 'updatedAt', 'deletedAt']
            }
          }
        ]
      },
      {
        model: models.User,
        as: 'user',
        attributes: {
          exclude: ['password', 'createdAt', 'updatedAt', 'deletedAt']
        },
        include: [
          {
            model: models.File,
            as: 'file',
            attributes: {
              exclude: ['createdAt', 'updatedAt', 'deletedAt']
            }
          }
        ]
      },
      {
        model: models.Bargain,
        as: 'bargain',
        where: whereBargain,
        attributes: {
          exclude: ['updatedAt', 'deletedAt']
        },
        include: [
          {
            model: models.User,
            as: 'user',
            attributes: {
              exclude: ['password', 'createdAt', 'updatedAt', 'deletedAt']
            },
            include: [
              {
                model: models.File,
                as: 'file',
                attributes: {
                  exclude: ['createdAt', 'updatedAt', 'deletedAt']
                }
              }
            ]
          }
        ]
      },
      {
        model: models.Room,
        attributes: {
          exclude: ['createdAt', 'updatedAt', 'deletedAt']
        },
        as: 'room',
        include: [
          {
            required: true,
            model: models.RoomMember,
            attributes: {
              exclude: ['createdAt', 'updatedAt', 'deletedAt']
            },
            as: 'members',
            where: {
              userId: {
                [Op.ne]: id
              }
            },
            include: [
              {
                model: models.User,
                attributes: {
                  exclude: ['password', 'deletedAt']
                },
                as: 'member',
                include: [
                  {
                    model: models.File,
                    as: 'file',
                    attributes: {
                      exclude: ['type', 'createdAt', 'updatedAt', 'deletedAt']
                    }
                  }
                ]
              }
            ]
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
      const count = await models.Car.count({
        distinct: true,
        include: [
          {
            model: models.ModelYear,
            as: 'modelYear',
            where: whereYear
          },
          {
            model: models.Bargain,
            as: 'bargain',
            where: whereBargain
          },
          {
            model: models.Room,
            as: 'room',
            where: models.sequelize.where(
              models.sequelize.literal(
                `(SELECT COUNT( "RoomMembers"."id" ) 
                	FROM "RoomMembers" 
                	WHERE "RoomMembers"."roomId" = "room"."id" 
                		AND "RoomMembers"."userId" <> ${id}
                	)`
              ),
              { [Op.gt]: 0 }
            )
          }
        ],
        where
      });
      const pagination = paginator.paging(page, count, limit);

      await Promise.all(
        data.map(async item => {
          if (negotiationType == 0) {
            // item.dataValues.statusNego = 'Ajak Nego';
            item.dataValues.statusNego = 'Tunggu Jawaban';
            item.dataValues.isRead = true;
          } else if (negotiationType == 1) {
            const dataBargain = item.dataValues.bargain;
            const userIdLastBargain = dataBargain.length ? dataBargain[0].userId : null;

            if (dataBargain.length == 0 || (dataBargain.length && userIdLastBargain == id)) {
              item.dataValues.statusNego = 'Tunggu Jawaban';
              item.dataValues.isRead = true;
            } else if (dataBargain.length && userIdLastBargain != id) {
              item.dataValues.statusNego = 'Jawaban Anda Ditunggu';
              item.dataValues.isRead = false;
            }

            if(dataBargain.length && dataBargain[0].negotiationType == 4) {
              item.dataValues.statusNego = 'Nego Berhasil';
              item.dataValues.isRead = true;
            }
          }
        })
      );

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

async function getBuyNego(req, res) {
  const { id } = req.user;
  const {
    groupModelId,
    modelId,
    brandId,
    condition,
    modelYearId,
    minPrice,
    maxPrice,
    minYear,
    maxYear,
    negotiationType,
    by
  } = req.query;

  let { page, limit, sort } = req.query;
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  let order = [
    ['createdAt', 'desc'],
    [{ model: models.Bargain, as: 'bargain' }, 'id', 'desc']
  ];

  if (!sort) sort = 'asc';
  else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';

  if (by === 'price' || by === 'id') order = [[by, sort]];

  const whereBargain = {
    bidType: 1
  };

  const where = {
    userId: {
      [Op.ne]: id
    }
  };

  if (negotiationType == '0') {
    Object.assign(whereBargain, {
      [Op.or]: [{ negotiationType: { [Op.is]: null } }, { negotiationType }]
    });

    // so that it doesn't appear on the "beli->nego->diajak nego" page
    // when the data is already on the "beli->nego->sedang nego" page
    Object.assign(where, {
      [Op.and]: [
           models.sequelize.literal(`(SELECT COUNT("Bargains"."id") 
            FROM "Bargains" 
            WHERE "Bargains"."carId" = "Car"."id" 
              AND "Bargains"."negotiationType" IN (1, 2, 4, 5, 6)
              AND "Bargains"."deletedAt" IS NULL
            ) = 0`
          )
      ]
    });
  } else if (negotiationType == '1') {
    Object.assign(whereBargain, {
      negotiationType: {
        [Op.in]: [1, 2, 4, 5, 6]
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

  if (groupModelId) {
    Object.assign(where, {
      groupModelId: {
        [Op.eq]: groupModelId
      }
    });
  }

  if (condition) {
    Object.assign(where, {
      condition: {
        [Op.eq]: condition
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

  if (brandId) {
    Object.assign(where, {
      brandId: {
        [Op.eq]: brandId
      }
    });
  }

  if (minPrice && maxPrice) {
    Object.assign(where, {
      price: {
        [Op.and]: [{ [Op.gte]: minPrice }, { [Op.lte]: maxPrice }]
      }
    });
  } else if (minPrice) {
    Object.assign(where, {
      price: {
        [Op.gte]: minPrice
      }
    });
  } else if (maxPrice) {
    Object.assign(where, {
      price: {
        [Op.lte]: maxPrice
      }
    });
  }

  const whereYear = {};
  if (minYear && maxYear) {
    Object.assign(whereYear, {
      year: {
        [Op.and]: [{ [Op.gte]: minYear }, { [Op.lte]: maxYear }]
      }
    });
  } else if (minYear) {
    Object.assign(whereYear, {
      year: {
        [Op.gte]: minYear
      }
    });
  } else if (maxYear) {
    Object.assign(whereYear, {
      year: {
        [Op.lte]: maxYear
      }
    });
  }

  return models.Car.findAll({
    attributes: {
      include: [
        [
          models.sequelize.literal(
            `(SELECT COUNT("Likes"."id") 
              FROM "Likes" 
              WHERE "Likes"."carId" = "Car"."id" 
                AND "Likes"."status" IS TRUE 
                AND "Likes"."deletedAt" IS NULL
            )`
          ),
          'like'
        ],
        [
          models.sequelize.literal(
            `(SELECT COUNT("Views"."id") 
              FROM "Views" 
              WHERE "Views"."carId" = "Car"."id" 
                AND "Views"."deletedAt" IS NULL
            )`
          ),
          'view'
        ]
      ]
    },
    include: [
      {
        model: models.ModelYear,
        as: 'modelYear',
        attributes: ['id', 'year', 'modelId'],
        where: whereYear
      },
      {
        model: models.Brand,
        as: 'brand',
        attributes: ['id', 'name', 'logo', 'status']
      },
      {
        model: models.Model,
        as: 'model',
        attributes: ['id', 'name', 'groupModelId']
      },
      {
        model: models.GroupModel,
        as: 'groupModel',
        attributes: ['id', 'name', 'brandId']
      },
      {
        model: models.Color,
        as: 'interiorColor',
        attributes: ['id', 'name', 'hex']
      },
      {
        model: models.Color,
        as: 'exteriorColor',
        attributes: ['id', 'name', 'hex']
      },
      {
        model: models.MeetingSchedule,
        as: 'meetingSchedule',
        attributes: ['id', 'carId', 'day', 'startTime', 'endTime']
      },
      {
        model: models.InteriorGalery,
        as: 'interiorGalery',
        attributes: ['id', 'fileId', 'carId'],
        include: [
          {
            model: models.File,
            as: 'file',
            attributes: {
              exclude: ['createdAt', 'updatedAt', 'deletedAt']
            }
          }
        ]
      },
      {
        model: models.ExteriorGalery,
        as: 'exteriorGalery',
        attributes: ['id', 'fileId', 'carId'],
        include: [
          {
            model: models.File,
            as: 'file',
            attributes: {
              exclude: ['createdAt', 'updatedAt', 'deletedAt']
            }
          }
        ]
      },
      {
        model: models.User,
        as: 'user',
        attributes: {
          exclude: ['password', 'createdAt', 'updatedAt', 'deletedAt']
        },
        include: [
          {
            model: models.File,
            as: 'file',
            attributes: {
              exclude: ['createdAt', 'updatedAt', 'deletedAt']
            }
          }
        ]
      },
      {
        model: models.Bargain,
        as: 'bargain',
        required: true,
        where: whereBargain,
        attributes: {
          exclude: ['updatedAt', 'deletedAt']
        },
        include: [
          {
            model: models.User,
            as: 'user',
            attributes: {
              exclude: ['password', 'createdAt', 'updatedAt', 'deletedAt']
            },
            include: [
              {
                model: models.File,
                as: 'file',
                attributes: {
                  exclude: ['createdAt', 'updatedAt', 'deletedAt']
                }
              }
            ]
          }
        ]
      },
      {
        model: models.Room,
        attributes: {
          exclude: ['createdAt', 'updatedAt', 'deletedAt']
        },
        as: 'room',
        include: [
          {
            model: models.RoomMember,
            attributes: {
              exclude: ['createdAt', 'updatedAt', 'deletedAt']
            },
            as: 'members',
            where: {
              userId: id
            },
            include: [
              {
                model: models.User,
                attributes: {
                  exclude: ['password', 'deletedAt']
                },
                as: 'member',
                include: [
                  {
                    model: models.File,
                    as: 'file',
                    attributes: {
                      exclude: ['type', 'createdAt', 'updatedAt', 'deletedAt']
                    }
                  }
                ]
              }
            ]
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
      const count = await models.Car.count({
        distinct: true,
        include: [
          {
            model: models.ModelYear,
            as: 'modelYear',
            where: whereYear
          },
          {
            model: models.Bargain,
            as: 'bargain',
            required: true,
            where: whereBargain
          },
          {
            model: models.Room,
            as: 'room',
            where: models.sequelize.where(
              models.sequelize.literal(
                `(SELECT COUNT( "RoomMembers"."id" ) 
                	FROM "RoomMembers" 
                	WHERE "RoomMembers"."roomId" = "room"."id" 
                		AND "RoomMembers"."userId" = ${id}
                	)`
              ),
              { [Op.gt]: 0 }
            )
          }
        ],
        where
      });

      const pagination = paginator.paging(page, count, limit);

      await Promise.all(
        data.map(async item => {
          if (negotiationType == 0) {
            // item.dataValues.statusNego = 'Diajak Nego';
            item.dataValues.statusNego = 'Jawaban Anda Ditunggu';
            item.dataValues.isRead = false;
          } else if (negotiationType == 1) {
            const dataBargain = item.dataValues.bargain;
            const userIdLastBargain = dataBargain.length ? dataBargain[0].userId : null;            

            if (dataBargain.length == 0 || (dataBargain.length > 0 && userIdLastBargain == id)) {
              item.dataValues.statusNego = 'Tunggu Jawaban';
              item.dataValues.isRead = true;
            } else if (dataBargain.length > 0 && userIdLastBargain != id) {
              item.dataValues.statusNego = 'Jawaban Anda Ditunggu';
              item.dataValues.isRead = false;
            }

            if(dataBargain.length && dataBargain[0].negotiationType == 4) {
              item.dataValues.statusNego = 'Nego Berhasil';
              item.dataValues.isRead = true;
            }
          }
        })
      );

      res.json({
        success: true,
        pagination,
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
}

module.exports = {
  bargainsList,
  getSellNego,
  getBuyNego
};
