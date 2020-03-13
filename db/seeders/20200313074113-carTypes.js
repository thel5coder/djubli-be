'use strict';

module.exports = {
  up: queryInterface =>
    queryInterface.bulkInsert('Types', [
      {
        name: `SUV`,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: `MPV`,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: `Sedan`,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: `LCGG`,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: `City Car`,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: `Coupe`,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: `Hatchback`,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: `Sports`,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: `Jeep`,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: `Mobil Listrik`,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]),

  down: queryInterface => queryInterface.bulkDelete('Types', null, {})
};
