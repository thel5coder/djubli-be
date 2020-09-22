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
	let { sort } = req.query;
	const { 
		name, 
		by,
		brandId, 
		modelId, 
		groupModelId, 
		exteriorColorId, 
		interiorColorId
	} = req.query;

	let order = [['createdAt', 'desc']];
  	if (!sort) sort = 'asc';
  	else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';

  	if (by === 'name') order = [[by, sort]];
  	if (by === 'countResult') order = [[models.sequelize.literal('"countResult"'), sort]];	

  	let whereCar = '';
  	const where = {
  		cityId: id
  	};

	if(name) {
	    Object.assign(where, {
	      	name: {
	        	[Op.iLike]: `%${name}%`
	      	}
	    });
	}

	if(brandId) {
    	whereCar += ` AND "Car"."brandId" = ${brandId}`;
  	}

  	if(modelId) {
    	whereCar += ` AND "Car"."modelId" = ${modelId}`;
  	}

  	if(groupModelId) {
    	whereCar += ` AND "Car"."groupModelId" = ${groupModelId}`;
  	}

  	if(exteriorColorId) {
    	whereCar += ` AND "Car"."exteriorColorId" = ${exteriorColorId}`;
  	}

  	if(interiorColorId) {
    	whereCar += ` AND "Car"."interiorColorId" = ${interiorColorId}`;
  	}

	return models.SubDistrict.findAll({
		attributes: {
	      	include: [
		        [
			        models.sequelize.literal(`(SELECT COUNT("Car"."id") 
			            FROM "Cars" as "Car" 
			            WHERE "Car"."subdistrictId" = "SubDistrict"."id"
			              	AND "Car"."status" = 0
			              	AND "Car"."deletedAt" IS NULL
			              	${whereCar}
			        )`),
			        'countResult'
		        ]
	      	]
	    },
		where,
		order
	})
	.then(async data => {
		res.json({
	        success: true,
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