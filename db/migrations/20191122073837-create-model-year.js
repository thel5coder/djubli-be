module.exports = {
  up: (queryInterface, Sequelize) =>
    queryInterface.createTable('ModelYears', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      modelId: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      year: {
        type: Sequelize.STRING
      },
      picture: {
        type: Sequelize.STRING
      },
      price: {
        allowNull: false,
        type: Sequelize.NUMERIC
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
  down: queryInterface => queryInterface.dropTable('ModelYears')
};
