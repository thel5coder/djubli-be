module.exports = (sequelize, DataTypes) => {
  const CompanyGallery = sequelize.define(
    'CompanyGallery',
    {
      companyId: DataTypes.INTEGER,
      fileId: DataTypes.INTEGER
    },
    { timestamps: true, paranoid: true }
  );
  CompanyGallery.associate = function(models) {
    CompanyGallery.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
      onDelete: 'CASCADE'
    });
    CompanyGallery.belongsTo(models.File, {
      foreignKey: 'fileId',
      as: 'file',
      onDelete: 'CASCADE'
    });
  };
  return CompanyGallery;
};
