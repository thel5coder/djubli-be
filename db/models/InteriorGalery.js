module.exports = (sequelize, DataTypes) => {
  const InteriorGalery = sequelize.define(
    'InteriorGalery',
    {
      fileId: DataTypes.INTEGER,
      carId: DataTypes.INTEGER
    },
    { timestamps: true, paranoid: true }
  );
  InteriorGalery.associate = function(models) {
    InteriorGalery.belongsTo(models.File, {
      foreignKey: 'fileId',
      as: 'file',
      onDelete: 'CASCADE'
    });
    InteriorGalery.belongsTo(models.Car, {
      foreignKey: 'carId',
      as: 'car',
      onDelete: 'CASCADE'
    });
  };
  return InteriorGalery;
};
