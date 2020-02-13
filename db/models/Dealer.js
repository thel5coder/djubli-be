const models = require('../../db/models');

module.exports = (sequelize, DataTypes) => {
  const Dealer = sequelize.define(
    'Dealer',
    {
      userId: {
        type: DataTypes.INTEGER,
        references: {
          model: models.Dealer,
          key: "userId"
        }
      },
      authorizedBrandId: DataTypes.INTEGER,
      website: DataTypes.STRING(100),
      productType: DataTypes.INTEGER,
      fax: DataTypes.STRING(100),
      isPartner: DataTypes.BOOLEAN
    },
    {
      timestamps: true,
      paranoid: true
    }
  );
  Dealer.associate = models => {
    Dealer.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
      onDelete: 'CASCADE'
    });
    Dealer.belongsTo(models.Brand, {
      foreignKey: 'authorizedBrandId',
      as: 'brand',
      onDelete: 'CASCADE'
    });
    Dealer.hasMany(models.DealerSellAndBuyBrand, {
      foreignKey: 'dealerId',
      sourceKey: 'id',
      as: 'dealerSellAndBuyBrand',
      onDelete: 'CASCADE'
    });
    Dealer.hasMany(models.DealerWorkshopAuthorizedBrand, {
      foreignKey: 'dealerId',
      sourceKey: 'id',
      as: 'workshopAuthorizedBrand',
      onDelete: 'CASCADE'
    });
    Dealer.hasMany(models.DealerWorkshopOtherBrand, {
      foreignKey: 'dealerId',
      sourceKey: 'id',
      as: 'workshopOtherBrand',
      onDelete: 'CASCADE'
    });
    Dealer.hasMany(models.DealerGallery, {
      foreignKey: 'dealerId',
      sourceKey: 'id',
      as: 'dealerGallery',
      onDelete: 'CASCADE'
    });

    // For Get All
    Dealer.hasMany(models.Car, {
      foreignKey: 'brandId',
      sourceKey: 'authorizedBrandId',
      as: 'car',
      onDelete: 'CASCADE'
    });
  };
  return Dealer;
};
