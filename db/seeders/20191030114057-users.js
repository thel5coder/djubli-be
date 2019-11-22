const bcrypt = require('bcryptjs');

module.exports = {
  up: queryInterface => {
    const hashedPassword = bcrypt.hashSync('kiasu123', 10);

    return queryInterface.bulkInsert('Users', [
      {
        id: 1,
        companyId: 1,
        roleId: 1,
        name: `Twiscode Owner`,
        email: `owner@twiscode.com`,
        emailValidAt: new Date(),
        phone: `6282232189987`,
        phoneValidAt: new Date(),
        password: hashedPassword,
        status: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 2,
        companyId: 1,
        roleId: 2,
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
        companyId: 1,
        roleId: 3,
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
        companyId: 1,
        roleId: 4,
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
        companyId: 1,
        roleId: 4,
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
        companyId: 1,
        roleId: 1,
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
        companyId: 1,
        roleId: 2,
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
        companyId: 1,
        roleId: 3,
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
        companyId: 1,
        roleId: 4,
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
        companyId: 1,
        roleId: 4,
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
