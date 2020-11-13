const minio = require('../../helpers/minio');

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
  File.addHook('afterFind', async (result) => {
    await Promise.all(
      result.map(async item => {
        if(item.dataValues.url) {
          const url = await minio.getUrl(item.dataValues.url).then(res => {
            return res;
          }).catch(err => {
            console.log(err);
          });

          return item.dataValues.fileUrl = url;
        }

        return item.dataValues.fileUrl = null;
      })
    );

    return result;
  });
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
