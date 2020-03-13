/* eslint-disable linebreak-style */

module.exports = {
  up: queryInterface =>
    queryInterface.bulkInsert('Brands', [
      {
        name: `Toyota`,
        logo: `djublee/images/clientCompany/64601577440885179Toyota-Logo-Free-Download-PNG.png`,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: `Honda`,
        logo: `djublee/images/clientCompany/09801577440914558Honda-logo.png`,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: `Datsun`,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: `Mitsubishi`,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: `McLaren`,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: `Chevrolet`,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: `Jeep`,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]),

  down: queryInterface => queryInterface.bulkDelete('Brands', null, {})
};
