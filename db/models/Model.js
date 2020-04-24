module.exports = (sequelize, DataTypes) => {
  const Model = sequelize.define(
    'Model',
    {
      name: DataTypes.STRING,
      groupModelId: DataTypes.INTEGER
    },
    {
      timestamps: true,
      paranoid: true
    }
  );
  Model.associate = models => {
    Model.belongsTo(models.GroupModel, {
      foreignKey: 'groupModelId',
      as: 'groupModel',
      onDelete: 'CASCADE'
    });
    Model.hasMany(models.Car, {
      foreignKey: 'modelId',
      sourceKey: 'id',
      as: 'car',
      onDelete: 'CASCADE'
    });
    Model.hasMany(models.ModelYear, {
      foreignKey: 'modelId',
      sourceKey: 'id',
      as: 'modelYears',
      onDelete: 'CASCADE'
    });
  };
  return Model;
};
