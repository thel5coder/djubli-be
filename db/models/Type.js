module.exports = (sequelize, DataTypes) => {
  const Type = sequelize.define(
    'Type',
    {
      name: DataTypes.STRING,
      status: DataTypes.BOOLEAN
    },
    { timestamps: true, paranoid: true }
  );
  Type.associate = models => {
    Type.hasMany(models.GroupModel, {
      foreignKey: 'typeId',
      sourceKey: 'id',
      as: 'groupModel',
      onDelete: 'CASCADE'
    });
  };
  return Type;
};
