'use strict';
module.exports = (sequelize, DataTypes) => {
  const CompanyGallery = sequelize.define('CompanyGallery', {
    companyId: DataTypes.INTEGER,
    fileId: DataTypes.INTEGER
  }, {});
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