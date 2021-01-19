const minio = require('../../helpers/minio');

module.exports = (sequelize, DataTypes) => {
  const Brand = sequelize.define(
    'Brand',
    {
      name: DataTypes.STRING,
      logo: DataTypes.STRING,
      status: DataTypes.STRING
    },
    {
      timestamps: true,
      paranoid: true
    }
  );
  Brand.addHook('afterFind', async (result) => {
    if(Array.isArray(result)) {
      await Promise.all(
        result.map(async item => {
          if(item.dataValues.logo) {
            const url = await minio.getUrl(item.dataValues.logo).then(res => {
              return res;
            }).catch(err => {
              console.log(err);
            });

            return item.dataValues.logoUrl = url;
          }

          return item.dataValues.logoUrl = null;
        })
      );
    } else if(result && result.dataValues) {
      if(result.dataValues.logo) {
        const url = await minio.getUrl(result.dataValues.logo).then(res => {
          return res;
        }).catch(err => {
          console.log(err);
        });

        return result.dataValues.logoUrl = url;
      }

      return result.dataValues.logoUrl = null;
    }

    return result;
  });
  Brand.associate = models => {
    Brand.hasMany(models.DealerSellAndBuyBrand, {
      foreignKey: 'brandId',
      sourceKey: 'id',
      as: 'sellAndBuyBrand',
      onDelete: 'CASCADE'
    });
    Brand.hasMany(models.DealerWorkshopAuthorizedBrand, {
      foreignKey: 'brandId',
      sourceKey: 'id',
      as: 'workshopAuthorizedBrand',
      onDelete: 'CASCADE'
    });
    Brand.hasMany(models.DealerWorkshopOtherBrand, {
      foreignKey: 'brandId',
      sourceKey: 'id',
      as: 'workshopOtherBrand',
      onDelete: 'CASCADE'
    });
    Brand.hasMany(models.Car, {
      foreignKey: 'brandId',
      sourceKey: 'id',
      as: 'car',
      onDelete: 'CASCADE'
    });
    Brand.hasMany(models.Dealer, {
      foreignKey: 'authorizedBrandId',
      sourceKey: 'id',
      as: 'dealer',
      onDelete: 'CASCADE'
    });
    Brand.hasMany(models.GroupModel, {
      foreignKey: 'brandId',
      sourceKey: 'id',
      as: 'groupModelBrand',
      onDelete: 'CASCADE'
    });
  };
  return Brand;
};
