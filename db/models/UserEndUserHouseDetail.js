module.exports = (sequelize, DataTypes) => {
  const UserEndUserHouseDetail = sequelize.define(
    'UserEndUserHouseDetail',
    {
      userId: DataTypes.INTEGER,
      status: DataTypes.STRING,
      surfaceArea: DataTypes.STRING,
      usedFrom: DataTypes.INTEGER
    },
    {
      timestamps: true,
      paranoid: true
    }
  );
  UserEndUserHouseDetail.associate = models => {
    UserEndUserHouseDetail.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
      onDelete: 'CASCADE'
    });
  };
  return UserEndUserHouseDetail;
};
