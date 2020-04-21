'use strict';
module.exports = (sequelize, DataTypes) => {
  const Room = sequelize.define(
    'Room',
    {
      status: DataTypes.BOOLEAN
    },
    {
      timestamps: true,
      paranoid: true
    }
  );
  Room.associate = function(models) {
    // associations can be defined here
    // Room.belongsTo(models.Car, {
    //   foreignKey: 'roomId',
    //   as: 'car',
    //   onDelete: 'CASCADE'
    // });

    // Room.belongsTo(models.Car, {
    //   foreignKey: 'roomId',
    //   targetKey: 'id',
    //   as: 'car'
    // });

    Room.hasMany(models.Car, {
      foreignKey: 'roomId',
      targetKey: 'id',
      as: 'cars'
    });

    Room.hasMany(models.RoomMember, {
      foreignKey: 'roomId',
      targetKey: 'id',
      as: 'members'
    });
  };
  return Room;
};
