'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('Notifications', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userId: {
        type: Sequelize.INTEGER
      },
      title: {
        type: Sequelize.STRING
      },
      body: {
        type: Sequelize.TEXT
      },
      category: {
        type: Sequelize.INTEGER,
        comment: '1 => notifJual'
      },
      status: {
        type: Sequelize.INTEGER,
        comment: '1 => sell, 2 => sejenis, 3 => bargains, 4 => changeBargain'
      },
      referenceId: {
        type: Sequelize.INTEGER
      },
      action: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: '0 => unread, 1 => read, 2 => click'
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
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('Notifications');
  }
};
