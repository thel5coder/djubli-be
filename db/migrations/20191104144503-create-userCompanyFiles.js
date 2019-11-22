module.exports = {
  up: (queryInterface, Sequelize) =>
    queryInterface.createTable('UserCompanyFiles', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userCompanyId: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      fileId: {
        allowNull: false,
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
  down: queryInterface => queryInterface.dropTable('UserCompanyFiles')
};
