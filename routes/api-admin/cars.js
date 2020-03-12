/* eslint-disable linebreak-style */
const express = require('express');
const validator = require('validator');
const Sequelize = require('sequelize');
const { check, validationResult } = require('express-validator');

const models = require('../../db/models');
const paginator = require('../../helpers/paginator');
const carsController = require('../../controller/carsController');

const { Op } = Sequelize;
const router = express.Router();

const DEFAULT_LIMIT = process.env.DEFAULT_LIMIT || 10;
const MAX_LIMIT = process.env.MAX_LIMIT || 50;

const params = {
  detail: [
    check('id', 'id is required.')
      .not()
      .isEmpty(),
    check('id', 'Invalid id').isInt()
  ],
  getAll: [
    check('page', 'page is required.')
      .not()
      .isEmpty(),
    check('page', 'Invalid page').isInt()
  ]
};

router.get('/categories', async (req, res) => {
  return carsController.getCategory(req, res);
});

router.post('/categories', async (req, res) => {
  return carsController.addCategory(req, res);
});

router.put('/categories/:id', params.detail, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.json({ success: false, errors: errors.errors[0].msg });

  return carsController.editCategory(req, res);
});

router.get('/categories/:id', params.detail, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.json({ success: false, errors: errors.errors[0].msg });

  return carsController.getCategoryById(req, res);
});

router.delete('/categories/:id', params.detail, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.json({ success: false, errors: errors.errors[0].msg });

  return carsController.delCategory(req, res);
});

module.exports = router;

// router.post('/categories/:id', params.detail, /*passport.authenticate('user', { session: false }),*/ async (req, res) => {
//   const errors = validationResult(req);
//   if (!errors.isEmpty()) return res.json({ success: false, errors: errors.errors[0].msg });

//   return carsController.carsGet(req, res, true);
// });
