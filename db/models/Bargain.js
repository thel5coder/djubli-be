module.exports = (sequelize, DataTypes) => {
  const Bargain = sequelize.define(
    'Bargain',
    {
      userId: DataTypes.INTEGER,
      dealerId: DataTypes.INTEGER,
      bidAmount: DataTypes.NUMERIC,
      haveSeenCar: DataTypes.BOOLEAN,
      paymentMethod: DataTypes.INTEGER,
      expiredAt: DataTypes.DATE,
      comment: DataTypes.STRING,
      bidType: DataTypes.INTEGER,
      negotiationType: DataTypes.INTEGER
    },
    { timestamps: true, paranoid: true }
  );
  Bargain.associate = models => {
    Bargain.belongsTo(models.User, {
      foreginKey: 'userId',
      as: 'user',
      onDelete: 'CASCADE'
    });
    Bargain.belongsTo(models.Car, {
      foreignKey: 'carId',
      as: 'car',
      onDelete: 'CASCADE'
    });
  };
  return Bargain;
};
