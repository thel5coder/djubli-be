'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Bargains', 'isExtend', {
      type: Sequelize.BOOLEAN
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('Bargains', 'isExtend');
  }
};
