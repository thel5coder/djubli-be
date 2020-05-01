'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.addColumn('Cars', 'cityId', {
        type: Sequelize.INTEGER
      });
      await queryInterface.addColumn('Cars', 'subdistrictId', {
        type: Sequelize.INTEGER
      });
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.removeColumn('Cars', 'cityId');
      await queryInterface.removeColumn('Cars', 'subdistrictId');
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    }
  }
};