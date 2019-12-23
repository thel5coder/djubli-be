/* eslint-disable linebreak-style */
const bcrypt = require('bcryptjs');

module.exports = {
  up: queryInterface => {
    const hashedPassword = bcrypt.hashSync('kiasu123', 10);

    return queryInterface.bulkInsert('Admins', [
      {
        name: `Superadmin`,
        email: 'superadmin@twiscode.com',
        password: hashedPassword,
        isSuperAdmin: true,
        status: true,
        photo: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
  },

  down: queryInterface => queryInterface.bulkDelete('Admins', null, {})
};
