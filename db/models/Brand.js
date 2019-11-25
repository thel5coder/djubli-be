module.exports = (sequelize, DataTypes) => {
  const Brand = sequelize.define(
    'Brand',
    {
      name: DataTypes.STRING,
      logo: DataTypes.STRING,
      status: DataTypes.STRING
    },
    {}
  );
  Brand.associate = function(models) {
    // associations can be defined here
  };
  return Brand;
};
