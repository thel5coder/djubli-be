module.exports = (sequelize, DataTypes) => {
  const UserEndUserCreditCardDetail = sequelize.define(
    'UserEndUserCreditCardDetail',
    {
      userId: DataTypes.INTEGER,
      brand: DataTypes.STRING,
      bank: DataTypes.STRING,
      type: DataTypes.STRING,
      usedFrom: DataTypes.INTEGER
    },
    {
      timestamps: true,
      paranoid: true
    }
  );
  UserEndUserCreditCardDetail.associate = models => {
    UserEndUserCreditCardDetail.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
      onDelete: 'CASCADE'
    });
  };
  return UserEndUserCreditCardDetail;
};
