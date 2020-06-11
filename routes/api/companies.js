/* eslint-disable linebreak-style */
const express = require('express');
const passport = require('passport');
const companiesController = require('../../controller/companiesController');

const router = express.Router();

router.get('/businessType', async (req, res) => {
	return await companiesController.getBusinessType(req, res);
});

router.get('/getByBusinessType', async (req, res) => {
	return await companiesController.getByBusinessType(req, res);
});

router.get('/:id', async (req, res) => {
	return await companiesController.getById(req, res);
});

module.exports = router;