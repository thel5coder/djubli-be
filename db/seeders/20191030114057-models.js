/* eslint-disable linebreak-style */

module.exports = {
  up: queryInterface =>
    queryInterface.bulkInsert('Models', [
      {
        id: 1,
        name: `2.5 G`,
        groupModelId: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 2,
        name: `2.0 G`,
        groupModelId: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 3,
        name: `1.3 G`,
        groupModelId: 2,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 4,
        name: `1.5 S`,
        groupModelId: 2,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 5,
        name: `RS CVT`,
        groupModelId: 3,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 6,
        name: `GK 5`,
        groupModelId: 3,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 7,
        name: `RS`,
        groupModelId: 4,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 8,
        name: `E CVT`,
        groupModelId: 4,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]),

  down: queryInterface => queryInterface.bulkDelete('Models', null, {})
};
