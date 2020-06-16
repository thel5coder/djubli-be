'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.addColumn('BargainReaders', 'carId', {
        type: Sequelize.INTEGER,
        references: { model: 'Cars', key: 'id' }
      });
      await queryInterface.addColumn('BargainReaders', 'type', {
        type: Sequelize.INTEGER
      });
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.removeColumn('BargainReaders', 'carId');
      await queryInterface.removeColumn('BargainReaders', 'type');
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    }
  }
};