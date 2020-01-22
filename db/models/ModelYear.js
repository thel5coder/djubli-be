module.exports = (sequelize, DataTypes) => {
  const ModelYear = sequelize.define(
    'ModelYear',
    {
      modelId: DataTypes.INTEGER,
      year: DataTypes.STRING,
      picture: DataTypes.STRING,
      price: DataTypes.NUMERIC
    },
    {
      timestamps: true,
      paranoid: true,
      getterMethods: {
        pictureUrl() {
          return this.picture ? process.env.HDRIVE_S3_BASE_URL + this.picture : null;
        }
      }
    }
  );
  ModelYear.associate = models => {
    ModelYear.belongsTo(models.Model, {
      foreignKey: 'modelId',
      as: 'model',
      onDelete: 'CASCADE'
    });
    ModelYear.hasMany(models.Car, {
      foreignKey: 'modelYearId',
      sourceKey: 'id',
      as: 'car',
      onDelete: 'CASCADE'
    });
  };
  return ModelYear;
};
