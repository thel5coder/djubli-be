module.exports = (sequelize, DataTypes) => {
  const ExteriorGalery = sequelize.define(
    'ExteriorGalery',
    {
      fileId: DataTypes.INTEGER,
      carId: DataTypes.INTEGER
    },
    { timestamps: true, paranoid: true }
  );
  ExteriorGalery.associate = models => {
    ExteriorGalery.belongsTo(models.File, {
      foreignKey: 'fileId',
      as: 'file',
      onDelete: 'CASCADE'
    });
    ExteriorGalery.belongsTo(models.Car, {
      foreignKey: 'carId',
      as: 'car',
      onDelete: 'CASCADE'
    });
  };
  return ExteriorGalery;
};
