module.exports = (sequelize, DataTypes) => {
  const UserEndUserCarDetail = sequelize.define(
    'UserEndUserCarDetail',
    {
      userId: DataTypes.INTEGER,
      modelYearId: DataTypes.INTEGER
    },
    {
      timestamps: true,
      paranoid: true
    }
  );
  UserEndUserCarDetail.associate = models => {
    UserEndUserCarDetail.belongsTo(models.ModelYear, {
      foreignKey: 'modelYearId',
      as: 'modelYear',
      onDelete: 'CASCADE'
    });
  };

  return UserEndUserCarDetail;
};
