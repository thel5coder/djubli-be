module.exports = (sequelize, DataTypes) => {
  const GroupModel = sequelize.define(
    'GroupModel',
    {
      name: DataTypes.STRING,
      brandId: DataTypes.INTEGER,
      typeId: DataTypes.INTEGER
    },
    {
      timestamps: true,
      paranoid: true
    }
  );
  GroupModel.associate = models => {
    GroupModel.belongsTo(models.Brand, {
      foreignKey: 'brandId',
      as: 'brand',
      onDelete: 'CASCADE'
    });
    GroupModel.belongsTo(models.Type, {
      foreignKey: 'typeId',
      as: 'type',
      onDelete: 'CASCADE'
    });
  };
  return GroupModel;
};
