/* eslint-disable linebreak-style */
const express = require('express');
const passport = require('passport');
const Sequelize = require('sequelize');
const notificationsController = require('../../controller/notificationsController');

const { Op } = Sequelize;
const router = express.Router();

router.get('/', passport.authenticate('user', { session: false }), async (req, res) => {
  return notificationsController.getAll(req, res);
});

router.put('/read', passport.authenticate('user', { session: false }), async (req, res) => {
  return notificationsController.read(req, res);
});

router.put('/unRead', passport.authenticate('user', { session: false }), async (req, res) => {
  return notificationsController.unRead(req, res);
});

router.put('/click', passport.authenticate('user', { session: false }), async (req, res) => {
  return notificationsController.click(req, res);
});

router.put('/unClick', passport.authenticate('user', { session: false }), async (req, res) => {
  return notificationsController.unClick(req, res);
});

module.exports = router;
