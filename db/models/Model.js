module.exports = (sequelize, DataTypes) => {
  const Model = sequelize.define(
    'Model',
    {
      name: DataTypes.STRING,
      groupModelId: DataTypes.INTEGER
    },
    {}
  );
  Model.associate = function(Models) {
    // associations can be defined here
  };
  return Model;
};
