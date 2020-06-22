'use strict';
module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define(
    'Notification',
    {
      userId: DataTypes.INTEGER,
      title: DataTypes.STRING,
      body: DataTypes.TEXT,
      category: DataTypes.INTEGER,
      status: DataTypes.INTEGER,
      referenceId: DataTypes.INTEGER,
      action: DataTypes.INTEGER,
      categoryNotification: {
        type: DataTypes.VIRTUAL,
        get() {
          const stsCategorys = ['NULL', 'notifJual', 'notifBeli', 'notifLike', 'notifExtendExpiredAt'];
          return stsCategorys[this.category];
        }
      },
      statusNotification: {
        type: DataTypes.VIRTUAL,
        get() {
          switch (this.category) {
            case 1:
              const stsJual = [
                'NULL',
                'mobil terjual',
                'mobil sejenis',
                'penawaran baru',
                'penawaran beruba'
              ];
              return stsJual[this.status];
              break;
            case 3:
              const stsLike = ['NULL', 'tawaran harga mobil turun', 'mobil terjual'];
              return stsLike[this.status];
              break;

            default:
              const stsDefault = [
                'NULL',
                'mobil terjual',
                'mobil sejenis',
                'penawaran baru',
                'penawaran beruba'
              ];
              return stsDefault[this.status];
              break;
          }
        }
      },
      actionNotification: {
        type: DataTypes.VIRTUAL,
        get() {
          const stsActions = ['unread', 'seen', 'clicked'];
          return stsActions[this.action];
        }
      }
    },
    {
      timestamps: true,
      paranoid: true
    }
  );
  Notification.associate = function(models) {
    // associations can be defined here
    Notification.belongsTo(models.User, {
      foreignKey: 'userId',
      targetKey: 'id',
      as: 'user'
    });

    Notification.belongsTo(models.Car, {
      foreignKey: 'referenceId',
      targetKey: 'id',
      as: 'car'
    });
  };
  return Notification;
};
