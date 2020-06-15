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
	let { sort, by } = req.query;

	if (!by) by = 'createdAt';
  	let order = [['createdAt', 'desc']];

	if (!sort) sort = 'asc';
  	else if (sort !== 'asc' && sort !== 'desc') sort = 'asc';

  	if (by === 'createdAt') {
  		order = [[by, sort]];
  	} else if(by === 'countCar') {
  		order = [[models.sequelize.literal('"countCar"'), sort]];
  	} else if(by === 'address') {
  		order = [[{ model: models.User, as: 'user' }, models.sequelize.col('address'), sort]];
  	}

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
			        'countListing'
	    		],
	    		[
			        models.sequelize.literal(
			          	`(COALESCE(NULLIF((SELECT "GroupModels"."name"
							FROM "GroupModels"
							WHERE "GroupModels"."deletedAt" IS NULL
							    AND (SELECT COUNT("Cars"."id") 
							        FROM "Cars" 
							        WHERE "Cars"."userId" = "Company"."userId" 
							            AND "Cars"."groupModelId" = "GroupModels"."id"
							            AND "Cars"."deletedAt" IS NULL) > 0
							ORDER BY (SELECT COUNT("Cars"."id") 
							    FROM "Cars" 
							    WHERE "Cars"."userId" = 10 
							        AND "Cars"."groupModelId" = "GroupModels"."id"
							        AND "Cars"."deletedAt" IS NULL) DESC 
							LIMIT 1
						), ''), ''))`
			        ),
			        'groupModelMostListing'
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
	    },
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
}

async function getById(req, res) {
	const { id } = req.params;

	return models.Company.findByPk(id, {
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
	    ]
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
  getByBusinessType,
  getById
};