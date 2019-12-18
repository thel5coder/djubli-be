module.exports = (sequelize, DataTypes) => {
  const Type = sequelize.define(
    'Type',
    {
      name: DataTypes.STRING,
      status: DataTypes.BOOLEAN
    },
    { timestamps: true, paranoid: true }
  );
  Type.associate = models => {
    // associations can be defined here
  };
  return Type;
};
