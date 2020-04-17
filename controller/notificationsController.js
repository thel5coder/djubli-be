const validator = require('validator');
const Sequelize = require('sequelize');
const models = require('../db/models');
const paginator = require('../helpers/paginator');

const { Op } = Sequelize;

const DEFAULT_LIMIT = process.env.DEFAULT_LIMIT || 10;
const MAX_LIMIT = process.env.MAX_LIMIT || 50;

async function getAll(req, res) {
  const { category, id, fullResponse } = req.query;
  const userId = req.user.id;
  let { page, limit, by, sort } = req.query;
  let offset = 0;

  if (validator.isInt(limit ? limit.toString() : '') === false) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (validator.isInt(page ? page.toString() : '')) offset = (page - 1) * limit;
  else page = 1;

  if (!by) by = 'id';
  const array = [
    'id',
    'userId',
    'title',
    'body',
    'category',
    'status',
    'referenceId',
    'action',
    'createdAt'
  ];
  if (array.indexOf(by) < 0) by = 'createdAt';
  sort = ['asc', 'desc'].indexOf(sort) < 0 ? 'asc' : sort;
  const order = [[by, sort]];

  const where = { userId };
  const whereCountUnRead = { userId, action: 0 };
  const whereCountSee = { userId, action: 1 };
  if (id) Object.assign(where, { id });
  if (category) {
    Object.assign(where, { category });
    Object.assign(whereCountUnRead, { category });
    Object.assign(whereCountSee, { category });
  }
  const include = [];
  if (fullResponse) {
    const fullResponseArr = ['true', 'false'];
    if (fullResponseArr.indexOf(fullResponse) < 0)
      return res.status(400).json({ success: false, errors: 'Invalid fullResponse' });
    if (fullResponse === 'true') {
      include.push({
        model: models.Car,
        as: 'car',
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
              },
              {
                model: models.Purchase,
                as: 'purchase',
                attributes: {
                  exclude: ['deletedAt']
                },
                order: [['id', 'desc']],
                limit: 1
              }
            ]
          },
          {
            model: models.Brand,
            as: 'brand',
            attributes: ['id', 'name', 'logo']
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
            include: {
              model: models.File,
              as: 'file',
              attributes: ['type', 'url']
            }
          },
          {
            model: models.ExteriorGalery,
            as: 'exteriorGalery',
            attributes: ['id', 'fileId', 'carId'],
            include: {
              model: models.File,
              as: 'file',
              attributes: ['type', 'url']
            }
          },
          {
            model: models.ModelYear,
            as: 'modelYear',
            attributes: {
              exclude: ['picture', 'pictureUrl', 'createdAt', 'updatedAt', 'deletedAt']
            }
          },
          {
            required: false,
            model: models.Bargain,
            as: 'bargain',
            attributes: {
              exclude: ['deletedAt']
            },
            // where: whereBargain,
            limit: 1,
            order: [['id', 'desc']]
          }
        ]
      });
    }
  }

  return models.Notification.findAll({
    attributes: {
      exclude: ['deletedAt']
    },
    include,
    where,
    order,
    offset,
    limit
  })
    .then(async data => {
      const unRead = await models.Notification.count({ where: whereCountUnRead });
      const seen = await models.Notification.count({ where: whereCountSee });
      const count = await models.Notification.count({ where });
      const notification = { unRead, seen };
      const pagination = paginator.paging(page, count, limit);
      res.json({
        success: true,
        notification,
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

async function read(req, res) {
  const { id, category } = req.body;
  const update = { action: 1 };
  const where = { action: 0 };

  if (id) {
    const notifExists = await models.Notification.findByPk(id);
    if (notifExists.action == 1)
      return res.status(200).json({ success: true, message: 'changed', data: notifExists });

    Object.assign(where, { id });
  }
  if (category) Object.assign(where, { category });

  // return res.status(200).json({ success: true, message: 'changed', data: { update, where } });
  return models.Notification.update(update, { where })
    .then(async data => {
      return res.status(200).json({ success: true, message: 'success update', data });
    })
    .catch(err => {
      return res.status(200).json({ success: false, errors: 'Something wrong!' });
    });
}

async function unRead(req, res) {
  const { category } = req.body;
  const update = { action: 0 };
  const where = { action: 1 };
  if (category) Object.assign(where, { category });

  // return responseBase._success({ res, message: 'Parameter Oke', data: { update, where } });
  return models.Notification.update(update, {
    where
  })
    .then(async data => {
      return res.status(200).json({ success: true, message: 'update unRead', data });
    })
    .catch(err => {
      return res.status(200).json({ success: false, errors: 'Something wrong!' });
    });
}

async function click(req, res) {
  const { id, category } = req.body;
  const update = { action: 2 };
  const where = { action: 1 };

  if (id) {
    const notifExists = await models.Notification.findByPk(id);
    if (notifExists.action == 2)
      return res.status(200).json({ success: true, message: 'has been seen', data: notifExists });

    Object.assign(where, { id });
  }
  if (category) Object.assign(where, { category });

  // return res.status(200).json({ success: true, message: 'changed', data: { update, where } });
  return models.Notification.update(update, { where })
    .then(async data => {
      return res.status(200).json({ success: true, message: 'success update', data });
    })
    .catch(err => {
      return res.status(200).json({ success: false, errors: 'Something wrong!' });
    });
}

async function unClick(req, res) {
  const { category } = req.body;
  const update = { action: 1 };
  const where = { action: 2 };
  if (category) Object.assign(where, { category });

  // return responseBase._success({ res, message: 'Parameter Oke', data: { update, where } });
  return models.Notification.update(update, {
    where
  })
    .then(async data => {
      return res.status(200).json({ success: true, message: 'update unClick', data });
    })
    .catch(err => {
      return res.status(200).json({ success: false, errors: 'Something wrong!' });
    });
}

module.exports = {
  getAll,
  read,
  unRead,
  click,
  unClick
};
