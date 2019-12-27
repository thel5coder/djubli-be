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
      }
    ]),

  down: queryInterface => queryInterface.bulkDelete('GroupModels', null, {})
};
