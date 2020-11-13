const minio = require('../../helpers/minio');

module.exports = (sequelize, DataTypes) => {
  const ModelYear = sequelize.define(
    'ModelYear',
    {
      modelId: DataTypes.INTEGER,
      year: DataTypes.STRING,
      picture: DataTypes.STRING,
      price: DataTypes.NUMERIC
    },
    {
      timestamps: true,
      paranoid: true
    }
  );
  ModelYear.addHook('afterFind', async (result) => {
    await Promise.all(
      result.map(async item => {
        if(item.dataValues.picture) {
          const url = await minio.getUrl(item.dataValues.picture).then(res => {
            return res;
          }).catch(err => {
            console.log(err);
          });

          return item.dataValues.pictureUrl = url;
        }

        return item.dataValues.pictureUrl = null;
      })
    );

    return result;
  });
  ModelYear.associate = models => {
    ModelYear.belongsTo(models.Model, {
      foreignKey: 'modelId',
      as: 'model',
      onDelete: 'CASCADE'
    });
    ModelYear.hasMany(models.Car, {
      foreignKey: 'modelYearId',
      sourceKey: 'id',
      as: 'car',
      onDelete: 'CASCADE'
    });
    ModelYear.hasMany(models.Car, {
      foreignKey: 'modelYearId',
      sourceKey: 'id',
      as: 'cars',
      onDelete: 'CASCADE'
    });
  };
  return ModelYear;
};
