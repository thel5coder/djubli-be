module.exports = (sequelize, DataTypes) => {
  const Purchase = sequelize.define(
    'Purchase',
    {
      userId: DataTypes.INTEGER,
      carId: DataTypes.INTEGER,
      bargainId: DataTypes.INTEGER,
      price: DataTypes.NUMERIC,
      paymentMethod: DataTypes.INTEGER,
      haveSeenCar: DataTypes.BOOLEAN,
      isAccept: DataTypes.BOOLEAN
    },
    { timestamps: true, paranoid: true }
  );
  Purchase.associate = models => {
    Purchase.belongsTo(models.Car, {
      foreignKey: 'carId',
      as: 'car',
      onDelete: 'CASCADE'
    });
    Purchase.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
      onDelete: 'CASCADE'
    });
    Purchase.belongsTo(models.Bargain, {
      foreignKey: 'bargainId',
      as: 'bargain',
      onDelete: 'CASCADE'
    });
  };
  return Purchase;
};
