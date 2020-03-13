/* eslint-disable linebreak-style */

module.exports = {
  up: queryInterface =>
    queryInterface.bulkInsert('ModelYears', [
      {
        id: 1,
        year: 2001,
        price: 141200000,
        modelId: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 2,
        year: 2008,
        price: 109500000,
        modelId: 2,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 3,
        year: 2007,
        price: 90000000,
        modelId: 3,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 4,
        year: 2011,
        price: 99500000,
        modelId: 4,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 5,
        year: 2019,
        price: 236000000,
        modelId: 5,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 6,
        year: 2011,
        price: 140000000,
        modelId: 6,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 7,
        year: 2019,
        price: 259000000,
        modelId: 7,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 8,
        year: 2018,
        price: 160000000,
        modelId: 8,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 9,
        year: 2018,
        price: 160000000,
        modelId: 9,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 10,
        year: 2018,
        price: 160000000,
        modelId: 10,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 11,
        year: 2018,
        price: 160000000,
        modelId: 11,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 12,
        year: 2018,
        price: 160000000,
        modelId: 12,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 13,
        year: 2018,
        price: 160000000,
        modelId: 13,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 14,
        year: 2018,
        price: 160000000,
        modelId: 14,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 15,
        year: 2018,
        price: 160000000,
        modelId: 15,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 16,
        year: 2018,
        price: 160000000,
        modelId: 16,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]),

  down: queryInterface => queryInterface.bulkDelete('ModelYears', null, {})
};
