module.exports = (sequelize, DataTypes) => {
  const DealerSellAndBuyBrand = sequelize.define(
    'DealerSellAndBuyBrand',
    {
      dealerId: DataTypes.INTEGER,
      brandId: DataTypes.INTEGER
    },
    {
      timestamps: true,
      paranoid: true
    }
  );
  DealerSellAndBuyBrand.associate = models => {
    DealerSellAndBuyBrand.belongsTo(models.Dealer, {
      foreignKey: 'dealerId',
      as: 'dealer',
      onDelete: 'CASCADE'
    });
    DealerSellAndBuyBrand.belongsTo(models.Brand, {
      foreignKey: 'brandId',
      as: 'brand',
      onDelete: 'CASCADE'
    });
  };
  return DealerSellAndBuyBrand;
};
