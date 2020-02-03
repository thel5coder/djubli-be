/* eslint-disable linebreak-style */
const express = require('express');
const validator = require('validator');
const Sequelize = require('sequelize');
const passport = require('passport');
const models = require('../../db/models');
const paginator = require('../../helpers/paginator');

const { Op } = Sequelize;
const router = express.Router();

const DEFAULT_LIMIT = process.env.DEFAULT_LIMIT || 10;
const MAX_LIMIT = process.env.MAX_LIMIT || 50;

router.get('/cityId/:id', async (req, res) => {
	const { id } = req.params;
	return models.SubDistrict.findAll({
		where: {
			cityId: id
		}
	})
	.then(async data => {
		res.json({
	        success: true,
	        // pagination,
	        data
	    });
	})
	.catch(err => {
      res.status(422).json({
        success: false,
        errors: err.message
      });
    });
});

module.exports = router;