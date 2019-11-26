module.exports = (sequelize, DataTypes) => {
  const File = sequelize.define(
    'File',
    {
      type: DataTypes.STRING(100),
      url: DataTypes.STRING
    },
    {
      timestamps: true,
      paranoid: true
    }
  );
  File.associate = function(models) {
    // associations can be defined here
  };
  return File;
};
