/* eslint-disable linebreak-style */

module.exports = {
  up: queryInterface =>
    queryInterface.bulkInsert('GroupModels', [
      {
        id: 1,
        name: `Innova`,
        brandId: 1,
        typeId: 2,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 2,
        name: `Avanza`,
        brandId: 1,
        typeId: 2,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 3,
        name: `Jazz`,
        brandId: 2,
        typeId: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 4,
        name: `Mobilio`,
        brandId: 2,
        typeId: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 5,
        name: `Corolla Altis`,
        brandId: 1,
        typeId: 3,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 6,
        name: `Go`,
        brandId: 3,
        typeId: 4,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 7,
        name: `Mirage`,
        brandId: 4,
        typeId: 5,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 8,
        name: `570`,
        brandId: 5,
        typeId: 6,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 9,
        name: `Yaris`,
        brandId: 1,
        typeId: 7,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 10,
        name: `Corvette`,
        brandId: 6,
        typeId: 8,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 11,
        name: `Wrangler`,
        brandId: 7,
        typeId: 9,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 12,
        name: `Outlander`,
        brandId: 4,
        typeId: 10,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]),

  down: queryInterface => queryInterface.bulkDelete('GroupModels', null, {})
};
