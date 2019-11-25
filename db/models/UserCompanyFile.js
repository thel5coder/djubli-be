module.exports = (sequelize, DataTypes) => {
  const UserCompanyFile = sequelize.define(
    'UserCompanyFile',
    {
      userCompanyId: DataTypes.INTEGER,
      fileId: DataTypes.INTEGER
    },
    {}
  );
  UserCompanyFile.associate = function(models) {
    // associations can be defined here
  };
  return UserCompanyFile;
};
