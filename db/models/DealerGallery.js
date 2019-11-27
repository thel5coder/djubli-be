module.exports = (sequelize, DataTypes) => {
  const DealerGallery = sequelize.define(
    'DealerGallery',
    {
      dealerId: DataTypes.INTEGER,
      fileId: DataTypes.INTEGER
    },
    {
      timestamps: true,
      paranoid: true
    }
  );
  DealerGallery.associate = models => {
    DealerGallery.belongsTo(models.Dealer, {
      foreignKey: 'dealerId',
      as: 'dealer',
      onDelete: 'CASCADE'
    });
    DealerGallery.belongsTo(models.File, {
      foreignKey: 'fileId',
      as: 'file',
      onDelete: 'CASCADE'
    });
  };
  return DealerGallery;
};
