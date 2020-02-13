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
      paranoid: true,
      getterMethods: {
        logoUrl() {
          return this.logo ? process.env.HDRIVE_S3_BASE_URL + this.logo : null;
        }
      }
    }
  );
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
  };
  return Brand;
};
