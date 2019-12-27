/* eslint-disable linebreak-style */

module.exports = {
  up: queryInterface =>
    queryInterface.bulkInsert('Brands', [
      {
        id: 1,
        name: `Toyota`,
        logo: ``,
        status: ``,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 2,
        name: `Honda`,
        logo: ``,
        status: ``,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]),

  down: queryInterface => queryInterface.bulkDelete('Brands', null, {})
};
