module.exports = (sequelize, DataTypes) => {
  const GroupModel = sequelize.define(
    'GroupModel',
    {
      name: DataTypes.STRING,
      brandId: DataTypes.INTEGER
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
  };
  return GroupModel;
};
