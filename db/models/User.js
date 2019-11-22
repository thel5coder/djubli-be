module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    'User',
    {
      companyId: DataTypes.INTEGER,
      roleId: DataTypes.INTEGER,
      name: DataTypes.STRING(100),
      email: DataTypes.STRING(100),
      emailValidAt: DataTypes.DATE,
      phone: DataTypes.STRING(100),
      phoneValidAt: DataTypes.DATE,
      password: DataTypes.STRING,
      status: DataTypes.BOOLEAN
    },
    {
      timestamps: true,
      paranoid: true
    }
  );

  return User;
};
