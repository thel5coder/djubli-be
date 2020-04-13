'use strict';
module.exports = (sequelize, DataTypes) => {
  const UserToken = sequelize.define(
    'UserToken',
    {
      userId: DataTypes.INTEGER,
      token: DataTypes.STRING,
      type: DataTypes.STRING,
      version: DataTypes.STRING
    },
    {
      timestamps: true,
      paranoid: true
    }
  );
  UserToken.associate = function(models) {
    // associations can be defined here
  };
  return UserToken;
};
