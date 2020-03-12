'use strict';
module.exports = (sequelize, DataTypes) => {
  const CarCategory = sequelize.define(
    'CarCategory',
    {
      name: DataTypes.STRING,
      description: DataTypes.STRING
    },
    {
      timestamps: true,
      paranoid: true
    }
  );
  CarCategory.associate = function(models) {
    // associations can be defined here
    CarCategory.hasMany(models.Car, {
      foreignKey: 'categoryId',
      sourceKey: 'id',
      as: 'cars',
      onDelete: 'CASCADE'
    });
  };
  return CarCategory;
};
