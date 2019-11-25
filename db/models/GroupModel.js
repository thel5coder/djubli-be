module.exports = (sequelize, DataTypes) => {
  const GroupModel = sequelize.define(
    'GroupModel',
    {
      name: DataTypes.STRING,
      brandId: DataTypes.INTEGER
    },
    {}
  );
  GroupModel.associate = function(models) {
    // associations can be defined here
  };
  return GroupModel;
};
