const express = require('express');
const passport = require('passport');
const redDotsController = require('../../controller/redDotsController');

const router = express.Router();

// GET Read Dots
router.get('/beli', passport.authenticate('user', { session: false }), async (req, res) => {
  return await redDotsController.getBeli(req, res);
});

router.get('/jual', passport.authenticate('user', { session: false }), async (req, res) => {
  return await redDotsController.getJual(req, res);
});

module.exports = router;