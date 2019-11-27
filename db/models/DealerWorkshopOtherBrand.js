module.exports = (sequelize, DataTypes) => {
  const DealerWorkshopOtherBrand = sequelize.define(
    'DealerWorkshopOtherBrand',
    {
      dealerId: DataTypes.INTEGER,
      brandId: DataTypes.INTEGER
    },
    {
      timestamps: true,
      paranoid: true
    }
  );
  DealerWorkshopOtherBrand.associate = models => {
    DealerWorkshopOtherBrand.belongsTo(models.Dealer, {
      foreignKey: 'dealerId',
      as: 'dealer',
      onDelete: 'CASCADE'
    });
    DealerWorkshopOtherBrand.belongsTo(models.Brand, {
      foreignKey: 'brandId',
      as: 'brand',
      onDelete: 'CASCADE'
    });
  };
  return DealerWorkshopOtherBrand;
};
