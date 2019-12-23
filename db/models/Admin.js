module.exports = (sequelize, DataTypes) => {
  const Admin = sequelize.define(
    'Admin',
    {
      name: DataTypes.STRING,
      email: DataTypes.STRING,
      password: DataTypes.STRING,
      isSuperAdmin: DataTypes.BOOLEAN,
      status: DataTypes.BOOLEAN,
      photo: DataTypes.STRING
    },
    { timestamps: true, paranoid: true }
  );
  Admin.associate = function(models) {
    // associations can be defined here
  };
  return Admin;
};
