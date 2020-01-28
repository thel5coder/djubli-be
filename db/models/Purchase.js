module.exports = (sequelize, DataTypes) => {
  const Purchase = sequelize.define(
    'Purchase',
    {
      userId: DataTypes.INTEGER,
      carId: DataTypes.INTEGER,
      price: DataTypes.NUMERIC,
      paymentMethod: DataTypes.INTEGER,
      haveSeenCar: DataTypes.BOOLEAN
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
  };
  return Purchase;
};
