module.exports = (sequelize, DataTypes) => {
  const Company = sequelize.define(
    'Company',
    {
      userId: DataTypes.INTEGER,
      website: DataTypes.STRING,
      fax: DataTypes.STRING,
      businessType: DataTypes.STRING
    },
    { timestamps: true, paranoid: true }
  );
  Company.associate = models => {
    Company.hasMany(models.CompanyGallery, {
      foreignKey: 'companyId',
      sourceKey: 'id',
      as: 'companyGallery',
      onDelete: 'CASCADE'
    });
    Company.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
      onDelete: 'CASCADE'
    });
  };
  return Company;
};
