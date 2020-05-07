const validator = require('validator');
const Sequelize = require('sequelize');
const supertest = require('supertest');
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
    userId: req.user.id
  };

  return models.SearchHistory.findAll({
    include: [
      {
        model: models.User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'phone', 'type', 'companyType']
      },
      {
        model: models.SearchHistoryParam,
        as: 'params',
        attributes: ['id', 'key', 'value']
      }
    ],
    where,
    order,
    offset,
    limit
  })
    .then(async data => {
      const count = await models.SearchHistory.count({
        where
      });
      const pagination = paginator.paging(page, count, limit);

      await Promise.all(
        data.map(async item => {
          const newParams = {};
          item.params.map(param => {
            Object.assign(newParams, {
              [param.key]: param.value
            });
          });

          item.dataValues.params = newParams;
          const serialize = obj => {
            const str = [];
            for (const p in obj) {
              if (obj.hasOwnProperty(p)) {
                str.push(`${encodeURIComponent(p)}=${encodeURIComponent(obj[p])}`);
              }
            }

            return str.join('&');
          };

          const url = `/api/modelYears/listingAllNew?${serialize(newParams)}`;
          const client = supertest(req.app);
          const resultAPI = await client.get(url);

          if (resultAPI.body && resultAPI.body.pagination) {
            item.countResult = resultAPI.body.pagination.count;
            await models.SearchHistory.update(
              {
                countResult: resultAPI.body.pagination.count
              },
              {
                where: {
                  id: item.id
                }
              }
            ).catch(err =>
              res.status(422).json({
                success: false,
                errors: err.message
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

async function getById(req, res) {
  const { id } = req.params;

  return models.SearchHistory.findOne({
    where: {
      userId: req.user.id,
      id
    },
    include: [
      {
        model: models.User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'phone', 'type', 'companyType']
      },
      {
        model: models.SearchHistoryParam,
        as: 'params',
        attributes: ['id', 'key', 'value']
      }
    ]
  })
    .then(async data => {
      const newParams = {};
      data.params.map(param => {
        Object.assign(newParams, {
          [param.key]: param.value
        });
      });

      data.dataValues.params = newParams;
      const serialize = obj => {
        const str = [];
        for (const p in obj) {
          if (obj.hasOwnProperty(p)) {
            str.push(`${encodeURIComponent(p)}=${encodeURIComponent(obj[p])}`);
          }
        }

        return str.join('&');
      };

      const url = `/api/modelYears/listingAllNew?${serialize(newParams)}`;
      const client = supertest(req.app);
      const resultAPI = await client.get(url);

      if (resultAPI.body && resultAPI.body.pagination) {
        data.countResult = resultAPI.body.pagination.count;
        await models.SearchHistory.update(
          {
            countResult: resultAPI.body.pagination.count
          },
          {
            where: {
              id: data.id
            }
          }
        ).catch(err =>
          res.status(422).json({
            success: false,
            errors: err.message
          })
        );
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
}

async function create(req, res) {
  const { countResult } = req.body;
  let { title } = req.body;

  const {
    limit,
    page,
    by,
    sort,
    modelYearId,
    condition,
    brandId,
    groupModelId,
    modelId,
    minPrice,
    maxPrice,
    minYear,
    maxYear,
    radius,
    latitude,
    longitude,
    minKm,
    maxKm,
    subdistrictId,
    cityId,
    typeId,
    id,
    exteriorColorId,
    interiorColorId
  } = req.body;

  if (!countResult) {
    return res.status(400).json({
      success: false,
      errors: 'count result is mandatory'
    });
  }

  if (!title) {
    let customTitle = [];

    if (brandId) {
      const brand = await models.Brand.findByPk(brandId);
      if (!brand) {
        return res.status(400).json({
          success: false,
          errors: 'data Brand from apiURL not found'
        });
      }

      customTitle.push(brand.name);
    }

    if (groupModelId) {
      const groupModel = await models.GroupModel.findByPk(groupModelId);
      if (!groupModel) {
        return res.status(400).json({
          success: false,
          errors: 'data Group Model from apiURL not found'
        });
      }

      customTitle.push(groupModel.name);
    }

    if (modelId) {
      const model = await models.Model.findByPk(modelId);
      if (!model) {
        return res.status(400).json({
          success: false,
          errors: 'data Group Model from apiURL not found'
        });
      }

      customTitle.push(model.name);
    }

    if (modelYearId) {
      const modelYear = await models.ModelYear.findByPk(modelYearId);
      if (!modelYear) {
        return res.status(400).json({
          success: false,
          errors: 'data Model Year from apiURL not found'
        });
      }

      customTitle.push(modelYear.year);
    }

    customTitle = customTitle.join(' - ');
    const checkTitle = await models.SearchHistory.findOne({
      where: {
        title: `${customTitle} 1`
      }
    });

    if (checkTitle) {
      const getLastTitle = await models.SearchHistory.findOne({
        where: Sequelize.literal(`"SearchHistory"."title" SIMILAR TO '${customTitle} [0-9]*'`),
        order: [['title', 'desc']]
      });

      if (parseInt(getLastTitle.title.slice(-1)) > 0) {
        title = `${customTitle} ${parseInt(getLastTitle.title.slice(-1)) + 1}`;
      }
    } else {
      title = `${customTitle} 1`;
    }
  }

  const params = [
    {
      key: 'limit',
      value: limit || ''
    },
    {
      key: 'page',
      value: page || ''
    },
    {
      key: 'by',
      value: by || ''
    },
    {
      key: 'sort',
      value: sort || ''
    },
    {
      key: 'modelYearId',
      value: modelYearId || ''
    },
    {
      key: 'condition',
      value: condition || ''
    },
    {
      key: 'brandId',
      value: brandId || ''
    },
    {
      key: 'groupModelId',
      value: groupModelId || ''
    },
    {
      key: 'modelId',
      value: modelId || ''
    },
    {
      key: 'minPrice',
      value: minPrice || ''
    },
    {
      key: 'maxPrice',
      value: maxPrice || ''
    },
    {
      key: 'minYear',
      value: minYear || ''
    },
    {
      key: 'maxYear',
      value: maxYear || ''
    },
    {
      key: 'radius[0]',
      value: radius && Array.isArray(radius) && radius[0] ? radius[0] : ''
    },
    {
      key: 'radius[1]',
      value: radius && Array.isArray(radius) && radius[1] ? radius[1] : ''
    },
    {
      key: 'latitude',
      value: latitude || ''
    },
    {
      key: 'longitude',
      value: longitude || ''
    },
    {
      key: 'minKm',
      value: minKm || ''
    },
    {
      key: 'maxKm',
      value: maxKm || ''
    },
    {
      key: 'subdistrictId',
      value: subdistrictId || ''
    },
    {
      key: 'cityId',
      value: cityId || ''
    },
    {
      key: 'typeId',
      value: typeId || ''
    },
    {
      key: 'id',
      value: id || ''
    },
    {
      key: 'exteriorColorId',
      value: exteriorColorId || ''
    },
    {
      key: 'interiorColorId',
      value: interiorColorId || ''
    }
  ];

  const trans = await models.sequelize.transaction();
  const searchHistory = await models.SearchHistory.create(
    {
      userId: req.user.id,
      title,
      countResult
    },
    {
      transaction: trans
    }
  ).catch(err => {
    trans.rollback();
    res.status(422).json({
      success: false,
      errors: err.message
    });
  });

  params.map(item => {
    item.searchHistoryId = searchHistory.id;
  });

  await models.SearchHistoryParam.bulkCreate(params, {
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
    data: searchHistory
  });
}

async function edit(req, res) {
  let { title, countResult } = req.body;
  const { id: idHistory } = req.params;

  const {
    limit,
    page,
    by,
    sort,
    modelYearId,
    condition,
    brandId,
    groupModelId,
    modelId,
    minPrice,
    maxPrice,
    minYear,
    maxYear,
    radius,
    latitude,
    longitude,
    minKm,
    maxKm,
    subdistrictId,
    cityId,
    typeId,
    id,
    exteriorColorId,
    interiorColorId
  } = req.body;

  if (validator.isInt(idHistory ? idHistory.toString() : '') === false) {
    return res.status(400).json({
      success: false,
      errors: 'Invalid Parameter'
    });
  }

  const data = await models.SearchHistory.findOne({
    where: {
      userId: req.user.id,
      id: idHistory
    }
  });

  const dataParams = await models.SearchHistoryParam.findAll({
    where: {
      searchHistoryId: idHistory
    }
  });

  if (!data) {
    return res.status(400).json({
      success: false,
      errors: 'Search History not found'
    });
  }

  if (!dataParams) {
    return res.status(400).json({
      success: false,
      errors: 'Search History Params not found'
    });
  }

  if (!title) {
    title = data.title;
  }

  if (!countResult) {
    countResult = data.countResult;
  }

  dataParams.map(item => {
    if (item.key == 'limit') {
      item.value = limit || item.value;
    }

    if (item.key == 'page') {
      item.value = page || item.value;
    }

    if (item.key == 'by') {
      item.value = by || item.value;
    }

    if (item.key == 'sort') {
      item.value = sort || item.value;
    }

    if (item.key == 'modelYearId') {
      item.value = modelYearId || item.value;
    }

    if (item.key == 'condition') {
      item.value = condition || item.value;
    }

    if (item.key == 'brandId') {
      item.value = brandId || item.value;
    }

    if (item.key == 'groupModelId') {
      item.value = groupModelId || item.value;
    }

    if (item.key == 'modelId') {
      item.value = modelId || item.value;
    }

    if (item.key == 'minPrice') {
      item.value = minPrice || item.value;
    }

    if (item.key == 'maxPrice') {
      item.value = maxPrice || item.value;
    }

    if (item.key == 'minYear') {
      item.value = minYear || item.value;
    }

    if (item.key == 'maxYear') {
      item.value = maxYear || item.value;
    }

    if (item.key == 'radius') {
      item.value = radius ? radius[0] : item.value;
    }

    if (item.key == 'radius') {
      item.value = radius ? radius[1] : item.value;
    }

    if (item.key == 'latitude') {
      item.value = latitude || item.value;
    }

    if (item.key == 'longitude') {
      item.value = longitude || item.value;
    }

    if (item.key == 'minKm') {
      item.value = minKm || item.value;
    }

    if (item.key == 'maxKm') {
      item.value = maxKm || item.value;
    }

    if (item.key == 'subdistrictId') {
      item.value = subdistrictId || item.value;
    }

    if (item.key == 'cityId') {
      item.value = cityId || item.value;
    }

    if (item.key == 'typeId') {
      item.value = typeId || item.value;
    }

    if (item.key == 'id') {
      item.value = id || item.value;
    }

    if (item.key == 'exteriorColorId') {
      item.value = exteriorColorId || item.value;
    }

    if (item.key == 'interiorColorId') {
      item.value = interiorColorId || item.value;
    }
  });

  const trans = await models.sequelize.transaction();
  data
    .update(
      {
        title,
        countResult
      },
      { transaction: trans }
    )
    .catch(err => {
      trans.rollback();
      res.status(422).json({
        success: false,
        errors: err.message
      });
    });

  await Promise.all(
    dataParams.map(async item => {
      await item
        .update(
          {
            key: item.key,
            value: item.value
          },
          { transaction: trans }
        )
        .catch(err => {
          trans.rollback();
          res.status(422).json({
            success: false,
            errors: err.message
          });
        });
    })
  );

  trans.commit();
  return res.json({
    success: true,
    data
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

  const data = await models.SearchHistory.findOne({
    where: {
      userId: req.user.id,
      id
    }
  });

  if (!data) {
    return res.status(400).json({
      success: false,
      errors: 'Search History not found'
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

  await models.SearchHistoryParam.destroy({
    where: {
      searchHistoryId: data.id
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
