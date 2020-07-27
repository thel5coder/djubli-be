const validator = require('validator');
const Sequelize = require('sequelize');
const models = require('../db/models');

const { Op } = Sequelize;
const queryRedDotExpiredAt = (id, table = 'bargain') => `(EXISTS(SELECT "bs"."id" FROM (SELECT *
    	FROM "Bargains" b
    		WHERE "b"."carId" = "${table}"."carId"
        		AND "b"."deletedAt" IS NULL
    		ORDER BY "b"."createdAt" desc
    	LIMIT 1) AS bs
	WHERE "bs"."expiredAt" < now()
    	AND "bs"."negotiationType" IN (0,1,2,5,6)
    	AND "bs"."userId" = ${id}
))`;

const whereQueryBargain = (id, customWhere) => `(SELECT COUNT("bc"."id")
	FROM (SELECT * 
		FROM "Bargains"
		WHERE "Bargains"."deletedAt" IS NULL
		    AND "Bargains"."carId" = "Car"."id"
		ORDER BY "Bargains"."createdAt" DESC
		LIMIT 1) AS bc
	WHERE "bc"."userId" <> ${id}
		${customWhere}
		AND (SELECT COUNT("BargainReaders"."id") 
			FROM "BargainReaders" 
			WHERE "BargainReaders"."carId" = "Car"."id"
				AND "BargainReaders"."bargainId" = "bc"."id"
				AND "BargainReaders"."userId" = ${id}
				AND "BargainReaders"."deletedAt" IS NULL
		) = 0
) > 0`;

// GET Read Dots
async function getJual(req, res) {
	const { id } = req.user;
	const { bidType } = req.query;
	const where = {
		userId: id,
	}

	if(typeof bidType === 'undefined') {
		Object.assign(where, {
			[Op.and]: models.sequelize.literal(whereQueryBargain(id, 'AND "bc"."bidType" = 1'))
		});
	}

	if(bidType == 0) {
		Object.assign(where, {
			[Op.and]: models.sequelize.literal(whereQueryBargain(id, `AND "bc"."bidType" = 1
				AND "bc"."negotiationType" = 0
			`))
		});
	} else if(bidType == 1) {
		Object.assign(where, {
			[Op.and]: models.sequelize.literal(whereQueryBargain(id, `AND "bc"."bidType" = 1 
				AND "bc"."negotiationType" > 0
			`))
		});
	}

	const count = await models.Car.count({
        distinct: true,
        include: [
          	{
            	model: models.Room,
            	as: 'room',
            	where: models.sequelize.where(
	              	models.sequelize.literal(
	                	`(SELECT COUNT( "RoomMembers"."id" ) 
	                		FROM "RoomMembers" 
	                		WHERE "RoomMembers"."roomId" = "room"."id" 
	                			AND "RoomMembers"."userId" <> ${id}
	                	)`
	              	),
              		{ [Op.gt]: 0 }
            	)
          	}
        ],
        where
    });

	return res.json({
	    success: true,
	    data: { count }
	});
}

async function getBeli(req, res) {
	const { id } = req.user;
	const { bidType } = req.query;
	const where = {
		userId: {
		    [Op.ne]: id
		}
	};

	if(typeof bidType === 'undefined') {
		Object.assign(where, {
			[Op.and]: models.sequelize.literal(whereQueryBargain(id, 'AND "bc"."bidType" = 1'))
		});
	}

	if(bidType == 0) {
		Object.assign(where, {
			[Op.and]: models.sequelize.literal(whereQueryBargain(id, `AND "bc"."bidType" = 1
				AND "bc"."negotiationType" = 0
			`))
		});
	} else if(bidType == 1) {
		Object.assign(where, {
			[Op.and]: models.sequelize.literal(whereQueryBargain(id, `AND "bc"."bidType" = 1 
				AND "bc"."negotiationType" > 0
			`))
		});
	}

	const count = await models.Car.count({
        distinct: true,
        include: [
          	{
            	model: models.Room,
	            as: 'room',
	            where: models.sequelize.where(
	              models.sequelize.literal(
	                `(SELECT COUNT( "RoomMembers"."id" ) 
	                	FROM "RoomMembers" 
	                	WHERE "RoomMembers"."roomId" = "room"."id" 
	                		AND "RoomMembers"."userId" = ${id}
	                	)`
	              ),
	              { [Op.gt]: 0 }
	            )
          	}
        ],
        where
    });

	return res.json({
	    success: true,
	    data: { count }
	});
}

module.exports = {
  	getJual,
  	getBeli
};
