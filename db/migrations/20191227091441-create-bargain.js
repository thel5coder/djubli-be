module.exports = {
  up: (queryInterface, Sequelize) =>
    queryInterface.createTable('Bargains', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userId: {
        type: Sequelize.INTEGER
      },
      bidderId: {
        type: Sequelize.INTEGER
      },
      carId: {
        type: Sequelize.INTEGER
      },
      bidAmount: {
        type: Sequelize.NUMERIC
      },
      haveSeenCar: {
        type: Sequelize.BOOLEAN
      },
      paymentMethod: {
        type: Sequelize.INTEGER
      },
      expiredAt: {
        type: Sequelize.DATE
      },
      comment: {
        type: Sequelize.STRING
      },
      bidType: {
        type: Sequelize.INTEGER
      },
      negotiationType: {
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
  down: (queryInterface, Sequelize) => queryInterface.dropTable('Bargains')
};
