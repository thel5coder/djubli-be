const validator = require('validator');
const Sequelize = require('sequelize');
const models = require('../db/models');

const { Op } = Sequelize;
const queryRedDotExpiredAt = (id) => `(EXISTS(SELECT "bs"."id" FROM (SELECT *
    	FROM "Bargains" b
    		WHERE "b"."carId" = "bargain"."carId"
        		AND "b"."deletedAt" IS NULL
    		ORDER BY "b"."createdAt" desc
    	LIMIT 1) AS bs
	WHERE "bs"."expiredAt" < now()
    	AND "bs"."negotiationType" IN (0,1,2,5,6)
    	AND "bs"."userId" = ${id}
))`;

// GET Read Dots
async function getJual(req, res) {
	const { id } = req.user;
	const count = await models.Car.count({
        distinct: true,
        include: [
          	{
            	model: models.Bargain,
            	as: 'bargain',
            	where: {
				    bidType: 1,
				    userId: {
				    	[Op.ne]: id
				    },
				    negotiationType: {
				    	[Op.between]: [0, 6]
				    },
				    [Op.or]: [
				    	{
				    		[Op.and]: models.sequelize.literal(`(SELECT COUNT("BargainReaders"."id") 
						        FROM "BargainReaders" 
						        WHERE "BargainReaders"."carId" = "bargain"."carId"
						            AND "BargainReaders"."bargainId" = "bargain"."id"
						            AND "BargainReaders"."type" = 1
						            AND "BargainReaders"."userId" = ${id}
						            AND "BargainReaders"."deletedAt" IS NULL
						        ) = 0`
						    )
				    	},
				    	{ [Op.and]: models.sequelize.literal(queryRedDotExpiredAt(id)) }
				    ]
				}
          	},
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
        where: {
		    userId: id
		}
    });

	return res.json({
	    success: true,
	    data: { count }
	});
}

async function getJualNego(req, res) {
	const { id } = req.user;
	const count = await models.Car.count({
        distinct: true,
        include: [
          	{
            	model: models.Bargain,
            	as: 'bargain',
            	where: {
				    bidType: 1,
				    userId: {
				    	[Op.ne]: id
				    },
				    negotiationType: {
				    	[Op.between]: [0, 6]
				    },
				    [Op.or]: [
				    	{
				    		[Op.and]: models.sequelize.literal(`(SELECT COUNT("BargainReaders"."id") 
						        FROM "BargainReaders" 
						        WHERE "BargainReaders"."carId" = "bargain"."carId"
						           	AND "BargainReaders"."bargainId" = "bargain"."id"
						           	AND "BargainReaders"."type" = 2
						           	AND "BargainReaders"."userId" = ${id}
						           	AND "BargainReaders"."deletedAt" IS NULL
						        ) = 0`
						    )
				    	},
				    	{ [Op.and]: models.sequelize.literal(queryRedDotExpiredAt(id)) }
				    ]
				}
          	},
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
        where: {
		    userId: id
		}
    });

	return res.json({
	    success: true,
	    data: { count }
	});
}

async function getJualNegoTab(req, res) {
	const { id } = req.user;
	const { negotiationType } = req.query;

	const whereBargain = {
	    bidType: 1,
	    userId: {
			[Op.ne]: id
		}
	};

	const where = {
	    userId: id
	};

	if (negotiationType == '0') {
	    Object.assign(whereBargain, {
	      	negotiationType
	    });

	    // so that it doesn't appear on the "jual->nego->ajak nego" page
	    // when the data is already on the "jual->nego->sedang nego" page
	    Object.assign(where, {
	      	[Op.and]: [
	           	models.sequelize.literal(`(SELECT COUNT("Bargains"."id") 
	            	FROM "Bargains" 
	            	WHERE "Bargains"."carId" = "Car"."id" 
	              		AND "Bargains"."negotiationType" BETWEEN 1 AND 6
	              		AND "Bargains"."deletedAt" IS NULL
	            	) = 0`
	          	)
	      	]
	    });
	} else if (negotiationType == '1') {
	    Object.assign(whereBargain, {
	      	negotiationType: {
	        	[Op.between]: [1, 6]
	      	}
	    });
	}

	Object.assign(whereBargain, {
	    [Op.or]: [
			{
				[Op.and]: models.sequelize.literal(`(SELECT COUNT("BargainReaders"."id") 
					FROM "BargainReaders" 
					WHERE "BargainReaders"."carId" = "bargain"."carId"
						   AND "BargainReaders"."bargainId" = "bargain"."id"
						   AND "BargainReaders"."type" = 3
						   AND "BargainReaders"."userId" = ${id}
						   AND "BargainReaders"."deletedAt" IS NULL
					) = 0`
				)
			},
			{ [Op.and]: models.sequelize.literal(queryRedDotExpiredAt(id)) }
		]
	});

	const count = await models.Car.count({
        distinct: true,
        include: [
          	{
            	model: models.Bargain,
            	as: 'bargain',
            	where: whereBargain
          	},
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
	const count = await models.Car.count({
        distinct: true,
        include: [
          {
            model: models.Bargain,
            as: 'bargain',
            required: true,
            where: {
				bidType: 1,
				userId: {
				    [Op.ne]: id
				},
				[Op.or]: [
					{ negotiationType: null }, 
					{ 
						negotiationType: {
							[Op.between]: [1, 6]
						} 
					}
				],
				[Op.or]: [
			        {
			        	[Op.and]: models.sequelize.literal(`(SELECT COUNT("BargainReaders"."id") 
				            FROM "BargainReaders" 
				            WHERE "BargainReaders"."carId" = "bargain"."carId"
					            AND "BargainReaders"."bargainId" = "bargain"."id"
				            	AND "BargainReaders"."type" = 1
				            	AND "BargainReaders"."userId" = ${id}
				            	AND "BargainReaders"."deletedAt" IS NULL
				            ) = 0`
				        )
			        },
			        { [Op.and]: models.sequelize.literal(queryRedDotExpiredAt(id)) }
			    ]
			}
          },
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
        where:  {
		    userId: {
		      	[Op.ne]: id
		    }
		}
    });

	return res.json({
	    success: true,
	    data: { count }
	});
}

async function getBeliNego(req, res) {
	const { id } = req.user;
	const count = await models.Car.count({
        distinct: true,
        include: [
          {
            model: models.Bargain,
            as: 'bargain',
            required: true,
            where: {
				bidType: 1,
				userId: {
					[Op.ne]: id
				},
				[Op.or]: [
					{ negotiationType: null }, 
					{ 
						negotiationType: {
							[Op.between]: [1, 6]
						} 
					}
				],
				[Op.or]: [
			        {
			        	[Op.and]: models.sequelize.literal(`(SELECT COUNT("BargainReaders"."id") 
				            FROM "BargainReaders" 
				            WHERE "BargainReaders"."carId" = "bargain"."carId"
					            AND "BargainReaders"."bargainId" = "bargain"."id"
				            	AND "BargainReaders"."type" = 2
				            	AND "BargainReaders"."userId" = ${id}
				            	AND "BargainReaders"."deletedAt" IS NULL
				            ) = 0`
				        )
			        },
			        { [Op.and]: models.sequelize.literal(queryRedDotExpiredAt(id)) }
			    ]
			}
          },
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
        where:  {
		    userId: {
		      	[Op.ne]: id
		    }
		}
    });

	return res.json({
	    success: true,
	    data: { count }
	});
}

async function getBeliNegoTab(req, res) {
	const { id } = req.user;
	const { negotiationType } = req.query;

	const whereBargain = {
	    bidType: 1,
	    userId: {
			[Op.ne]: id
		}
	};

	const where = {
	    userId: {
	      	[Op.ne]: id
	    }
	};

	if (negotiationType == '0') {
	    Object.assign(whereBargain, {
	      	[Op.or]: [{ negotiationType: { [Op.is]: null } }, { negotiationType }]
	    });

	    // so that it doesn't appear on the "beli->nego->diajak nego" page
	    // when the data is already on the "beli->nego->sedang nego" page
	    Object.assign(where, {
	      	[Op.and]: [
	           	models.sequelize.literal(`(SELECT COUNT("Bargains"."id") 
	            	FROM "Bargains" 
	            	WHERE "Bargains"."carId" = "Car"."id" 
	              		AND "Bargains"."negotiationType" BETWEEN 1 AND 6
	              		AND "Bargains"."deletedAt" IS NULL
	            	) = 0`
	          	)
	      	]
	    });
  	} else if (negotiationType == '1') {
	    Object.assign(whereBargain, {
	      	negotiationType: {
	        	[Op.between]: [1, 6]
	      	}
	    });
  	}

  	Object.assign(whereBargain, {
	    [Op.or]: [
			{
				[Op.and]: models.sequelize.literal(`(SELECT COUNT("BargainReaders"."id") 
					FROM "BargainReaders" 
					WHERE "BargainReaders"."carId" = "bargain"."carId"
						   AND "BargainReaders"."bargainId" = "bargain"."id"
						   AND "BargainReaders"."type" = 3
						   AND "BargainReaders"."userId" = ${id}
						   AND "BargainReaders"."deletedAt" IS NULL
					) = 0`
				)
			},
			{ [Op.and]: models.sequelize.literal(queryRedDotExpiredAt(id)) }
		]
	});

	const count = await models.Car.count({
        distinct: true,
        include: [
          {
            model: models.Bargain,
            as: 'bargain',
            required: true,
            where: whereBargain
          },
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

// POST Read Dots
async function readJual(req, res) {
	const { id } = req.user;
	const data = await models.Car.findAll({
        distinct: true,
        include: [
          	{
            	model: models.Bargain,
            	as: 'bargain',
            	where: {
				    bidType: 1,
				    userId: {
				    	[Op.ne]: id
				    },
				    negotiationType: {
				    	[Op.between]: [0, 6]
				    },
				    [Op.and]: [
				        models.sequelize.literal(`(SELECT COUNT("BargainReaders"."id") 
				            FROM "BargainReaders" 
				            WHERE "BargainReaders"."carId" = "bargain"."carId"
				            	AND "BargainReaders"."bargainId" = "bargain"."id"
				            	AND "BargainReaders"."type" = 1
				            	AND "BargainReaders"."userId" = ${id}
				            	AND "BargainReaders"."deletedAt" IS NULL
				            ) = 0`
				        )
				    ]
				}
          	},
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
        where: {
		    userId: id
		}
    });

	const trans = await models.sequelize.transaction();
	const result = [];

	await Promise.all(
		data.map(async item => {
	    	await Promise.all(
	    		item.bargain.map(async bargain => {
		    		await models.BargainReader.create(
		    			{
		                	userId: id,
		                	bargainId: bargain.id,
		                	carId: item.id,
		                	type: 1,
		                	isRead: true
		              	}, 
		              	{ transaction: trans }
		            )
		            .then(data => {
		            	result.push(data);
		            })
		            .catch(err => {
						trans.rollback();
						return res.status(422).json({
			                success: false,
			                errors: 'failed to read bargain chat'
						});
		            });
		    	})
	    	);
	    })
	);

	trans.commit();
    return res.json({
	    success: true,
	    data: result
	});
}

async function readJualNego(req, res) {
	const { id } = req.user;
	const data = await models.Car.findAll({
        distinct: true,
        include: [
          	{
            	model: models.Bargain,
            	as: 'bargain',
            	where: {
				    bidType: 1,
				    userId: {
				    	[Op.ne]: id
				    },
				    negotiationType: {
				    	[Op.between]: [0, 6]
				    },
				    [Op.and]: [
				        models.sequelize.literal(`(SELECT COUNT("BargainReaders"."id") 
				            FROM "BargainReaders" 
				            WHERE "BargainReaders"."carId" = "bargain"."carId"
				            	AND "BargainReaders"."bargainId" = "bargain"."id"
				            	AND "BargainReaders"."type" = 2
				            	AND "BargainReaders"."userId" = ${id}
				            	AND "BargainReaders"."deletedAt" IS NULL
				            ) = 0`
				        )
				    ]
				}
          	},
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
        where: {
		    userId: id
		}
    });

	const trans = await models.sequelize.transaction();
	const result = [];

	await Promise.all(
		data.map(async item => {
	    	await Promise.all(
	    		item.bargain.map(async bargain => {
		    		await models.BargainReader.create(
		    			{
		                	userId: id,
		                	bargainId: bargain.id,
		                	carId: item.id,
		                	type: 2,
		                	isRead: true
		              	}, 
		              	{ transaction: trans }
		            )
		            .then(data => {
		            	result.push(data);
		            })
		            .catch(err => {
						trans.rollback();
						return res.status(422).json({
			                success: false,
			                errors: 'failed to read bargain chat'
						});
		            });
		    	})
	    	);
	    })
	);

	trans.commit();
    return res.json({
	    success: true,
	    data: result
	});
}

async function readJualNegoTab(req, res) {
	const { id } = req.user;
	const { negotiationType } = req.body;

	const whereBargain = {
	    bidType: 1,
	    userId: {
			[Op.ne]: id
		},
	    [Op.and]: [
			models.sequelize.literal(`(SELECT COUNT("BargainReaders"."id") 
				FROM "BargainReaders" 
				WHERE "BargainReaders"."carId" = "bargain"."carId"
				    AND "BargainReaders"."bargainId" = "bargain"."id"
				    AND "BargainReaders"."type" = 3
				    AND "BargainReaders"."userId" = ${id}
				    AND "BargainReaders"."deletedAt" IS NULL
				) = 0`
			)
		]
	};

	const where = {
	    userId: id
	};

	if (negotiationType == '0') {
	    Object.assign(whereBargain, {
	      	negotiationType
	    });

	    // so that it doesn't appear on the "jual->nego->ajak nego" page
	    // when the data is already on the "jual->nego->sedang nego" page
	    Object.assign(where, {
	      	[Op.and]: [
	           	models.sequelize.literal(`(SELECT COUNT("Bargains"."id") 
	            	FROM "Bargains" 
	            	WHERE "Bargains"."carId" = "Car"."id" 
	              		AND "Bargains"."negotiationType" BETWEEN 1 AND 6
	              		AND "Bargains"."deletedAt" IS NULL
	            	) = 0`
	          	)
	      	]
	    });
	} else if (negotiationType == '1') {
	    Object.assign(whereBargain, {
	      	negotiationType: {
	        	[Op.between]: [1, 6]
	      	}
	    });
	}

	const data = await models.Car.findAll({
        distinct: true,
        include: [
          	{
            	model: models.Bargain,
            	as: 'bargain',
            	where: whereBargain
          	},
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

	const trans = await models.sequelize.transaction();
	const result = [];

	await Promise.all(
		data.map(async item => {
	    	await Promise.all(
	    		item.bargain.map(async bargain => {
		    		await models.BargainReader.create(
		    			{
		                	userId: id,
		                	bargainId: bargain.id,
		                	carId: item.id,
		                	type: 3,
		                	isRead: true
		              	}, 
		              	{ transaction: trans }
		            )
		            .then(data => {
		            	result.push(data);
		            })
		            .catch(err => {
						trans.rollback();
						return res.status(422).json({
			                success: false,
			                errors: 'failed to read bargain chat'
						});
		            });
		    	})
	    	);
	    })
	);

	trans.commit();
    return res.json({
	    success: true,
	    data: result
	});
}

async function readBeli(req, res) {
	const { id } = req.user;
	const data = await models.Car.findAll({
        distinct: true,
        include: [
          {
            model: models.Bargain,
            as: 'bargain',
            required: true,
            where: {
				bidType: 1,
				userId: {
				    [Op.ne]: id
				},
				[Op.or]: [
					{ negotiationType: null }, 
					{ 
						negotiationType: {
							[Op.between]: [1, 6]
						} 
					}
				],
				[Op.and]: [
			        models.sequelize.literal(`(SELECT COUNT("BargainReaders"."id") 
			            FROM "BargainReaders" 
			            WHERE "BargainReaders"."carId" = "bargain"."carId"
				            AND "BargainReaders"."bargainId" = "bargain"."id"
			            	AND "BargainReaders"."type" = 1
			            	AND "BargainReaders"."userId" = ${id}
			            	AND "BargainReaders"."deletedAt" IS NULL
			            ) = 0`
			        )
			    ]
			}
          },
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
        where:  {
		    userId: {
		      	[Op.ne]: id
		    }
		}
    });

	const trans = await models.sequelize.transaction();
	const result = [];

	await Promise.all(
		data.map(async item => {
	    	await Promise.all(
	    		item.bargain.map(async bargain => {
		    		await models.BargainReader.create(
		    			{
		                	userId: id,
		                	bargainId: bargain.id,
		                	carId: item.id,
		                	type: 1,
		                	isRead: true
		              	}, 
		              	{ transaction: trans }
		            )
		            .then(data => {
		            	result.push(data);
		            })
		            .catch(err => {
						trans.rollback();
						return res.status(422).json({
			                success: false,
			                errors: 'failed to read bargain chat'
						});
		            });
		    	})
	    	);
	    })
	);

	trans.commit();
    return res.json({
	    success: true,
	    data: result
	});
}

async function readBeliNego(req, res) {
	const { id } = req.user;
	const data = await models.Car.findAll({
        distinct: true,
        include: [
          {
            model: models.Bargain,
            as: 'bargain',
            required: true,
            where: {
				bidType: 1,
				userId: {
					[Op.ne]: id
				},
				[Op.or]: [
					{ negotiationType: null }, 
					{ 
						negotiationType: {
							[Op.between]: [1, 6]
						} 
					}
				],
				[Op.and]: [
			        models.sequelize.literal(`(SELECT COUNT("BargainReaders"."id") 
			            FROM "BargainReaders" 
			            WHERE "BargainReaders"."carId" = "bargain"."carId"
				            AND "BargainReaders"."bargainId" = "bargain"."id"
			            	AND "BargainReaders"."type" = 2
			            	AND "BargainReaders"."userId" = ${id}
			            	AND "BargainReaders"."deletedAt" IS NULL
			            ) = 0`
			        )
			    ]
			}
          },
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
        where:  {
		    userId: {
		      	[Op.ne]: id
		    }
		}
    });

	const trans = await models.sequelize.transaction();
	const result = [];

	await Promise.all(
		data.map(async item => {
	    	await Promise.all(
	    		item.bargain.map(async bargain => {
		    		await models.BargainReader.create(
		    			{
		                	userId: id,
		                	bargainId: bargain.id,
		                	carId: item.id,
		                	type: 2,
		                	isRead: true
		              	}, 
		              	{ transaction: trans }
		            )
		            .then(data => {
		            	result.push(data);
		            })
		            .catch(err => {
						trans.rollback();
						return res.status(422).json({
			                success: false,
			                errors: 'failed to read bargain chat'
						});
		            });
		    	})
	    	);
	    })
	);

	trans.commit();
    return res.json({
	    success: true,
	    data: result
	});
}

async function readBeliNegoTab(req, res) {
	const { id } = req.user;
	const { negotiationType } = req.body;

	const whereBargain = {
	    bidType: 1,
	    userId: {
			[Op.ne]: id
		},
	    [Op.and]: [
			models.sequelize.literal(`(SELECT COUNT("BargainReaders"."id") 
			    FROM "BargainReaders" 
			    WHERE "BargainReaders"."carId" = "bargain"."carId"
					AND "BargainReaders"."bargainId" = "bargain"."id"
					AND "BargainReaders"."type" = 3
					AND "BargainReaders"."userId" = ${id}
					AND "BargainReaders"."deletedAt" IS NULL
			    ) = 0`
			)
		]
	};

	const where = {
	    userId: {
	      	[Op.ne]: id
	    }
	};

	if (negotiationType == '0') {
	    Object.assign(whereBargain, {
	      	[Op.or]: [{ negotiationType: { [Op.is]: null } }, { negotiationType }]
	    });

	    // so that it doesn't appear on the "beli->nego->diajak nego" page
	    // when the data is already on the "beli->nego->sedang nego" page
	    Object.assign(where, {
	      	[Op.and]: [
	           	models.sequelize.literal(`(SELECT COUNT("Bargains"."id") 
	            	FROM "Bargains" 
	            	WHERE "Bargains"."carId" = "Car"."id" 
	              		AND "Bargains"."negotiationType" BETWEEN 1 AND 6
	              		AND "Bargains"."deletedAt" IS NULL
	            	) = 0`
	          	)
	      	]
	    });
  	} else if (negotiationType == '1') {
	    Object.assign(whereBargain, {
	      	negotiationType: {
	        	[Op.between]: [1, 6]
	      	}
	    });
  	}

	const data = await models.Car.findAll({
        distinct: true,
        include: [
          {
            model: models.Bargain,
            as: 'bargain',
            required: true,
            where: whereBargain
          },
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

	const trans = await models.sequelize.transaction();
	const result = [];

	await Promise.all(
		data.map(async item => {
	    	await Promise.all(
	    		item.bargain.map(async bargain => {
		    		await models.BargainReader.create(
		    			{
		                	userId: id,
		                	bargainId: bargain.id,
		                	carId: item.id,
		                	type: 3,
		                	isRead: true
		              	}, 
		              	{ transaction: trans }
		            )
		            .then(data => {
		            	result.push(data);
		            })
		            .catch(err => {
						trans.rollback();
						return res.status(422).json({
			                success: false,
			                errors: 'failed to read bargain chat'
						});
		            });
		    	})
	    	);
	    })
	);

	trans.commit();
    return res.json({
	    success: true,
	    data: result
	});
}

module.exports = {
  	getJual,
  	getJualNego,
  	getJualNegoTab,
  	getBeli,
  	getBeliNego,
  	getBeliNegoTab,

  	readJual,
  	readJualNego,
  	readJualNegoTab,
  	readBeli,
	readBeliNego,
	readBeliNegoTab
};
