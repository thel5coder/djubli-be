'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Purchases', 'bargainId', {
      type: Sequelize.INTEGER,
      references: { model: 'Bargains', key: 'id' }
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('Purchases', 'bargainId');
  }
};
