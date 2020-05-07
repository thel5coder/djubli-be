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
  return await searchHistoryController.getById(req, res);
});

router.post('/', passport.authenticate('user', { session: false }), async (req, res) => {
  return await searchHistoryController.create(req, res);
});

router.put('/:id', passport.authenticate('user', { session: false }), async (req, res) => {
  return await searchHistoryController.edit(req, res);
});

router.delete('/id/:id', passport.authenticate('user', { session: false }), async (req, res) => {
  return await searchHistoryController.destroy(req, res);
});

module.exports = router;
