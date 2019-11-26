module.exports = {
  up: (queryInterface, Sequelize) =>
    queryInterface.createTable('UserCompanies', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userId: {
        type: Sequelize.INTEGER
      },
      phone: {
        type: Sequelize.STRING(100)
      },
      fax: {
        type: Sequelize.STRING(100)
      },
      email: {
        type: Sequelize.STRING(100)
      },
      emailValidAt: {
        type: Sequelize.DATE
      },
      website: {
        type: Sequelize.TEXT
      },
      lineOfBusiness: {
        type: Sequelize.STRING
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      deletedAt: Sequelize.DATE
    }),
  down: (queryInterface, Sequelize) => queryInterface.dropTable('UserCompanies')
};
