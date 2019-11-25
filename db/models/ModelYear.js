module.exports = (sequelize, DataTypes) => {
  const ModelYear = sequelize.define(
    'ModelYear',
    {
      year: DataTypes.STRING,
      picture: DataTypes.STRING
    },
    {}
  );
  ModelYear.associate = function(models) {
    // associations can be defined here
  };
  return ModelYear;
};
