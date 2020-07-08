'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.addColumn('Users', 'cityId', {
        type: Sequelize.INTEGER,
        references: { model: 'Cities', key: 'id' }
      });
      await queryInterface.addColumn('Users', 'subdistrictId', {
        type: Sequelize.INTEGER,
        references: { model: 'SubDistricts', key: 'id' }
      });
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.removeColumn('Users', 'cityId');
      await queryInterface.removeColumn('Users', 'subdistrictId');
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    }
  }
};