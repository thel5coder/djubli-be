'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.renameColumn('Purchases', 'isAccept', 'isAcceptSeller');
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('Purchases', 'isAccept');
  }
};
