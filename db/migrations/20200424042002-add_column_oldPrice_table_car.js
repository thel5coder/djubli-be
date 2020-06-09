'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Cars', 'oldPrice', {
      type: Sequelize.NUMERIC
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('Cars', 'oldPrice');
  }
};
