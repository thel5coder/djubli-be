module.exports = (sequelize, DataTypes) => {
  const Like = sequelize.define(
    'Like',
    {
      userId: DataTypes.INTEGER,
      carId: DataTypes.INTEGER
    },
    { timestamps: true, paranoid: true }
  );
  Like.associate = models => {
    Like.belongsTo(models.Car, {
      foreignKey: 'carId',
      as: 'car',
      onDelete: 'CASCADE'
    });
    Like.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
      onDelete: 'CASCADE'
    });
  };
  return Like;
};
