module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    'User',
    {
      phone: DataTypes.STRING(100),
      email: DataTypes.STRING(100),
      // 1: End User, 2: Dealer
      type: DataTypes.INTEGER,
      // 1: Self, 2: Company
      companyType: DataTypes.INTEGER
    },
    {
      timestamps: true,
      paranoid: true
    }
  );

  return User;
};
