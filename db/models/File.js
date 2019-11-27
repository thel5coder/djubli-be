module.exports = (sequelize, DataTypes) => {
  const File = sequelize.define(
    'File',
    {
      type: DataTypes.STRING(100),
      url: DataTypes.STRING
    },
    {
      timestamps: true,
      paranoid: true,
      getterMethods: {
        fileUrl() {
          return this.url ? process.env.HDRIVE_S3_BASE_URL + this.url : null;
        }
      }
    }
  );
  File.associate = models => {
    File.hasMany(models.DealerGallery, {
      foreignKey: 'fileId',
      sourceKey: 'id',
      as: 'file',
      onDelete: 'CASCADE'
    });
  };
  return File;
};
