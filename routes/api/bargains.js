/* eslint-disable linebreak-style */
const express = require('express');
const validator = require('validator');
const passport = require('passport');
const Sequelize = require('sequelize');
const moment = require('moment');
const models = require('../../db/models');
const paginator = require('../../helpers/paginator');
const notification = require('../../helpers/notification');
const bargainsController = require('../../controller/bargainsController');

const { Op } = Sequelize;
const router = express.Router();

const DEFAULT_LIMIT = process.env.DEFAULT_LIMIT || 10;
const MAX_LIMIT = process.env.MAX_LIMIT || 50;

router.get('/', async (req, res) => {
  return await bargainsController.bargainsList(req, res);
});

router.get('/id/:id', async (req, res) => {
  const { id } = req.params;
  return models.Bargain.findByPk(id)
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

router.post('/bid', passport.authenticate('user', { session: false }), async (req, res) => {
  return await bargainsController.bid(req, res);
});

router.put('/bid/:id', passport.authenticate('user', { session: false }), async (req, res) => {
  return await bargainsController.editBid(req, res);
});

router.put('/extend/:id', passport.authenticate('user', { session: false }), async (req, res) => {
  return await bargainsController.extend(req, res);
});

router.post('/negotiate', passport.authenticate('user', { session: false }), async (req, res) => {
  return await bargainsController.negotiate(req, res);
});

router.delete('/failureNegotiation/:carId', passport.authenticate('user', { session: false }), async (req, res) => {
  return await bargainsController.failureNegotiation(req, res);
});

// Jual -> Nego -> Ajak Nego/Sedang Nego
router.get('/sell/nego', passport.authenticate('user', { session: false }), async (req, res) => {
  return await bargainsController.getSellNego(req, res);
});

// Beli -> Nego -> Diajak Nego/Sedang Nego
router.get('/buy/nego', passport.authenticate('user', { session: false }), async (req, res) => {
  return await bargainsController.getBuyNego(req, res);
});

module.exports = router;
