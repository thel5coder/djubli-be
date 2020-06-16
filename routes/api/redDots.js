const express = require('express');
const passport = require('passport');
const redDotsController = require('../../controller/redDotsController');

const router = express.Router();

router.get('/jual', passport.authenticate('user', { session: false }), async (req, res) => {
  return await redDotsController.getJual(req, res);
});

router.get('/jual/nego', passport.authenticate('user', { session: false }), async (req, res) => {
  return await redDotsController.getJualNego(req, res);
});

router.get('/jual/nego/tab', passport.authenticate('user', { session: false }), async (req, res) => {
  return await redDotsController.getJualNegoTab(req, res);
});

router.get('/beli', passport.authenticate('user', { session: false }), async (req, res) => {
  return await redDotsController.getBeli(req, res);
});

router.get('/beli/nego', passport.authenticate('user', { session: false }), async (req, res) => {
  return await redDotsController.getBeliNego(req, res);
});

router.get('/beli/nego/tab', passport.authenticate('user', { session: false }), async (req, res) => {
  return await redDotsController.getBeliNegoTab(req, res);
});

module.exports = router;