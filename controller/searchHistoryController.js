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

  if (by === 'id' || by === 'userId' || by === 'createdAt' || by === 'title') order = [[by, sort]];

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

          const newParams = generateParams(item.params);
          item.dataValues.params = newParams;
          const client = supertest(req.app);
          const resultAPI = await client.get(item.apiURL);

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

      const newParams = generateParams(data.params);
      data.dataValues.params = newParams;
      const client = supertest(req.app);
      const resultAPI = await client.get(data.apiURL);

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

async function generateTitle(req, res) {
  const params = req.query;
  const title = await generateNextTitle(params, req, res);
  
  return res.json({
    success: true,
    data: {
      title 
    }
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
    const params = req.body;
    title = await generateNextTitle(params, req, res);
  } else {
    const checkTitle = await models.SearchHistory.findOne({
      where: {
        title,
        userId: req.user.id
      }
    });

    if(checkTitle) {
      return res.status(400).json({
        success: false,
        errors: 'title must be unique'
      });
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

  const newParams = generateParams(params);
  const apiURL = generateUrl(newParams);

  if(!apiURL) {
    return res.status(400).json({
      success: false,
      errors: "something went wrong, backend can't generate apiURL, please try again later"
    });
  } else {
    const checkApiURL = await models.SearchHistory.findOne({
      where: {
        apiURL,
        userId: req.user.id
      }
    });

    if(checkApiURL) {
      return res.status(400).json({
        success: false,
        errors: 'search history already exists'
      });
    } 
  }

  const trans = await models.sequelize.transaction();
  const searchHistory = await models.SearchHistory.create(
    {
      userId: req.user.id,
      title,
      countResult,
      apiURL
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

async function checkData(req, res) {
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

  const newParams = generateParams(params);
  const apiURL = generateUrl(newParams);

  if(!apiURL) {
    return res.status(400).json({
      success: false,
      errors: "something went wrong, backend can't generate apiURL, please try again later"
    });
  } else {
    const checkApiURL = await models.SearchHistory.findOne({
      where: {
        apiURL,
        userId: req.user.id
      }
    });

    if(checkApiURL) {
      return res.json({
        success: true,
        data: {
          message: 'Search data alredy exist',
          type: 0,
          similiarData: checkApiURL
        }
      });
    } 
  }

  const title = await generateNextTitle(newParams, req, res);
  return res.json({
    success: true,
    data: {
      message: 'Search data valid',
      type: 1,
      title
    }
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
  } else {
    const checkTitle = await models.SearchHistory.findOne({
      where: {
        title,
        id: {
          [Op.ne]: idHistory
        },
        userId: req.user.id
      }
    });

    if(checkTitle) {
      return res.status(400).json({
        success: false,
        errors: 'title must be unique'
      });
    }
  }

  if (!countResult) {
    countResult = data.countResult;
  }

  dataParams.map(item => {
    if (item.key == 'limit') {
      item.value = (typeof limit !== 'undefined') ? limit : item.value;
    }

    if (item.key == 'page') {
      item.value = (typeof page !== 'undefined') ? page : item.value;
    }

    if (item.key == 'by') {
      item.value = (typeof by !== 'undefined') ? by : item.value;
    }

    if (item.key == 'sort') {
      item.value = (typeof sort !== 'undefined') ? sort : item.value;
    }

    if (item.key == 'modelYearId') {
      item.value = (typeof modelYearId !== 'undefined') ? modelYearId : item.value;
    }

    if (item.key == 'condition') {
      item.value = (typeof condition !== 'undefined') ? condition : item.value;
    }

    if (item.key == 'brandId') {
      item.value = (typeof brandId !== 'undefined') ? brandId : item.value;
    }

    if (item.key == 'groupModelId') {
      item.value = (typeof groupModelId !== 'undefined') ? groupModelId : item.value;
    }

    if (item.key == 'modelId') {
      item.value = (typeof modelId !== 'undefined') ? modelId : item.value;
    }

    if (item.key == 'minPrice') {
      item.value = (typeof minPrice !== 'undefined') ? minPrice : item.value;
    }

    if (item.key == 'maxPrice') {
      item.value = (typeof maxPrice !== 'undefined') ? maxPrice : item.value;
    }

    if (item.key == 'minYear') {
      item.value = (typeof minYear !== 'undefined') ? minYear : item.value;
    }

    if (item.key == 'maxYear') {
      item.value = (typeof maxYear !== 'undefined') ? maxYear : item.value;
    }

    if (item.key == 'radius') {
      item.value = (radius && typeof radius[0] !== 'undefined') ? radius[0] : item.value;
    }

    if (item.key == 'radius') {
      item.value = (radius && typeof radius[1] !== 'undefined') ? radius[1] : item.value;
    }

    if (item.key == 'latitude') {
      item.value = (typeof latitude !== 'undefined') ? latitude : item.value;
    }

    if (item.key == 'longitude') {
      item.value = (typeof longitude !== 'undefined') ? longitude : item.value;
    }

    if (item.key == 'minKm') {
      item.value = (typeof minKm !== 'undefined') ? minKm : item.value;
    }

    if (item.key == 'maxKm') {
      item.value = (typeof maxKm !== 'undefined') ? maxKm : item.value;
    }

    if (item.key == 'subdistrictId') {
      item.value = (typeof subdistrictId !== 'undefined') ? subdistrictId : item.value;
    }

    if (item.key == 'cityId') {
      item.value = (typeof cityId !== 'undefined') ? cityId : item.value;
    }

    if (item.key == 'typeId') {
      item.value = (typeof typeId !== 'undefined') ? typeId : item.value;
    }

    if (item.key == 'id') {
      item.value = (typeof id !== 'undefined') ? id : item.value;
    }

    if (item.key == 'exteriorColorId') {
      item.value = (typeof exteriorColorId !== 'undefined') ? exteriorColorId : item.value;
    }

    if (item.key == 'interiorColorId') {
      item.value = (typeof interiorColorId !== 'undefined') ? interiorColorId : item.value;
    }
  });

  const newParams = generateParams(dataParams);
  const apiURL = generateUrl(newParams);

  if(!apiURL) {
    return res.status(400).json({
      success: false,
      errors: "something went wrong, backend can't generate apiURL, please try again later"
    });
  } else {
    const checkApiURL = await models.SearchHistory.findOne({
      where: {
        apiURL,
        id: {
          [Op.ne]: idHistory
        },
        userId: req.user.id
      }
    });

    if(checkApiURL) {
      return res.status(400).json({
        success: false,
        errors: 'search history already exists'
      });
    } 
  }

  const trans = await models.sequelize.transaction();
  data
    .update(
      {
        title,
        countResult,
        apiURL
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

  data.countResult = parseInt(data.countResult);
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




// Helper Functions
async function generateNextTitle(params, req, res) {
  let customTitle = [];
  let title = '';

  if (params.brandId) {
    const brand = await models.Brand.findByPk(params.brandId);
    if (!brand) {
      return res.status(400).json({
        success: false,
        errors: 'data Brand from Body/Query not found'
      });
    }

    customTitle.push(brand.name);
  }

  if (params.groupModelId) {
    const groupModel = await models.GroupModel.findByPk(params.groupModelId);
    if (!groupModel) {
      return res.status(400).json({
        success: false,
        errors: 'data Group Model from Body/Query not found'
      });
    }

    customTitle.push(groupModel.name);
  }

  if (params.modelId) {
    const model = await models.Model.findByPk(params.modelId);
    if (!model) {
      return res.status(400).json({
        success: false,
        errors: 'data Group Model from Body/Query not found'
      });
    }

    customTitle.push(model.name);
  }

  if (params.modelYearId) {
    const modelYear = await models.ModelYear.findByPk(params.modelYearId);
    if (!modelYear) {
      return res.status(400).json({
        success: false,
        errors: 'data Model Year from Body/Query not found'
      });
    }

    customTitle.push(modelYear.year);
  }

  // if (params.limit) {
  //   customTitle.push(`Limit ${params.limit}`);
  // }

  // if (params.page) {
  //   customTitle.push(`Page ${params.page}`);
  // }

  // if (params.by) {
  //   customTitle.push(`Order By ${params.by}`);
  // }

  // if (params.sort) {
  //   customTitle.push(`Sorting ${params.sort}`);
  // }

  if (params.condition) {
    customTitle.push(`Car Condition ${params.condition}`);
  }

  if (params.minPrice && params.maxPrice) {
    customTitle.push(`Price ${params.minPrice}-${params.maxPrice}`);
  }

  if (params.minYear && params.maxYear) {
    customTitle.push(`Year ${params.minYear}-${params.maxYear}`);
  }

  if (params['radius[0]'] && params['radius[1]']) {
    customTitle.push(`Radius ${params['radius[0]']}-${params['radius[1]']}`);
  }

  if (params.latitude && params.longitude) {
    customTitle.push(`Latitude ${params.latitude} & Longitude ${params.longitude}`);
  }

  if (params.minKm && params.maxKm) {
    customTitle.push(`KM ${params.minKm}-${params.maxKm}`);
  }

  if (params.subdistrictId) {
    const subdistrict = await models.SubDistrict.findByPk(params.subdistrictId);
    if (!subdistrict) {
      return res.status(400).json({
        success: false,
        errors: 'data Subdistrict from Body/Query not found'
      });
    }

    const capitalizeWord = (string) => {
      return string.charAt(0).toUpperCase() + string.slice(1);
    }

    customTitle.push(`Subdistrict ${capitalizeWord((subdistrict.name).toLowerCase())}`);
  }

  if (params.cityId) {
    const city = await models.City.findByPk(params.cityId);
    if (!city) {
      return res.status(400).json({
        success: false,
        errors: 'data City from Body/Query not found'
      });
    }

    customTitle.push(`City ${city.name}`);
  }

  if (params.typeId) {
    const type = await models.Type.findByPk(params.typeId);
    if (!type) {
      return res.status(400).json({
        success: false,
        errors: 'data Type from Body/Query not found'
      });
    }
    
    customTitle.push(`Type ${type.name}`);
  }

  if (params.id) {
    customTitle.push(`Id ${params.id}`);
  }

  if (params.exteriorColorId) {
    const exteriorColor = await models.Color.findByPk(params.exteriorColorId);
    if (!exteriorColor) {
      return res.status(400).json({
        success: false,
        errors: 'data Exterior Color from Body/Query not found'
      });
    }
    
    customTitle.push(`Exterior Color ${exteriorColor.name}`);
  }

  if (params.interiorColorId) {
    const interiorColor = await models.Color.findByPk(params.interiorColorId);
    if (!interiorColor) {
      return res.status(400).json({
        success: false,
        errors: 'data Interior Color from Body/Query not found'
      });
    }
    
    customTitle.push(`Interior Color ${interiorColor.name}`);
  }

  customTitle = customTitle.join(' - ');
  if(!customTitle) {
    customTitle = 'Search All'
  }

  const checkTitle = await models.SearchHistory.findOne({
    where: {
      title: `${customTitle} 1`,
      userId: req.user.id
    }
  });

  if (checkTitle) {
    const getLastTitle = await models.SearchHistory.findOne({
      where: Sequelize.literal(`"SearchHistory"."title" SIMILAR TO '${customTitle} [0-9]*' 
        AND "SearchHistory"."userId" = ${req.user.id}`),
      order: [['title', 'desc']]
    });

    if (parseInt(getLastTitle.title.slice(-1)) > 0) {
      title = `${customTitle} ${parseInt(getLastTitle.title.slice(-1)) + 1}`;
    }
  } else {
    title = `${customTitle} 1`;
  }

  return title;
}

function generateUrl(params) {
  const serialize = obj => {
    const str = [];
    for (const p in obj) {
      if (obj.hasOwnProperty(p)) {
        str.push(`${encodeURIComponent(p)}=${encodeURIComponent(obj[p])}`);
      }
    }

    return str.join('&');
  };

  return `/api/modelYears/listingAllNew?${serialize(params)}`;
}

function generateParams(params) {
  const newParams = {};
  params.map(param => {
    Object.assign(newParams, {
      [param.key]: param.value
    });
  });

  const sortObject = obj => Object.keys(obj).sort().reduce((r, k) => (r[k] = obj[k], r), {});
  return sortObject(newParams);
}

module.exports = {
  get,
  getById,
  generateTitle,
  create,
  checkData,
  edit,
  destroy
};
