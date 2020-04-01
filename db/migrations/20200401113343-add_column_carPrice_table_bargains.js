'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Bargains', 'carPrice', {
      type: Sequelize.NUMERIC
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('Bargains', 'carPrice');
  }
};
