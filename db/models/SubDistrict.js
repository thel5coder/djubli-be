module.exports = (sequelize, DataTypes) => {
  const SubDistrict = sequelize.define(
    'SubDistrict',
    {
      name: DataTypes.STRING,
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
  };
  return SubDistrict;
};
