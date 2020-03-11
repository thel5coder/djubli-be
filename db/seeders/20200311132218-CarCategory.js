'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.bulkInsert(
      'CarCategories',
      [
        {
          name: 'Sedan',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          name: 'LCGG',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          name: 'City Car',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          name: 'Coupe',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          name: 'Sports',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          name: 'Jeep',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          name: 'Mobil Listrik',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ],
      {}
    );
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete('CarCategories', null, {});
  }
};
