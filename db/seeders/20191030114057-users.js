/* eslint-disable linebreak-style */
const bcrypt = require('bcryptjs');

module.exports = {
  up: queryInterface => {
    const hashedPassword = bcrypt.hashSync('kiasu123', 10);

    return queryInterface.bulkInsert('Users', [
      {
        id: 1,
        name: `Twiscode Owner`,
        email: `owner@twiscode.com`,
        emailValidAt: new Date(),
        phone: `6282232189987`,
        phoneValidAt: new Date(),
        password: hashedPassword,
        profileImageId: null,
        companyType: null,
        status: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 2,
        profileImageId: null,
        companyType: null,
        name: `Twiscode Admin`,
        email: `admin@twiscode.com`,
        emailValidAt: new Date(),
        phone: `6282232189987`,
        phoneValidAt: new Date(),
        password: hashedPassword,
        status: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 3,
        profileImageId: null,
        companyType: null,
        name: `Twiscode Manager`,
        email: `manager@twiscode.com`,
        emailValidAt: new Date(),
        phone: `6282232189987`,
        phoneValidAt: new Date(),
        password: hashedPassword,
        status: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 4,
        profileImageId: null,
        companyType: null,
        name: `Twiscode Sales Person 1`,
        email: `sales1@twiscode.com`,
        emailValidAt: new Date(),
        phone: `6282232189987`,
        phoneValidAt: new Date(),
        password: hashedPassword,
        status: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 5,
        profileImageId: null,
        companyType: null,
        name: `Twiscode Sales Person 2`,
        email: `sales2@twiscode.com`,
        emailValidAt: new Date(),
        phone: `6282232189987`,
        phoneValidAt: new Date(),
        password: hashedPassword,
        status: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 6,
        profileImageId: null,
        companyType: null,
        name: `Twiscode Pro Owner`,
        email: `owner@twiscodepro.com`,
        emailValidAt: new Date(),
        phone: `6282232189987`,
        phoneValidAt: new Date(),
        password: hashedPassword,
        status: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 7,
        profileImageId: null,
        companyType: null,
        name: `Twiscode Pro Admin`,
        email: `admin@twiscodepro.com`,
        emailValidAt: new Date(),
        phone: `6282232189987`,
        phoneValidAt: new Date(),
        password: hashedPassword,
        status: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 8,
        profileImageId: null,
        companyType: null,
        name: `Twiscode Pro Manager`,
        email: `manager@twiscodepro.com`,
        emailValidAt: new Date(),
        phone: `6282232189987`,
        phoneValidAt: new Date(),
        password: hashedPassword,
        status: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 9,
        profileImageId: null,
        companyType: null,
        name: `Twiscode Pro Sales Person 1`,
        email: `sales1@twiscodepro.com`,
        emailValidAt: new Date(),
        phone: `6282232189987`,
        phoneValidAt: new Date(),
        password: hashedPassword,
        status: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 10,
        profileImageId: null,
        companyType: null,
        name: `Twiscode Pro Sales Person 2`,
        email: `sales2@twiscodepro.com`,
        emailValidAt: new Date(),
        phone: `6282232189987`,
        phoneValidAt: new Date(),
        password: hashedPassword,
        status: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
  },

  down: queryInterface => queryInterface.bulkDelete('Users', null, {})
};
