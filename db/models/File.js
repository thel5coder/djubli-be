module.exports = (sequelize, DataTypes) => {
  const File = sequelize.define(
    'File',
    {
      type: DataTypes.STRING(100),
      url: DataTypes.STRING
    },
    {}
  );
  File.associate = function(models) {
    // associations can be defined here
  };
  return File;
};
