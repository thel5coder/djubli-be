module.exports = (sequelize, DataTypes) => {
  const SubDistrict = sequelize.define(
    'SubDistrict',
    {
      name: {
        type: DataTypes.STRING,
        get() {
          const rawValue = this.getDataValue('name');
          return rawValue ? rawValue.toLowerCase().split(' ').map((s) => s.charAt(0).toUpperCase() + s.substring(1)).join(' ') : null;
        }
      },
      longitude: DataTypes.NUMERIC,
      latitude: DataTypes.NUMERIC,
      cityId: DataTypes.INTEGER
    },
    { timestamps: true, paranoid: true }
  );
  SubDistrict.associate = models => {
    SubDistrict.belongsTo(models.City, {
      foreignKey: 'cityId',
      as: 'city',
      onDelete: 'CASCADE'
    });
    SubDistrict.hasMany(models.Car, {
      foreignKey: 'subdistrictId',
      sourceKey: 'id',
      as: 'car',
      onDelete: 'CASCADE'
    });
  };
  return SubDistrict;
};
