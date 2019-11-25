module.exports = (sequelize, DataTypes) => {
  const UserEndUserHouseDetail = sequelize.define(
    'UserEndUserHouseDetail',
    {
      userId: DataTypes.INTEGER,
      status: DataTypes.STRING,
      surfaceArea: DataTypes.STRING,
      usedFrom: DataTypes.INTEGER
    },
    {}
  );
  UserEndUserHouseDetail.associate = function(models) {
    // associations can be defined here
  };
  return UserEndUserHouseDetail;
};
