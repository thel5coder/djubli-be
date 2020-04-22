'use strict';
module.exports = (sequelize, DataTypes) => {
  const RoomMember = sequelize.define(
    'RoomMember',
    {
      userId: DataTypes.INTEGER,
      roomId: DataTypes.INTEGER
    },
    {
      timestamps: true,
      paranoid: true
    }
  );
  RoomMember.associate = function(models) {
    // associations can be defined here
    RoomMember.belongsTo(models.Room, {
      foreignKey: 'roomId',
      as: 'room',
      onDelete: 'CASCADE'
    });
    RoomMember.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'member',
      onDelete: 'CASCADE'
    });
  };
  return RoomMember;
};
