module.exports = (sequelize, DataTypes) => {
  const Color = sequelize.define(
    'Color',
    {
      name: DataTypes.STRING(100),
      hex: DataTypes.STRING(50)
    },
    { timestamps: true, paranoid: true }
  );
  Color.associate = function(models) {
    Color.hasMany(models.Car, {
      foreignKey: 'interiorColorId',
      sourceKey: 'id',
      as: 'interiorColorCar',
      onDelete: 'CASCADE'
    });
    Color.hasMany(models.Car, {
      foreignKey: 'exteriorColorId',
      sourceKey: 'id',
      as: 'exteriorColorCar',
      onDelete: 'CASCADE'
    });
  };
  return Color;
};
