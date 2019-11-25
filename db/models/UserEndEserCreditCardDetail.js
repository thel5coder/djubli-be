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
    {}
  );
  UserEndUserCreditCardDetail.associate = function(models) {
    // associations can be defined here
  };
  return UserEndUserCreditCardDetail;
};
