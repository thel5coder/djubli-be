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
  };
  return Model;
};
