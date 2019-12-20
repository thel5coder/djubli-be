module.exports = {
  up: (queryInterface, Sequelize) =>
    queryInterface.createTable('MeetingSchedules', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      carId: {
        type: Sequelize.INTEGER
      },
      day: {
        type: Sequelize.INTEGER
      },
      startTime: {
        type: Sequelize.TIME
      },
      endTime: {
        type: Sequelize.TIME
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
  down: (queryInterface, Sequelize) => queryInterface.dropTable('MeetingSchedules')
};
