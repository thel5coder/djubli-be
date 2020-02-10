/* API Masa Berlaku Penawaran */


const Sequelize = require('sequelize');
const cron = require('node-cron');
const models = require('../../db/models');

const {
    Op
} = Sequelize;

let handleExpired = async (condition) => {
	const where = {
        bidType: condition,
		expiredAt: {
			[Op.lte]: models.sequelize.literal('NOW()')
	    }
	}

	let dataExpired = await models.Bargain.findAll({
		attributes: ['id'],
		where
	});

	if(dataExpired.length) {
		let arrId = [];
		dataExpired.map(item => {
			arrId.push(item.id);
		});

		return models.Bargain.destroy({ 
				where: { id: arrId }
			}).then(res => {
				console.log(`Destroy ${res} Bargains Data!`);
		    })
		    .catch(err => {
		    	console.log(`ERROR Destroy Bargains Data!`);
		    	console.log(err.message);
		    });
	}

	return;
}

cron.schedule('59 23 * * *', function() {
	handleExpired(0);
  	console.log('Running task handleExpired every day');
});

cron.schedule('* * * * *', function() {
	handleExpired(1);
  	console.log('Running task handleExpired every minute');
});