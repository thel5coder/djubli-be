/* eslint-disable linebreak-style */

module.exports = {
  up: queryInterface =>
    queryInterface.bulkInsert('Types', [
      {
        id: 1,
        name: `SUV`,
        status: 'true',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 2,
        name: `MPV`,
        status: 'true',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]),

  down: queryInterface => queryInterface.bulkDelete('Types', null, {})
};
