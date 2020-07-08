const express = require('express');
const passport = require('passport');
const redDotsController = require('../../controller/redDotsController');

const router = express.Router();

// GET Read Dots
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

// POST Read Dots
router.post('/jual/read', passport.authenticate('user', { session: false }), async (req, res) => {
  return await redDotsController.readJual(req, res);
});

router.post('/jual/nego/read', passport.authenticate('user', { session: false }), async (req, res) => {
  return await redDotsController.readJualNego(req, res);
});

router.post('/jual/nego/tab/read', passport.authenticate('user', { session: false }), async (req, res) => {
  return await redDotsController.readJualNegoTab(req, res);
});

router.post('/beli/read', passport.authenticate('user', { session: false }), async (req, res) => {
  return await redDotsController.readBeli(req, res);
});

router.post('/beli/nego/read', passport.authenticate('user', { session: false }), async (req, res) => {
  return await redDotsController.readBeliNego(req, res);
});

router.post('/beli/nego/tab/read', passport.authenticate('user', { session: false }), async (req, res) => {
  return await redDotsController.readBeliNegoTab(req, res);
});

module.exports = router;