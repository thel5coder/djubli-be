/* eslint-disable linebreak-style */
const express = require('express');
const passport = require('passport');
const searchHistoryController = require('../../controller/searchHistoryController');

const router = express.Router();

router.get('/', passport.authenticate('user', { session: false }), async (req, res) => {
  return await searchHistoryController.get(req, res);
});

router.get('/id/:id', passport.authenticate('user', { session: false }), async (req, res) => {
  return await searchHistoryController.getById(req, res);
});

router.get('/generateTitle', passport.authenticate('user', { session: false }), async (req, res) => {
  return await searchHistoryController.generateTitle(req, res);
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
