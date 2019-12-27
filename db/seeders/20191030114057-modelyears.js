/* eslint-disable linebreak-style */

module.exports = {
  up: queryInterface =>
    queryInterface.bulkInsert('ModelYears', [
      {
        id: 1,
        year: 2001,
        picture: ``,
        modelId: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 2,
        year: 2008,
        picture: ``,
        modelId: 2,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 3,
        year: 2007,
        picture: ``,
        modelId: 3,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 4,
        year: 2011,
        picture: ``,
        modelId: 4,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 5,
        year: 2019,
        picture: ``,
        modelId: 5,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 6,
        year: 2011,
        picture: ``,
        modelId: 6,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 7,
        year: 2019,
        picture: ``,
        modelId: 7,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 8,
        year: 2018,
        picture: ``,
        modelId: 8,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]),

  down: queryInterface => queryInterface.bulkDelete('ModelYears', null, {})
};
