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
    // associations can be defined here
  };
  return City;
};
