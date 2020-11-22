const moment = require('moment');
const validator = require('validator');
const Sequelize = require('sequelize');
const models = require('../db/models');
const carHelper = require('../helpers/car');
const notification = require('../helpers/notification');
const paginator = require('../helpers/paginator');
const minio = require('../helpers/minio');

const { Op } = Sequelize;

const DEFAULT_LIMIT = process.env.DEFAULT_LIMIT || 10;
const MAX_LIMIT = process.env.MAX_LIMIT || 50;

const whereQueryBargain = (id, customWhere) => `(SELECT COUNT("bc"."id")
  FROM (SELECT * 
    FROM "Bargains"
    WHERE "Bargains"."deletedAt" IS NULL
        AND "Bargains"."carId" = "Car"."id"
    ORDER BY "Bargains"."createdAt" DESC
    LIMIT 1) AS bc
  WHERE "bc"."userId" <> ${id}
    ${customWhere}
    AND (SELECT COUNT("BargainReaders"."id") 
      FROM "BargainReaders" 
      WHERE "BargainReaders"."carId" = "Car"."id"
        AND "BargainReaders"."bargainId" = "bc"."id"
        AND "BargainReaders"."userId" = ${id}
        AND "BargainReaders"."deletedAt" IS NULL
    ) = 0
) > 0`;

async function bargainsList(req, res) {
  let { page, limit, sort, by } = req.query;
  const userLoginId = req.user.id;
  const {
    userId,
    carId,
    bidType,
    negotiationType,
    expiredAt,
    paymentMethod,
    haveSeenCar,
    profileUser,
    condition
  } = req.query;

  let offset = 0;
  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
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
  const whereCar = {};

  if (condition) {
    Object.assign(whereCar, {
      condition
    });
  }

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

  const customWhen = userLoginId
    ? `WHEN ((SELECT COUNT("b"."id")
      FROM "Bargains" b 
      WHERE "b"."carId" = "Bargain"."carId"
        AND "b"."bidType" = 1
        AND ("b"."negotiationType" = 7 AND "b"."userId" = ${userLoginId}
          OR "b"."negotiationType" IN (3,4)
        )
        AND "b"."deletedAt" IS NULL
      )) > 0
    THEN true`
    : ``;
  const include = [
    [
      models.sequelize.literal(`(EXISTS(SELECT "b"."id" 
        FROM "Bargains" b 
        WHERE "b"."carId" = "Bargain"."carId"
          AND "b"."bidType" = 1
          AND (SELECT COUNT("sb"."id")
            FROM "Bargains" sb
            WHERE "sb"."carId" = "Bargain"."carId"
              AND "sb"."bidType" = 1
              AND "sb"."negotiationType" IN (3,4,7)
              AND "sb"."deletedAt" IS NULL) = 0
          AND "b"."deletedAt" IS NULL))`),
      'isNego'
    ],
    [
      models.sequelize.literal(`(CASE ${customWhen} WHEN "expiredAt" >= now() THEN false
        ELSE true END)`),
      'isExpired'
    ]
  ];

  if (userLoginId) {
    include.push([
      models.sequelize.literal(`(CASE WHEN "Bargain"."userId" = ${userLoginId} THEN
        (EXISTS(SELECT "r"."id" 
          FROM "BargainReaders" r 
          WHERE "r"."bargainId" = "Bargain"."id" 
            AND "r"."carId" = "Bargain"."carId"
            AND "r"."userId" != ${userLoginId}
            -- AND "r"."type" = 4
            AND "r"."isRead" = TRUE
            AND "r"."deletedAt" IS NULL))
        ELSE true END)`),
      'isRead'
    ]);
  }

  if (bidType == 0) {
    Object.assign(where, {
      [Op.and]: [
        models.sequelize.literal(`(SELECT COUNT("b"."id") 
          FROM "Bargains" b
          WHERE "b"."carId" = "Bargain"."carId" 
            AND "b"."negotiationType" = 8
            AND "b"."deletedAt" IS NULL
          ) = 0`)
      ]
    });
  }

  const addAttribute = await carHelper.customFields({
    fields: ['like', 'view']
  });

  return models.Bargain.findAll({
    attributes: {
      include
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
        model: models.Room,
        required: true,
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
              userId: userLoginId
            }
          }
        ]
      },
      {
        model: models.Car,
        required: true,
        as: 'car',
        where: whereCar,
        attributes: Object.keys(models.Car.attributes).concat(addAttribute),
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
            model: models.City,
            as: 'city'
          },
          {
            model: models.SubDistrict,
            as: 'subdistrict'
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
          },
          // {
          //   model: models.Room,
          //   required: true,
          //   attributes: {
          //     exclude: ['createdAt', 'updatedAt', 'deletedAt']
          //   },
          //   as: 'room',
          //   include: [
          //     {
          //       model: models.RoomMember,
          //       attributes: {
          //         exclude: ['createdAt', 'updatedAt', 'deletedAt']
          //       },
          //       as: 'members',
          //       where: {
          //         userId: userLoginId
          //       }
          //     }
          //   ]
          // }
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
                  AND (SELECT COUNT("sb"."id")
                    FROM "Bargains" sb
                    WHERE "sb"."carId" = "Bargain"."carId"
                      AND "sb"."bidType" = 1
                      AND "sb"."negotiationType" IN (3,4,7)
                      AND "sb"."deletedAt" IS NULL) = 0
                  AND "b"."deletedAt" IS NULL))`),
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
            required: true,
            as: 'car',
            where: whereCar,
            include: [
              {
                model: models.Room,
                required: true,
                as: 'room',
                include: [
                  {
                    model: models.RoomMember,
                    as: 'members',
                    where: {
                      userId: userLoginId
                    }
                  }
                ]
              }
            ]
          }
        ],
        where
      });

      let isNego = false;
      let bidderName = '';
      findAndCount.rows.map(item => {
        if (item.dataValues.isNego) {
          isNego = true;
          bidderName = item.dataValues.user.name;
        }
      });

      const { count } = findAndCount;
      const pagination = paginator.paging(page, count, limit);

      if (userLoginId && userLoginId !== '') {
        await Promise.all(
          data.map(async item => {
            if (item.userId != userLoginId) {
              const findBargainReader = await models.BargainReader.findOne({
                where: {
                  userId: userLoginId,
                  bargainId: item.id
                }
              });

              if (!findBargainReader) {
                await models.BargainReader.create({
                  userId: userLoginId,
                  bargainId: item.id,
                  carId: item.carId,
                  isRead: true
                }).catch(err => {
                  res.status(422).json({
                    success: false,
                    errors: 'failed to read bargain chat'
                  });
                });
              }
            }
          })
        );
      }

      await Promise.all(
        data.map(async item => {
          if(item.user.file.url) {
            const url = await minio.getUrl(item.user.file.url).then(res => {
              return res;
            }).catch(err => {
              res.status(422).json({
                success: false,
                errors: err
              });
            });

            item.user.file.dataValues.fileUrl = url;
          } else {
            item.user.file.dataValues.fileUrl = null;
          }

          if(item.car.STNKphoto) {
            const url = await minio.getUrl(item.car.STNKphoto).then(res => {
              return res;
            }).catch(err => {
              res.status(422).json({
                success: false,
                errors: err
              });
            });

            item.car.dataValues.stnkUrl = url;
          } else {
            item.car.dataValues.stnkUrl = null;
          }

          if(item.car.user.file.url) {
            const url = await minio.getUrl(item.car.user.file.url).then(res => {
              return res;
            }).catch(err => {
              res.status(422).json({
                success: false,
                errors: err
              });
            });

            item.car.user.file.dataValues.fileUrl = url;
          } else {
            item.car.user.file.dataValues.fileUrl = null;
          }

          if(item.car.brand.logo) {
            const url = await minio.getUrl(item.car.brand.logo).then(res => {
              return res;
            }).catch(err => {
              res.status(422).json({
                success: false,
                errors: err
              });
            });

            item.car.brand.dataValues.logoUrl = url;
          } else {
            item.car.brand.dataValues.logoUrl = null;
          }

          await Promise.all(
            item.car.exteriorGalery.map(async itemExteriorGalery => {
              if(itemExteriorGalery.file.url) {
                const url = await minio.getUrl(itemExteriorGalery.file.url).then(res => {
                  return res;
                }).catch(err => {
                  res.status(422).json({
                    success: false,
                    errors: err
                  });
                });

                itemExteriorGalery.file.dataValues.fileUrl = url;
              } else {
                itemExteriorGalery.file.dataValues.fileUrl = null;
              }
            })
          );
        })
      );

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

async function bargainsListBidder(req, res) {
  let { page, limit, sort, by } = req.query;
  const {
    userId,
    carId,
    bidType,
    negotiationType,
    expiredAt,
    paymentMethod,
    haveSeenCar,
    profileUser,
    condition
  } = req.query;

  let offset = 0;
  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
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
  const whereCar = {};

  if (condition) {
    Object.assign(whereCar, {
      condition
    });
  }

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

  const customWhen = `WHEN ((SELECT COUNT("b"."id")
      FROM "Bargains" b 
      WHERE "b"."carId" = "Bargain"."carId"
        AND "b"."bidType" = 1
        AND ("b"."negotiationType" = 7
          OR "b"."negotiationType" IN (3,4)
        )
        AND "b"."deletedAt" IS NULL
      )) > 0
    THEN true`;
  const include = [
    [
      models.sequelize.literal(`(EXISTS(SELECT "b"."id" 
        FROM "Bargains" b 
        WHERE "b"."carId" = "Bargain"."carId"
          AND "b"."bidType" = 1
          AND (SELECT COUNT("sb"."id")
            FROM "Bargains" sb
            WHERE "sb"."carId" = "Bargain"."carId"
              AND "sb"."bidType" = 1
              AND "sb"."negotiationType" IN (3,4,7)
              AND "sb"."deletedAt" IS NULL) = 0
          AND "b"."deletedAt" IS NULL))`),
      'isNego'
    ],
    [
      models.sequelize.literal(`(CASE ${customWhen} WHEN "expiredAt" >= now() THEN false
        ELSE true END)`),
      'isExpired'
    ]
  ];

  if (bidType == 0) {
    Object.assign(where, {
      [Op.and]: [
        models.sequelize.literal(`(SELECT COUNT("b"."id") 
          FROM "Bargains" b
          WHERE "b"."carId" = "Bargain"."carId" 
            AND "b"."negotiationType" IN (4,7,8)
            AND "b"."deletedAt" IS NULL
          ) = 0`)
      ]
    });
  }

  const addAttribute = await carHelper.customFields({
    fields: ['like', 'view']
  });

  return models.Bargain.findAll({
    attributes: {
      include
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
        model: models.Room,
        required: true,
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
            as: 'members'
          }
        ]
      },
      {
        model: models.Car,
        required: true,
        as: 'car',
        where: whereCar,
        attributes: Object.keys(models.Car.attributes).concat(addAttribute),
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
            model: models.City,
            as: 'city'
          },
          {
            model: models.SubDistrict,
            as: 'subdistrict'
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
          },
          // {
          //   model: models.Room,
          //   required: true,
          //   attributes: {
          //     exclude: ['createdAt', 'updatedAt', 'deletedAt']
          //   },
          //   as: 'room',
          //   include: [
          //     {
          //       model: models.RoomMember,
          //       attributes: {
          //         exclude: ['createdAt', 'updatedAt', 'deletedAt']
          //       },
          //       as: 'members'
          //     }
          //   ]
          // }
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
                  AND (SELECT COUNT("sb"."id")
                    FROM "Bargains" sb
                    WHERE "sb"."carId" = "Bargain"."carId"
                      AND "sb"."bidType" = 1
                      AND "sb"."negotiationType" IN (3,4,7)
                      AND "sb"."deletedAt" IS NULL) = 0
                  AND "b"."deletedAt" IS NULL))`),
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
            as: 'car',
            where: whereCar
          }
        ],
        where
      });

      let isNego = false;
      let bidderName = '';
      findAndCount.rows.map(item => {
        if (item.dataValues.isNego) {
          isNego = true;
          bidderName = item.dataValues.user.name;
        }
      });

      const { count } = findAndCount;
      const pagination = paginator.paging(page, count, limit);

      await Promise.all(
        data.map(async item => {
          if(item.user.file.url) {
            const url = await minio.getUrl(item.user.file.url).then(res => {
              return res;
            }).catch(err => {
              res.status(422).json({
                success: false,
                errors: err
              });
            });

            item.user.file.dataValues.fileUrl = url;
          } else {
            item.user.file.dataValues.fileUrl = null;
          }

          if(item.car.STNKphoto) {
            const url = await minio.getUrl(item.car.STNKphoto).then(res => {
              return res;
            }).catch(err => {
              res.status(422).json({
                success: false,
                errors: err
              });
            });

            item.car.dataValues.stnkUrl = url;
          } else {
            item.car.dataValues.stnkUrl = null;
          }

          if(item.car.user.file.url) {
            const url = await minio.getUrl(item.car.user.file.url).then(res => {
              return res;
            }).catch(err => {
              res.status(422).json({
                success: false,
                errors: err
              });
            });

            item.car.user.file.dataValues.fileUrl = url;
          } else {
            item.car.user.file.dataValues.fileUrl = null;
          }

          if(item.car.brand.logo) {
            const url = await minio.getUrl(item.car.brand.logo).then(res => {
              return res;
            }).catch(err => {
              res.status(422).json({
                success: false,
                errors: err
              });
            });

            item.car.brand.dataValues.logoUrl = url;
          } else {
            item.car.brand.dataValues.logoUrl = null;
          }

          await Promise.all(
            item.car.exteriorGalery.map(async itemExteriorGalery => {
              if(itemExteriorGalery.file.url) {
                const url = await minio.getUrl(itemExteriorGalery.file.url).then(res => {
                  return res;
                }).catch(err => {
                  res.status(422).json({
                    success: false,
                    errors: err
                  });
                });

                itemExteriorGalery.file.dataValues.fileUrl = url;
              } else {
                itemExteriorGalery.file.dataValues.fileUrl = null;
              }
            })
          );
        })
      );

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
  if (parseInt(limit) > MAX_LIMIT) limit = MAX_LIMIT;
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

  let customWhere = '';
  const whereBargainCheckNegotiationType = {};
  const whereBargainCheckPurchase = {};
  let having;
  if (negotiationType == '0') {
    Object.assign(whereBargain, {
      negotiationType
    });

    // so that it doesn't appear on the "jual->nego->ajak nego" page
    // when the data is already on the "jual->nego->sedang nego" page
    Object.assign(whereBargainCheckNegotiationType, {
      negotiationType: {
        [Op.gt]: 0
      }
    });

    having = models.sequelize.literal('COUNT("bargainCheckNegotiationType"."id") = 0');
    customWhere = 'AND "bc"."bidType" = 1 AND "bc"."negotiationType" = 0';
  } else if (negotiationType == '1') {
    Object.assign(whereBargain, {
      negotiationType: {
        [Op.in]: [1, 2, 3, 4, 5, 6]
      }
    });

    // so that it doesn't appear on the "jual->nego->sedang nego" page
    // // when the data have 3/4/7/8 negotiationType
    Object.assign(whereBargainCheckNegotiationType, {
      [Op.and]: {
        [Op.or]: {
          negotiationType: {
            [Op.in]: [7, 8]
          },
          [Op.and]: [
            {
              negotiationType: 3,
              userId: id
            }
          ]
        }
      }
    });

    Object.assign(whereBargainCheckPurchase, {
      [Op.and]: {
        negotiationType: 4
      }
    });

    having = models.sequelize.literal(`
      COUNT("bargainCheckNegotiationType"."id") = 0 
        AND COUNT("bargainCheckPurchase"."id") = 0
    `);

    customWhere = `AND "bc"."bidType" = 1 
      AND "bc"."negotiationType" NOT IN (0,4,7,8)`;
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
        ],
        [models.sequelize.literal(whereQueryBargain(id, customWhere)), 'isRead']
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
        model: models.City,
        as: 'city'
      },
      {
        model: models.SubDistrict,
        as: 'subdistrict'
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
        as: 'bargainCheckNegotiationType',
        where: whereBargainCheckNegotiationType,
        required: false,
        attributes: []
      },
      {
        model: models.Bargain,
        as: 'bargainCheckPurchase',
        where: whereBargainCheckPurchase,
        required: false,
        attributes: [],
        includes: [
          {
            model: models.Purchase,
            as: 'purchase',
            required: true,
            where: {
              isAcceptSeller: true
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
    subQuery: false,
    group: [
      'Car.id',
      'bargainCheckNegotiationType.id',
      'modelYear.id',
      'city.id',
      'subdistrict.id',
      'brand.id',
      'model.id',
      'groupModel.id',
      'interiorColor.id',
      'exteriorColor.id',
      'meetingSchedule.id',
      'interiorGalery.id',
      'interiorGalery->file.id',
      'exteriorGalery.id',
      'exteriorGalery->file.id',
      'user.id',
      'user->file.id',
      'bargain.id',
      'bargain->user.id',
      'bargain->user->file.id',
      'room.id',
      'room->members.id',
      'room->members->member.id',
      'room->members->member->file.id'
    ],
    where,
    order,
    offset,
    limit,
    having
  })
    .then(async data => {
      let count = await models.Car.count({
        subQuery: false,
        distinct: true,
        group: ['"Car"."id"'],
        having,
        where,
        include: [
          {
            model: models.ModelYear,
            as: 'modelYear',
            where: whereYear,
            attributes: []
          },
          {
            model: models.Bargain,
            as: 'bargainCheckNegotiationType',
            where: whereBargainCheckNegotiationType,
            required: false,
            attributes: []
          },
          {
            model: models.Bargain,
            as: 'bargainCheckPurchase',
            where: whereBargainCheckPurchase,
            required: false,
            attributes: [],
            includes: [
              {
                model: models.Purchase,
                as: 'purchase',
                required: true,
                where: {
                  isAcceptSeller: true
                }
              }
            ]
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
        ]
      });

      count = count.reduce((a, b) => +a + +b.count, 0);

      const pagination = paginator.paging(page, count, limit);
      await Promise.all(
        data.map(async item => {
          const dataBargain = item.dataValues.bargain;
          const userIdLastBargain = dataBargain.length ? dataBargain[0].userId : null;

          if (negotiationType == 0) {
            item.dataValues.statusNego = 'Tunggu Jawaban';
            if (
              dataBargain.length &&
              moment.utc(dataBargain[0].expiredAt).format('YYYY-MM-DD HH:mm:ss') <
                moment()
                  .tz('Asia/Jakarta')
                  .format('YYYY-MM-DD HH:mm:ss')
            ) {
              item.dataValues.statusNego = 'Waktu Habis';
            }
          } else if (negotiationType == 1) {
            if (dataBargain.length == 0 || (dataBargain.length && userIdLastBargain == id)) {
              item.dataValues.statusNego = 'Tunggu Jawaban';
            } else if (dataBargain.length && userIdLastBargain != id) {
              item.dataValues.statusNego = 'Jawaban Anda Ditunggu';
            }

            if (
              dataBargain.length &&
              moment.utc(dataBargain[0].expiredAt).format('YYYY-MM-DD HH:mm:ss') <
                moment()
                  .tz('Asia/Jakarta')
                  .format('YYYY-MM-DD HH:mm:ss') &&
              [1, 2, 5, 6].includes(dataBargain[0].negotiationType)
            ) {
              item.dataValues.statusNego = 'Waktu Habis';
            }

            if (dataBargain.length && dataBargain[0].negotiationType == 4) {
              item.dataValues.statusNego = 'Nego Berhasil';
            }

            if (
              dataBargain.length &&
              dataBargain[0].negotiationType == 3 &&
              dataBargain[0].userId != id
            ) {
              item.dataValues.statusNego = 'Pembeli Keluar Nego';
            }
          }
        })
      );

      await Promise.all(
        data.map(async item => {
          if(item.user.file.url) {
            const url = await minio.getUrl(item.user.file.url).then(res => {
              return res;
            }).catch(err => {
              res.status(422).json({
                success: false,
                errors: err
              });
            });

            item.user.file.dataValues.fileUrl = url;
          } else {
            item.user.file.dataValues.fileUrl = null;
          }

          if(item.STNKphoto) {
            const url = await minio.getUrl(item.STNKphoto).then(res => {
              return res;
            }).catch(err => {
              res.status(422).json({
                success: false,
                errors: err
              });
            });

            item.dataValues.stnkUrl = url;
          } else {
            item.dataValues.stnkUrl = null;
          }

          if(item.brand.logo) {
            const url = await minio.getUrl(item.brand.logo).then(res => {
              return res;
            }).catch(err => {
              res.status(422).json({
                success: false,
                errors: err
              });
            });

            item.brand.dataValues.logoUrl = url;
          } else {
            item.brand.dataValues.logoUrl = null;
          }

          await Promise.all(
            item.interiorGalery.map(async itemInteriorGalery => {
              if(itemInteriorGalery.file.url) {
                const url = await minio.getUrl(itemInteriorGalery.file.url).then(res => {
                  return res;
                }).catch(err => {
                  res.status(422).json({
                    success: false,
                    errors: err
                  });
                });

                itemInteriorGalery.file.dataValues.fileUrl = url;
              } else {
                itemInteriorGalery.file.dataValues.fileUrl = null;
              }
            }),

            item.exteriorGalery.map(async itemExteriorGalery => {
              if(itemExteriorGalery.file.url) {
                const url = await minio.getUrl(itemExteriorGalery.file.url).then(res => {
                  return res;
                }).catch(err => {
                  res.status(422).json({
                    success: false,
                    errors: err
                  });
                });

                itemExteriorGalery.file.dataValues.fileUrl = url;
              } else {
                itemExteriorGalery.file.dataValues.fileUrl = null;
              }
            }),

            item.bargain.map(async itemBargain => {
              if(itemBargain.user.file.url) {
                const url = await minio.getUrl(itemBargain.user.file.url).then(res => {
                  return res;
                }).catch(err => {
                  res.status(422).json({
                    success: false,
                    errors: err
                  });
                });

                itemBargain.user.file.dataValues.fileUrl = url;
              } else {
                itemBargain.user.file.dataValues.fileUrl = null;
              }
            })
          );

          if(item.room) {
            await Promise.all(
              item.room.members.map(async itemMember => {
                if(itemMember.member.file.url) {
                  const url = await minio.getUrl(itemMember.member.file.url).then(res => {
                    return res;
                  }).catch(err => {
                    res.status(422).json({
                      success: false,
                      errors: err
                    });
                  });

                  itemMember.member.file.dataValues.fileUrl = url;
                } else {
                  itemMember.member.file.dataValues.fileUrl = null;
                }
              })
            );
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
  if (parseInt(limit) > MAX_LIMIT) limit = MAX_LIMIT;
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

  let customWhere = '';
  const whereBargainCheckNegotiationType = {};
  const whereBargainCheckPurchase = {};
  let having;
  if (negotiationType == '0') {
    Object.assign(whereBargain, {
      [Op.or]: [{ negotiationType: { [Op.is]: null } }, { negotiationType }]
    });

    // so that it doesn't appear on the "beli->nego->diajak nego" page
    // when the data is already on the "beli->nego->sedang nego" page
    Object.assign(whereBargainCheckNegotiationType, {
      negotiationType: {
        [Op.gt]: 0
      }
    });

    having = models.sequelize.literal('COUNT("bargainCheckNegotiationType"."id") = 0');
    customWhere = 'AND "bc"."bidType" = 1 AND "bc"."negotiationType" = 0';
  } else if (negotiationType == '1') {
    Object.assign(whereBargain, {
      negotiationType: {
        [Op.in]: [1, 2, 3, 4, 5, 6]
      }
    });

    // so that it doesn't appear on the "jual->nego->sedang nego" page
    // when the data have 3/4/7/8 negotiationType
    Object.assign(whereBargainCheckNegotiationType, {
      [Op.and]: {
        [Op.or]: {
          negotiationType: {
            [Op.in]: [7, 8]
          },
          [Op.and]: [
            {
              negotiationType: 3,
              userId: id
            }
          ]
        }
      }
    });

    Object.assign(whereBargainCheckPurchase, {
      [Op.and]: {
        negotiationType: 4
      }
    });

    having = models.sequelize.literal(`
      COUNT("bargainCheckNegotiationType"."id") = 0 
        AND COUNT("bargainCheckPurchase"."id") = 0
    `);

    customWhere = `AND "bc"."bidType" = 1 
      AND "bc"."negotiationType" NOT IN (0,4,7,8)`;
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
        ],
        [models.sequelize.literal(whereQueryBargain(id, customWhere)), 'isRead']
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
        model: models.City,
        as: 'city'
      },
      {
        model: models.SubDistrict,
        as: 'subdistrict'
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
        as: 'bargainCheckNegotiationType',
        where: whereBargainCheckNegotiationType,
        required: false,
        attributes: []
      },
      {
        model: models.Bargain,
        as: 'bargainCheckPurchase',
        where: whereBargainCheckPurchase,
        required: false,
        attributes: [],
        includes: [
          {
            model: models.Purchase,
            as: 'purchase',
            required: true,
            where: {
              isAcceptBuyer: true
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
    subQuery: false,
    group: [
      'Car.id',
      'bargainCheckNegotiationType.id',
      'modelYear.id',
      'city.id',
      'subdistrict.id',
      'brand.id',
      'model.id',
      'groupModel.id',
      'interiorColor.id',
      'exteriorColor.id',
      'meetingSchedule.id',
      'interiorGalery.id',
      'interiorGalery->file.id',
      'exteriorGalery.id',
      'exteriorGalery->file.id',
      'user.id',
      'user->file.id',
      'bargain.id',
      'bargain->user.id',
      'bargain->user->file.id',
      'room.id',
      'room->members.id',
      'room->members->member.id',
      'room->members->member->file.id'
    ],
    where,
    order,
    offset,
    limit,
    having
  })
    .then(async data => {
      let count = await models.Car.count({
        subQuery: false,
        distinct: true,
        group: ['"Car"."id"'],
        having,
        where,
        include: [
          {
            model: models.ModelYear,
            as: 'modelYear',
            where: whereYear,
            attributes: []
          },
          {
            model: models.Bargain,
            as: 'bargainCheckNegotiationType',
            where: whereBargainCheckNegotiationType,
            required: false,
            attributes: []
          },
          {
            model: models.Bargain,
            as: 'bargainCheckPurchase',
            where: whereBargainCheckPurchase,
            required: false,
            attributes: [],
            includes: [
              {
                model: models.Purchase,
                as: 'purchase',
                required: true,
                where: {
                  isAcceptBuyer: true
                }
              }
            ]
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
        ]
      });

      count = count.reduce((a, b) => +a + +b.count, 0);

      const pagination = paginator.paging(page, count, limit);
      await Promise.all(
        data.map(async item => {
          const dataBargain = item.dataValues.bargain;
          const userIdLastBargain = dataBargain.length ? dataBargain[0].userId : null;

          if (negotiationType == 0) {
            item.dataValues.statusNego = 'Jawaban Anda Ditunggu';
            if (
              dataBargain.length &&
              moment.utc(dataBargain[0].expiredAt).format('YYYY-MM-DD HH:mm:ss') <
                moment()
                  .tz('Asia/Jakarta')
                  .format('YYYY-MM-DD HH:mm:ss')
            ) {
              item.dataValues.statusNego = 'Waktu Habis';
            }
          } else if (negotiationType == 1) {
            if (dataBargain.length == 0 || (dataBargain.length > 0 && userIdLastBargain == id)) {
              item.dataValues.statusNego = 'Tunggu Jawaban';
            } else if (dataBargain.length > 0 && userIdLastBargain != id) {
              item.dataValues.statusNego = 'Jawaban Anda Ditunggu';
            }

            if (
              dataBargain.length &&
              moment.utc(dataBargain[0].expiredAt).format('YYYY-MM-DD HH:mm:ss') <
                moment()
                  .tz('Asia/Jakarta')
                  .format('YYYY-MM-DD HH:mm:ss') &&
              [0, 1, 2, 5, 6].includes(dataBargain[0].negotiationType)
            ) {
              item.dataValues.statusNego = 'Waktu Habis';
            }

            if (dataBargain.length && dataBargain[0].negotiationType == 4) {
              item.dataValues.statusNego = 'Nego Berhasil';
            }

            if (
              dataBargain.length &&
              dataBargain[0].negotiationType == 3 &&
              dataBargain[0].userId != id
            ) {
              item.dataValues.statusNego = 'Penjual Keluar Nego';
            }
          }
        })
      );

      await Promise.all(
        data.map(async item => {
          if(item.user.file.url) {
            const url = await minio.getUrl(item.user.file.url).then(res => {
              return res;
            }).catch(err => {
              res.status(422).json({
                success: false,
                errors: err
              });
            });

            item.user.file.dataValues.fileUrl = url;
          } else {
            item.user.file.dataValues.fileUrl = null;
          }

          if(item.STNKphoto) {
            const url = await minio.getUrl(item.STNKphoto).then(res => {
              return res;
            }).catch(err => {
              res.status(422).json({
                success: false,
                errors: err
              });
            });

            item.dataValues.stnkUrl = url;
          } else {
            item.dataValues.stnkUrl = null;
          }

          if(item.brand.logo) {
            const url = await minio.getUrl(item.brand.logo).then(res => {
              return res;
            }).catch(err => {
              res.status(422).json({
                success: false,
                errors: err
              });
            });

            item.brand.dataValues.logoUrl = url;
          } else {
            item.brand.dataValues.logoUrl = null;
          }

          await Promise.all(
            item.interiorGalery.map(async itemInteriorGalery => {
              if(itemInteriorGalery.file.url) {
                const url = await minio.getUrl(itemInteriorGalery.file.url).then(res => {
                  return res;
                }).catch(err => {
                  res.status(422).json({
                    success: false,
                    errors: err
                  });
                });

                itemInteriorGalery.file.dataValues.fileUrl = url;
              } else {
                itemInteriorGalery.file.dataValues.fileUrl = null;
              }
            }),

            item.exteriorGalery.map(async itemExteriorGalery => {
              if(itemExteriorGalery.file.url) {
                const url = await minio.getUrl(itemExteriorGalery.file.url).then(res => {
                  return res;
                }).catch(err => {
                  res.status(422).json({
                    success: false,
                    errors: err
                  });
                });

                itemExteriorGalery.file.dataValues.fileUrl = url;
              } else {
                itemExteriorGalery.file.dataValues.fileUrl = null;
              }
            }),

            item.bargain.map(async itemBargain => {
              if(itemBargain.user.file.url) {
                const url = await minio.getUrl(itemBargain.user.file.url).then(res => {
                  return res;
                }).catch(err => {
                  res.status(422).json({
                    success: false,
                    errors: err
                  });
                });

                itemBargain.user.file.dataValues.fileUrl = url;
              } else {
                itemBargain.user.file.dataValues.fileUrl = null;
              }
            })
          );

          if(item.room) {
            await Promise.all(
              item.room.members.map(async itemMember => {
                if(itemMember.member.file.url) {
                  const url = await minio.getUrl(itemMember.member.file.url).then(res => {
                    return res;
                  }).catch(err => {
                    res.status(422).json({
                      success: false,
                      errors: err
                    });
                  });

                  itemMember.member.file.dataValues.fileUrl = url;
                } else {
                  itemMember.member.file.dataValues.fileUrl = null;
                }
              })
            );
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

async function bid(req, res) {
  const { userId, carId, bidAmount, haveSeenCar, paymentMethod, expiredAt } = req.body;

  if (!bidAmount) {
    return res.status(400).json({
      success: false,
      errors: 'bidAmount must be filled'
    });
  }

  if (!paymentMethod) {
    return res.status(400).json({
      success: false,
      errors: 'paymentMethod must be filled'
    });
  }

  if (!expiredAt) {
    return res.status(400).json({
      success: false,
      errors: 'expiredAt must be filled'
    });
  }

  if (!moment(expiredAt, 'YYYY-MM-DD HH:mm:ss', true).isValid()) {
    return res.status(400).json({
      success: false,
      errors: 'Invalid expired date'
    });
  }

  const checkIfUserHasBid = await models.Bargain.findAll({
    where: {
      carId,
      userId,
      expiredAt: {
        [Op.gte]: models.sequelize.literal('(SELECT NOW())')
      }
    }
  });

  if (checkIfUserHasBid.length) {
    return res.status(400).json({
      success: false,
      errors: 'You have bid this car'
    });
  }

  const carExists = await models.Car.findByPk(carId);
  if (!carExists) {
    return res.status(404).json({
      success: false,
      errors: 'car not found'
    });
  }

  if (carExists.userId == userId) {
    return res.status(400).json({
      success: false,
      errors: "You can't bid the car you sell"
    });
  }

  if (carExists.roomId) {
    const checkIfCarUnderNegotiate = await models.Bargain.findOne({
      where: {
        carId,
        roomId: carExists.roomId,
        expiredAt: {
          [Op.gte]: models.sequelize.literal('(SELECT NOW())')
        },
        bidType: 1
      }
    });

    if (checkIfCarUnderNegotiate) {
      return res.status(422).json({
        success: false,
        errors: `you can't bid this car, because someone under negotiation`
      });
    }
  }

  return models.Bargain.create({
    userId,
    carId,
    bidAmount,
    haveSeenCar,
    paymentMethod,
    expiredAt,
    bidType: 0
  })
    .then(async data => {
      const room = await models.Room.create();
      models.RoomMember.create({ roomId: room.id, userId: carExists.userId });
      models.RoomMember.create({ roomId: room.id, userId });
      await models.Bargain.update({ roomId: room.id }, { where: { id: data.id } });
      Object.assign(data, { roomId: room.id });
      // carExists.update({ roomId: room.id });

      const userNotif = {
        userId: carExists.userId,
        collapseKey: null,
        notificationTitle: `Notifikasi Jual`,
        notificationBody: `Penawaran Baru`,
        notificationClickAction: `carNegotiate`,
        dataReferenceId: carId,
        category: 1
        // status: 3
      };

      const emit = await notification.insertNotification(userNotif);
      req.io.emit(`tabJual-${carExists.userId}`, emit);
      notification.userNotif(userNotif);
      res.status(200).json({ success: true, data });
    })
    .catch(err => {
      res.status(422).json({
        success: false,
        errors: err.message
      });
    });
}

async function editBid(req, res) {
  const carId = req.params.id;
  const userId = req.user.id;
  const { bidAmount, haveSeenCar, paymentMethod } = req.body;

  if (!bidAmount) {
    return res.status(400).json({
      success: false,
      errors: 'bidAmount must be filled'
    });
  }

  if (!paymentMethod) {
    return res.status(400).json({
      success: false,
      errors: 'paymentMethod must be filled'
    });
  }

  const data = await models.Bargain.findOne({
    where: {
      carId,
      userId,
      bidType: 0,
      negotiationType: null
    }
  });

  if (!data)
    return res.status(400).json({
      success: false,
      errors: 'Transaksi not found'
    });

  return data
    .update({
      bidAmount,
      haveSeenCar,
      paymentMethod
    })
    .then(async data => {
      const carExists = await models.Car.findByPk(carId);
      const userNotif = {
        userId: carExists.userId,
        collapseKey: null,
        notificationTitle: `Notifikasi Jual`,
        notificationBody: `Penawaran Berubah`,
        notificationClickAction: `carOffer`,
        dataReferenceId: carId,
        category: 1
        // status: 4
      };

      const emit = await notification.insertNotification(userNotif);
      req.io.emit(`tabJual-${carExists.userId}`, emit);
      notification.userNotif(userNotif);

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

async function extend(req, res) {
  const { id } = req.params;
  const userId = req.user.id;
  const { expiredAt } = req.body;

  if (!expiredAt) {
    return res.status(400).json({
      success: false,
      errors: 'expiredAt must be filled'
    });
  }

  if (!moment(expiredAt, 'YYYY-MM-DD HH:mm:ss', true).isValid()) {
    return res.status(400).json({
      success: false,
      errors: 'Invalid expired date'
    });
  }

  const data = await models.Bargain.findByPk(id, {
    attributes: {
      include: [
        [
          models.sequelize.literal(`(EXISTS(SELECT "r"."id" 
            FROM "BargainReaders" r 
            WHERE "r"."bargainId" = "Bargain"."id" 
              AND "r"."carId" = "Bargain"."carId"
              AND "r"."userId" != ${userId}
              -- AND "r"."type" = 4
              AND "r"."isRead" = TRUE
              AND "r"."deletedAt" IS NULL))`),
          'isRead'
        ]
      ]
    },
    include: [
      {
        model: models.Car,
        as: 'car',
        required: true,
        include: [
          {
            model: models.Room,
            as: 'room',
            where: models.sequelize.where(
              models.sequelize.literal(
                `(SELECT COUNT( "RoomMembers"."id" ) 
                  FROM "RoomMembers" 
                  WHERE "RoomMembers"."roomId" = "car"."roomId" 
                    AND "RoomMembers"."userId" = ${userId}
                  )`
              ),
              { [Op.gt]: 0 }
            )
          }
        ]
      }
    ]
  });

  if (!data) {
    return res.status(400).json({
      success: false,
      errors: 'data not found or you are not the author of this data'
    });
  }

  if (data.isExtend) {
    return res.status(400).json({
      success: false,
      errors: 'You have already extended this data before'
    });
  }

  if (data.isRead) {
    return res.status(400).json({
      success: false,
      errors: 'The user reads the offer but is not replied'
    });
  }

  return data
    .update({
      expiredAt,
      isExtend: true
    })
    .then(async data => {
      const userNotif = {
        userId: data.userId,
        collapseKey: null,
        notificationTitle: 'Notifikasi Extend Waktu Penawaran',
        notificationBody: `Waktu penawaran diperpanjang sampai ${expiredAt}`,
        notificationClickAction: `carOffer`,
        dataReferenceId: data.carId,
        category: 5
        // category: 4,
        // status: 4
      };

      const emit = await notification.insertNotification(userNotif);
      req.io.emit(`extend-${data.carId}`, emit);
      notification.userNotif(userNotif);

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

async function negotiate(req, res) {
  const { id } = req.user;
  const {
    bidderId,
    carId,
    bidAmount,
    haveSeenCar,
    paymentMethod,
    negotiationType,
    comment,
    carPrice,
    expiredAt
  } = req.body;

  if (bidderId && validator.isInt(bidderId ? bidderId.toString() : '') === false) {
    return res.status(406).json({
      success: false,
      errors: 'type of bidderId must be int'
    });
  }

  if (validator.isInt(carId ? carId.toString() : '') === false) {
    return res.status(406).json({
      success: false,
      errors: 'type of carId must be int'
    });
  }

  if (validator.isInt(negotiationType ? negotiationType.toString() : '') === false) {
    return res.status(406).json({
      success: false,
      errors: 'type of negotiationType must be int'
    });
  }

  if (validator.isBoolean(haveSeenCar ? haveSeenCar.toString() : '') === false) {
    return res.status(406).json({
      success: false,
      errors: 'type of haveSeenCar must be boolean'
    });
  }

  if (!bidAmount) {
    return res.status(400).json({
      success: false,
      errors: 'bidAmount must be filled'
    });
  }

  if (!paymentMethod) {
    return res.status(400).json({
      success: false,
      errors: 'paymentMethod must be filled'
    });
  }

  if (!expiredAt) {
    return res.status(400).json({
      success: false,
      errors: 'expiredAt must be filled'
    });
  }

  if (!moment(expiredAt, 'YYYY-MM-DD HH:mm:ss', true).isValid()) {
    return res.status(400).json({
      success: false,
      errors: 'Invalid expired date'
    });
  }

  if (!carPrice) {
    return res.status(400).json({
      success: false,
      errors: 'carPrice must be filled'
    });
  }

  if (validator.isInt(carPrice ? carPrice.toString() : '') === false) {
    return res.status(406).json({
      success: false,
      errors: 'type of carPrice must be int'
    });
  }

  // update roomId in car first nego
  if(negotiationType == 0) {
    const car = await models.Car.findByPk(carId);
    const bid = await models.Bargain.findOne({
      where: {
        carId,
        userId: bidderId,
        bidType: 0
      }
    });

    if(!car) {
      return res.status(404).json({ 
        success: false, 
        errors: 'car not found' 
      });
    }

    if(!bid) {
      return res.status(404).json({ 
        success: false, 
        errors: 'data bid not found' 
      });
    }

    await car.update({ roomId: bid.roomId });
  }

  const findCarWithUserInRoom = await models.Car.findByPk(carId, {
    include: [
      {
        model: models.Room,
        as: 'room',
        where: models.sequelize.where(
          models.sequelize.literal(
            `(SELECT COUNT( "RoomMembers"."id" ) 
                FROM "RoomMembers" 
                WHERE "RoomMembers"."roomId" = "Car"."roomId" 
                  AND "RoomMembers"."userId" = ${id}
            )`
          ),
          { [Op.gt]: 0 }
        ),
        include: [
          {
            required: false,
            model: models.RoomMember,
            as: 'members',
            where: {
              userId: {
                [Op.ne]: id
              }
            }
          }
        ]
      }
    ]
  });

  const include = [];
  let carExists;
  if (negotiationType == 4) {
    const checkHaveRoom = await models.Car.findByPk(carId);
    if (checkHaveRoom.roomId) {
      carExists = findCarWithUserInRoom;
    } else {
      carExists = checkHaveRoom;
      if (!bidderId) {
        return res.status(404).json({
          success: false,
          errors: 'please input bidderId'
        });
      }
    }
  } else {
    carExists = findCarWithUserInRoom;
  }

  if (!carExists) {
    return res.status(404).json({
      success: false,
      errors: 'car not found'
    });
  }

  // saat pembeli yang nego, dia masuk tab mana
  const userNotifs = [];
  const customerFromRoom =
    carExists.room.members[0].userId == carExists.userId ? id : carExists.room.members[0].userId;
  const customer = bidderId || customerFromRoom;
  const negotiationTypeString = [
    'Mengajak ke Ruang Nego',
    'Ulangi Tawaran', // masih di ruang nego 1
    'Naikan Tawaran', // masih di ruang nego 2
    'Keluar dari Ruang Nego',
    'Terima Nego', // deal 4
    'Turunkan Tawaran', // masih di ruang nego 5
    'Ulangi Harga', // masih di ruang nego 6
    'Tetap Sebagai Penawar',
    'Coret Sebagai Penawar'
  ];

  if (id === carExists.userId) {
    let category;
    if (negotiationType == 0) {
      category = 2;
    } else {
      category = 3;
    }

    userNotifs.push({
      userId: customer,
      collapseKey: null,
      notificationTitle: 'Notifikasi Nego Beli',
      notificationBody: `Penjual ${negotiationTypeString[negotiationType]}`,
      notificationClickAction: 'carNegotiate',
      dataReferenceId: carId,
      category,
      // category: 4,
      // status: 2,
      tab: `tabNego-${customer}`
    });
  } else {
    userNotifs.push({
      userId: carExists.userId,
      collapseKey: null,
      notificationTitle: 'Notifikasi Nego Jual',
      notificationBody: `Pembeli ${negotiationTypeString[negotiationType]}`,
      notificationClickAction: 'carNegotiate',
      dataReferenceId: carId,
      category: 4,
      // status: 1,
      tab: `tabNego-${carExists.userId}`
    });
  }

  const create = {
    userId: id,
    bidderId,
    carId,
    bidAmount,
    haveSeenCar,
    paymentMethod,
    expiredAt,
    bidType: 1,
    negotiationType,
    comment,
    carPrice,
    roomId: carExists.roomId
  };

  const trans = await models.sequelize.transaction();
  const data = await models.Bargain.create(create, {
    transaction: trans
  }).catch(err => {
    trans.rollback();
    return res.status(422).json({
      success: false,
      errors: err.message
    });
  });

  if (negotiationType == 4) {
    await carExists.update({ status: 2 }, { transaction: trans }).catch(err => {
      trans.rollback();
      return res.status(422).json({
        success: false,
        errors: err.message
      });
    });

    const expiredAtPurchase = moment()
      .add(2, 'd')
      .format('YYYY-MM-DD HH:mm:ss');
    await models.Purchase.create(
      {
        userId: customer,
        carId,
        price: bidAmount,
        paymentMethod,
        bargainId: data.id,
        expiredAt: expiredAtPurchase
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
  }

  if (negotiationType == 7 || negotiationType == 8) {
    const where = { carId };
    if (negotiationType == 7) {
      Object.assign(where, {
        negotiationType: {
          [Op.not]: null
        },
        bidType: 1
      });
    }

    await models.Bargain.destroy({
      where,
      transaction: trans
    }).catch(err => {
      trans.rollback();
      return res.status(422).json({
        success: false,
        errors: err.message
      });
    });

    if (negotiationType == 8) {
      await models.Room.destroy({
        where: {
          id: carExists.roomId
        },
        transaction: trans
      }).catch(err => {
        trans.rollback();
        return res.status(422).json({
          success: false,
          errors: err.message
        });
      });

      await models.RoomMember.destroy({
        where: {
          roomId: carExists.roomId
        },
        transaction: trans
      }).catch(err => {
        trans.rollback();
        return res.status(422).json({
          success: false,
          errors: err.message
        });
      });

      await carExists.update({ roomId: null }, { transaction: trans }).catch(err => {
        trans.rollback();
        return res.status(422).json({
          success: false,
          errors: err.message
        });
      });
    }
  }

  const runQuery = async query =>
    await models.sequelize.query(query, {
      transaction: trans,
      type: models.sequelize.QueryTypes.SELECT
    });

  const getIsNego = await runQuery(`SELECT(EXISTS(SELECT "b"."id" 
    FROM "Bargains" b 
    WHERE "b"."carId" = ${data.carId} 
      AND "b"."bidderId" = ${data.userId}
      AND "b"."bidType" = 1
      AND "b"."negotiationType" NOT IN (3, 4)
      AND "b"."expiredAt" >= (SELECT NOW())
      AND "b"."deletedAt" IS NULL)) AS isnego`);

  const getIsRead = await runQuery(`SELECT(EXISTS(SELECT "r"."id" 
    FROM "BargainReaders" r 
    WHERE "r"."bargainId" = ${data.id}
      AND "r"."carId" = ${data.carId}
      AND "r"."userId" = ${id}
      -- AND "r"."type" = 4
      AND "r"."isRead" = TRUE
      AND "r"."deletedAt" IS NULL)) AS isread`);

  const getIsExpired = await runQuery(`SELECT(NOT EXISTS(SELECT "b"."id" 
    FROM "Bargains" b 
    WHERE "b"."carId" = ${data.carId}
      AND "b"."bidType" = 1
      AND "b"."negotiationType" NOT IN (3, 4)
      AND "b"."expiredAt" > (SELECT NOW())
      AND "b"."deletedAt" IS NULL)) AS isexpired`);

  data.dataValues.isNego = getIsNego[0].isnego;
  data.dataValues.isRead = getIsRead[0].isread;
  data.dataValues.isExpired = getIsExpired[0].isexpired;

  trans.commit();
  req.io.emit(`negotiation-car${carId}`, data);

  userNotifs.map(async userNotif => {
    const emit = await notification.insertNotification(userNotif);
    req.io.emit(`${userNotif.tab}-${userNotif.userId}`, emit);
    notification.userNotif(userNotif);
  });

  return res.status(200).json({
    success: true,
    data
  });
}

async function failureNegotiation(req, res) {
  const { carId } = req.params;
  const { withBid } = req.query;
  const userId = req.user.id;

  const car = await models.Car.findOne({
    where: {
      id: carId
    }
  });

  if (!car) {
    return res.status(422).json({
      success: false,
      errors: 'car not found'
    });
  }

  const where = { carId };
  if (!JSON.parse(withBid)) {
    Object.assign(where, {
      bidType: 1
    });
  }

  const trans = await models.sequelize.transaction();
  await models.Bargain.destroy({
    where,
    transaction: trans
  }).catch(err => {
    trans.rollback();
    return res.status(422).json({
      success: false,
      errors: err.message
    });
  });

  // await models.Room.destroy({
  //   where: {
  //     id: car.roomId
  //   },
  //   transaction: trans
  // }).catch(err => {
  //   trans.rollback();
  //   return res.status(422).json({ 
  //     success: false, 
  //     errors: err.message 
  //   });
  // });

  // await models.RoomMember.destroy({
  //   where: {
  //     roomId: car.roomId
  //   },
  //   transaction: trans
  // }).catch(err => {
  //   trans.rollback();
  //   return res.status(422).json({ 
  //     success: false, 
  //     errors: err.message 
  //   });
  // });

  await car.update({ roomId: null }, { transaction: trans }).catch(err => {
    trans.rollback();
    return res.status(422).json({
      success: false,
      errors: err.message
    });
  });

  trans.commit();
  return res.status(200).json({
    success: true
  });
}

module.exports = {
  bargainsList,
  bargainsListBidder,
  getSellNego,
  getBuyNego,
  bid,
  editBid,
  extend,
  negotiate,
  failureNegotiation
};
