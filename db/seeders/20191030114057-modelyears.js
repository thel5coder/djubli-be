/* eslint-disable linebreak-style */

module.exports = {
  up: queryInterface =>
    queryInterface.bulkInsert('ModelYears', [
      {
        id: 1,
        year: 2001,
        picture: ``,
        price: 141200000,
        modelId: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 2,
        year: 2008,
        picture: ``,
        price: 109500000,
        modelId: 2,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 3,
        year: 2007,
        picture: ``,
        price: 90000000,
        modelId: 3,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 4,
        year: 2011,
        picture: ``,
        price: 99500000,
        modelId: 4,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 5,
        year: 2019,
        picture: ``,
        price: 236000000,
        modelId: 5,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 6,
        year: 2011,
        picture: ``,
        price: 140000000,
        modelId: 6,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 7,
        year: 2019,
        picture: ``,
        price: 259000000,
        modelId: 7,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 8,
        year: 2018,
        picture: ``,
        price: 160000000,
        modelId: 8,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]),

  down: queryInterface => queryInterface.bulkDelete('ModelYears', null, {})
};
