module.exports = (sequelize, DataTypes) => {
  const UserEndUserCarDetail = sequelize.define(
    'UserEndUserCarDetail',
    {
      modelDetailId: DataTypes.INTEGER,
      userId: DataTypes.INTEGER,
      yearId: DataTypes.INTEGER
    },
    {}
  );
  UserEndUserCarDetail.associate = function(models) {
    // associations can be defined here
  };
  return UserEndUserCarDetail;
};
