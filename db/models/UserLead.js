module.exports = (sequelize, DataTypes) => {
  const UserLead = sequelize.define(
    'UserLead',
    {
      phone: DataTypes.STRING,
      email: DataTypes.STRING,
      type: DataTypes.INTEGER,
      companyType: DataTypes.INTEGER
    },
    {}
  );
  UserLead.associate = function(models) {
    // associations can be defined here
  };
  return UserLead;
};
