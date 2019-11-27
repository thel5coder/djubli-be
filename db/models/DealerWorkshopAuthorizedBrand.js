module.exports = (sequelize, DataTypes) => {
  const DealerWorkshopAuthorizedBrand = sequelize.define(
    'DealerWorkshopAuthorizedBrand',
    {
      dealerId: DataTypes.INTEGER,
      brandId: DataTypes.INTEGER
    },
    {
      timestamps: true,
      paranoid: true
    }
  );
  DealerWorkshopAuthorizedBrand.associate = models => {
    DealerWorkshopAuthorizedBrand.belongsTo(models.Dealer, {
      foreignKey: 'dealerId',
      as: 'dealer',
      onDelete: 'CASCADE'
    });
    DealerWorkshopAuthorizedBrand.belongsTo(models.Brand, {
      foreignKey: 'brandId',
      as: 'brand',
      onDelete: 'CASCADE'
    });
  };
  return DealerWorkshopAuthorizedBrand;
};
