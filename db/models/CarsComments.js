module.exports = (sequelize, DataTypes) => {
  const CarsComments = sequelize.define(
    'CarsComments',
    {
      commentId: DataTypes.INTEGER,
      userId: DataTypes.INTEGER,
      carId: DataTypes.INTEGER,
      comment: DataTypes.TEXT
    },
    { timestamps: true, paranoid: true }
  );
  CarsComments.associate = function(models) {
    CarsComments.hasMany(models.CarsComments, {
      as: 'reply',
      foreignKey: 'commentId',
      useJunctionTable: false
    });
    CarsComments.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
      onDelete: 'CASCADE'
    });
    CarsComments.belongsTo(models.Car, {
      foreignKey: 'carId',
      as: 'car',
      onDelete: 'CASCADE'
    });
  };
  return CarsComments;
};
