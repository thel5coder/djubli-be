/* eslint-disable linebreak-style */
const moment = require('moment');
const express = require('express');
const validator = require('validator');
const passport = require('passport');
const Sequelize = require('sequelize');
const models = require('../../db/models');
const general = require('../../helpers/general');
const apiResponse = require('../../helpers/apiResponse');
const searchHistoryController = require('../../controller/searchHistoryController');

const { Op } = Sequelize;
const router = express.Router();

router.get('/', passport.authenticate('user', { session: false }), async (req, res) => {
  return await searchHistoryController.get(req, res);
});

router.get('/id/:id', passport.authenticate('user', { session: false }), async (req, res) => {
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
      // const url = `${new URL(data.apiURL).pathname}${new URL(data.apiURL).search}`;
      // const client = supertest(req.app);
      // const resultAPI = await client.get(url);

      // if (resultAPI.body && resultAPI.body.pagination) {
      //   data.countResult = resultAPI.body.pagination.count;
      //   await models.SearchHistory.update(
      //     {
      //       countResult: resultAPI.body.pagination.count
      //     },
      //     { where: { id: data.id } }
      //   ).catch(err =>
      //     res.status(422).json({
      //       success: false,
      //       errors: err.message
      //     })
      //   );
      // }

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

router.post('/', passport.authenticate('user', { session: false }), async (req, res) => {
  return await searchHistoryController.create(req, res);
});

router.put('/:id', passport.authenticate('user', { session: false }), async (req, res) => {
  const { apiURL, countResult } = req.body;
  let { title } = req.body;
  const { id } = req.params;

  if (validator.isInt(id ? id.toString() : '') === false) {
    return res.status(400).json({
      success: false,
      errors: 'Invalid Parameter'
    });
  }

  if (!apiURL) return res.status(400).json({ success: false, errors: 'apiURL is mandatory' });
  if (!countResult)
    return res.status(400).json({ success: false, errors: 'count result is mandatory' });

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

  if (!title) {
    let customTitle = [];
    const strToUrl = new URLSearchParams(apiURL);

    if (strToUrl.get('brandId')) {
      const brand = await models.Brand.findByPk(strToUrl.get('brandId'));
      if (!brand) {
        return res.status(400).json({
          success: false,
          errors: 'data Brand from apiURL not found'
        });
      }

      customTitle.push(brand.name);
    }

    if (strToUrl.get('groupModelId')) {
      const groupModel = await models.GroupModel.findByPk(strToUrl.get('groupModelId'));
      if (!groupModel) {
        return res.status(400).json({
          success: false,
          errors: 'data Group Model from apiURL not found'
        });
      }

      customTitle.push(groupModel.name);
    }

    if (strToUrl.get('modelId')) {
      const model = await models.Model.findByPk(strToUrl.get('modelId'));
      if (!model) {
        return res.status(400).json({
          success: false,
          errors: 'data Group Model from apiURL not found'
        });
      }

      customTitle.push(model.name);
    }

    if (strToUrl.get('modelYearId')) {
      const modelYear = await models.ModelYear.findByPk(strToUrl.get('modelYearId'));
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
        id: {
          [Op.ne]: id
        },
        title: `${customTitle} 1`
      }
    });

    if (checkTitle) {
      const getLastTitle = await models.SearchHistory.findOne({
        where: Sequelize.literal(
          `"SearchHistory"."id" != ${id} AND "SearchHistory"."title" SIMILAR TO '${customTitle} [0-9]*'`
        ),
        order: [['title', 'desc']]
      });

      if (parseInt(getLastTitle.title.slice(-1)) > 0) {
        title = `${customTitle} ${parseInt(getLastTitle.title.slice(-1)) + 1}`;
      }
    }
  }

  return data
    .update({
      title,
      apiURL,
      countResult
    })
    .then(data =>
      res.json({
        success: true,
        data
      })
    )
    .catch(err =>
      res.status(422).json({
        success: false,
        errors: err.message
      })
    );
});

router.delete('/id/:id', passport.authenticate('user', { session: false }), async (req, res) => {
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

  return data
    .destroy()
    .then(data =>
      res.json({
        success: true,
        data
      })
    )
    .catch(err =>
      res.status(422).json({
        success: false,
        errors: err.message
      })
    );
});

module.exports = router;
