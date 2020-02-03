module.exports = {
  up: (queryInterface, Sequelize) =>
    queryInterface.createTable('SubDistricts', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING
      },
      longitude: {
        type: Sequelize.NUMERIC
      },
      latitude: {
        type: Sequelize.NUMERIC
      },
      cityId: {
        type: Sequelize.INTEGER,
        allowNull: false
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
  down: (queryInterface, Sequelize) => queryInterface.dropTable('SubDistricts')
};
