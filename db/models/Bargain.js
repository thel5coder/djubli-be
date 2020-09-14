const models = require('../../db/models');
const moment = require('moment');

module.exports = (sequelize, DataTypes) => {
  const Bargain = sequelize.define(
    'Bargain',
    {
      userId: {
        type: DataTypes.INTEGER,
        references: {
          model: models.Dealer,
          key: 'userId'
        }
      },
      bidderId: DataTypes.INTEGER,
      carId: DataTypes.INTEGER,
      bidAmount: DataTypes.NUMERIC,
      haveSeenCar: DataTypes.BOOLEAN,
      paymentMethod: DataTypes.INTEGER,
      expiredAt: DataTypes.DATE,
      comment: DataTypes.STRING,
      bidType: DataTypes.INTEGER,
      negotiationType: DataTypes.INTEGER,
      carPrice: DataTypes.NUMERIC,
      roomId: DataTypes.INTEGER,
      isExtend: DataTypes.BOOLEAN
    },
    { timestamps: true, paranoid: true }
  );
  Bargain.associate = models => {
    Bargain.belongsTo(models.User, {
      foreginKey: 'userId',
      as: 'user',
      onDelete: 'CASCADE'
    });
    Bargain.belongsTo(models.User, {
      foreginKey: 'bidderId',
      as: 'bidder',
      onDelete: 'CASCADE'
    });
    Bargain.belongsTo(models.Car, {
      foreignKey: 'carId',
      as: 'car',
      onDelete: 'CASCADE'
    });
    Bargain.hasMany(models.Purchase, {
      foreignKey: 'bargainId',
      as: 'purchase',
      onDelete: 'CASCADE'
    });
  };
  return Bargain;
};
