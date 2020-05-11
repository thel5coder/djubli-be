const express = require('express');
const passport = require('passport');
const carsCommentsController = require('../../controller/carsCommentsController');

const router = express.Router();

router.get('/', passport.authenticate('user', { session: false }), async (req, res) => {
  return await carsCommentsController.get(req, res);
});

router.get('/id/:id', passport.authenticate('user', { session: false }), async (req, res) => {
  return await carsCommentsController.getById(req, res);
});

router.post('/', passport.authenticate('user', { session: false }), async (req, res) => {
  return await carsCommentsController.create(req, res);
});

router.put('/:id', passport.authenticate('user', { session: false }), async (req, res) => {
  return await carsCommentsController.edit(req, res);
});

router.delete('/id/:id', passport.authenticate('user', { session: false }), async (req, res) => {
  return await carsCommentsController.destroy(req, res);
});

module.exports = router;
