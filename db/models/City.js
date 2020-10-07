module.exports = (sequelize, DataTypes) => {
  const City = sequelize.define(
    'City',
    {
      name: DataTypes.STRING,
      longitude: DataTypes.NUMERIC,
      latitude: DataTypes.NUMERIC
    },
    { timestamps: true, paranoid: true }
  );
  City.associate = function(models) {
    City.hasMany(models.Car, {
      foreignKey: 'cityId',
      sourceKey: 'id',
      as: 'car',
      onDelete: 'CASCADE'
    });
  };
  return City;
};
