module.exports = {
  up: (queryInterface, Sequelize) =>
    queryInterface.createTable('UserEndUserCreditCardDetails', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userId: {
        type: Sequelize.INTEGER
      },
      brand: {
        type: Sequelize.STRING
      },
      bank: {
        type: Sequelize.STRING
      },
      type: {
        type: Sequelize.STRING
      },
      usedFrom: {
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
  down: (queryInterface, Sequelize) => queryInterface.dropTable('UserEndUserCreditCardDetails')
};
