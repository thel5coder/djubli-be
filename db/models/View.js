module.exports = (sequelize, DataTypes) => {
  const View = sequelize.define(
    'View',
    {
      userId: DataTypes.INTEGER,
      carId: DataTypes.INTEGER
    },
    { timestamps: true, paranoid: true }
  );
  View.associate = models => {
    View.belongsTo(models.Car, {
      foreignKey: 'carId',
      as: 'car',
      onDelete: 'CASCADE'
    });
    View.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
      onDelete: 'CASCADE'
    });
  };
  return View;
};
