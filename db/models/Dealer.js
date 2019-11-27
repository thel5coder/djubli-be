module.exports = (sequelize, DataTypes) => {
  const Dealer = sequelize.define(
    'Dealer',
    {
      userId: DataTypes.INTEGER,
      authorizedBrandId: DataTypes.INTEGER,
      website: DataTypes.STRING(100),
      productType: DataTypes.INTEGER
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
      as: 'dealer',
      onDelete: 'CASCADE'
    });
    Dealer.hasMany(models.DealerWorkshopAuthorizedBrand, {
      foreignKey: 'dealerId',
      sourceKey: 'id',
      as: 'dealer',
      onDelete: 'CASCADE'
    });
    Dealer.hasMany(models.DealerWorkshopOtherBrand, {
      foreignKey: 'dealerId',
      sourceKey: 'id',
      as: 'dealer',
      onDelete: 'CASCADE'
    });
    Dealer.hasMany(models.DealerGallery, {
      foreignKey: 'dealerId',
      sourceKey: 'id',
      as: 'dealer',
      onDelete: 'CASCADE'
    });
  };
  return Dealer;
};
