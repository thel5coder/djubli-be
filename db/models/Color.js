module.exports = (sequelize, DataTypes) => {
  const Color = sequelize.define(
    'Color',
    {
      name: DataTypes.STRING(100),
      hex: DataTypes.STRING(50)
    },
    { timestamps: true, paranoid: true }
  );
  Color.associate = function(models) {
    // associations can be defined here
  };
  return Color;
};
