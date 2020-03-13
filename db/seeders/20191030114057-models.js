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
      },
      {
        id: 9,
        name: `V`,
        groupModelId: 5,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 10,
        name: `D`,
        groupModelId: 6,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 11,
        name: `GLXM`,
        groupModelId: 7,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 12,
        name: `GT`,
        groupModelId: 8,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 13,
        name: `E Grade`,
        groupModelId: 9,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 14,
        name: `650`,
        groupModelId: 9,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 15,
        name: `JK`,
        groupModelId: 11,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 16,
        name: `PHEV`,
        groupModelId: 12,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]),

  down: queryInterface => queryInterface.bulkDelete('Models', null, {})
};
