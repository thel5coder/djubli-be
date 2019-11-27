module.exports = {
  up: (queryInterface, Sequelize) =>
    queryInterface.createTable('Dealers', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      authorizedBrandId: {
        type: Sequelize.INTEGER
      },
      website: {
        type: Sequelize.STRING(100)
      },
      productType: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      fax: {
        type: Sequelize.STRING(100)
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
  down: (queryInterface, Sequelize) => queryInterface.dropTable('Dealers')
};
