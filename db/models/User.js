/* eslint-disable linebreak-style */
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    'User',
    {
      phone: DataTypes.STRING(100),
      email: DataTypes.STRING(100),
      emailValidAt: DataTypes.DATE,
      type: DataTypes.INTEGER,
      companyType: DataTypes.INTEGER,
      password: DataTypes.STRING,
      profileImageId: DataTypes.INTEGER,
      name: DataTypes.STRING(100),
      address: DataTypes.STRING(200),
      status: DataTypes.BOOLEAN
    },
    {
      timestamps: true,
      paranoid: true
    }
  );
  User.associate = models => {
    User.belongsTo(models.File, {
      foreignKey: 'profileImageId',
      as: 'file',
      onDelete: 'CASCADE'
    });
  };
  return User;
};
