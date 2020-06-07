const validator = require('validator');
const Sequelize = require('sequelize');
const supertest = require('supertest');
const models = require('../db/models');
const paginator = require('../helpers/paginator');

const { Op } = Sequelize;

const DEFAULT_LIMIT = process.env.DEFAULT_LIMIT || 10;
const MAX_LIMIT = process.env.MAX_LIMIT || 50;

async function getBusinessType(req, res) {
	return models.Company.findAll({
	    attributes: {
	    	exclude: ['id', 'userId', 'website', 'fax', 'createdAt', 'updatedAt', 'deletedAt'],
	    	include: [
	    		[
	    			models.sequelize.literal(`COUNT(*)`),
			          'countMitra'
	    		]
	    	]
	    },
	    where: {
	    	businessType: {
	    		[Op.and]: [
	    			{ [Op.not]: null },
	    			{ [Op.not]: '' }
	    		]
	    	}
	    },
	    group: ['businessType']
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
}

async function getByBusinessType(req, res) {
	const { businessType } = req.query;

	if(!businessType) {
		return res.status(400).json({
	      	success: false,
	      	errors: 'businessType is mandatory'
	    });
	}

	return models.Company.findAll({
	    attributes: {
	    	include: [
	    		[
	    			models.sequelize.literal(`(SELECT COUNT("Car"."id") 
	    				FROM "Cars" as "Car" 
	    				WHERE "Car"."userId" = "Company"."userId" 
	    					AND "Car"."deletedAt" IS NULL)`),
			        'countCar'
	    		]
	    	]
	    },
	    include: [
	    	{
	    		model: models.User,
	    		as: 'user',
	    		attributes: ['id', 'name', 'email', 'phone', 'address', 'type', 'companyType'],
	    		include: [
	    			{
	    				model: models.Dealer,
	    				as: 'dealer',
	    				attributes: {
				        	exclude: ['createdAt', 'updatedAt', 'deletedAt']
				        }
	    			}
	    		]
	    	}
	    ],
	    where: {
	    	businessType
	    }
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
}

module.exports = {
  getBusinessType,
  getByBusinessType
};