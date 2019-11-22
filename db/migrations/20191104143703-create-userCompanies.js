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
        allowNull: false,
        type: Sequelize.INTEGER
      },
      phone: Sequelize.STRING(100),
      fax: Sequelize.STRING(100),
      email: {
        allowNull: false,
        type: Sequelize.STRING(100)
      },
      emailValidAt: Sequelize.DATE,
      website: Sequelize.TEXT,
      lineOfBusiness: {
        allowNull: false,
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
  down: queryInterface => queryInterface.dropTable('UserCompanies')
};
