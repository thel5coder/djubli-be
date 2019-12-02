module.exports = {
  up: (queryInterface, Sequelize) =>
    queryInterface.createTable('ExteriorGaleries', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      fileId: {
        type: Sequelize.INTEGER
      },
      carId: {
        type: Sequelize.INTEGER
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
  down: (queryInterface, Sequelize) => queryInterface.dropTable('ExteriorGaleries')
};
