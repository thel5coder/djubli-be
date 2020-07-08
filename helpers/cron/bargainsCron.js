const cron = require('node-cron');
const Sequelize = require('sequelize');
const models = require('../../db/models');

const {
    Op
} = Sequelize;

// let handleExpired = async (condition) => {
// 	const where = {
//         bidType: condition,
// 		expiredAt: {
// 			[Op.lte]: models.sequelize.literal('NOW()')
// 	    }
// 	}

// 	return models.Bargain.destroy({ 
// 		where
// 	}).then(res => {
// 		console.log(`Destroy ${res} Bargains Data!`);
// 	}).catch(err => {
// 		console.log(`ERROR Destroy Bargains Data!`);
// 		console.log(err.message);
// 	});
// }

/* API Masa Berlaku Penawaran */
/* Bid Type: 0; */

// cron.schedule('59 23 * * *', function() {
// 	handleExpired(0);
//   	console.log('Running task handleExpired every day');
// });

/* API Batas Waktu Ajak Nego */
/* Bid Type: 1; */

// cron.schedule('* * * * *', function() {
	// handleExpired(1);
  	// console.log('Running task handleExpired every minute');
// });


// Cron to Notif reddot
// let handleExpired = async () => {
// 	const where = {
// 		expiredAt: {
// 			[Op.lte]: models.sequelize.literal('NOW()')
// 	    }
// 	}

// 	await models.Bargain.findAll({ 
// 		where,
// 		attributes: ['id'],
//     	raw : true
// 	}).then(data => {
// 		console.log(data);
// 	}).catch(err => {
// 		console.log(`ERROR Get Bargains Data!`);
// 		console.log(err.message);
// 	});
// }

// cron.schedule('*/2 * * * *', function() {
// 	handleExpired();
//   	console.log('Running task handleExpired every minute');
// });