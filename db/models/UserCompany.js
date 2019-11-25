module.exports = (sequelize, DataTypes) => {
  const UserCompany = sequelize.define(
    'UserCompany',
    {
      userId: DataTypes.INTEGER,
      phone: DataTypes.STRING,
      fax: DataTypes.STRING,
      email: DataTypes.STRING,
      emailValidAt: DataTypes.DATE,
      website: DataTypes.TEXT,
      lineOfBusiness: DataTypes.STRING
    },
    {}
  );
  UserCompany.associate = function(models) {
    // associations can be defined here
  };
  return UserCompany;
};
