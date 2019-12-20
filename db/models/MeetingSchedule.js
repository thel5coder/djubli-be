module.exports = (sequelize, DataTypes) => {
  const MeetingSchedule = sequelize.define(
    'MeetingSchedule',
    {
      carId: DataTypes.INTEGER,
      day: DataTypes.INTEGER,
      startTime: DataTypes.TIME,
      endTime: DataTypes.TIME
    },
    { timestamps: true, paranoid: true }
  );
  MeetingSchedule.associate = models => {
    MeetingSchedule.belongsTo(models.Car, {
      foreignKey: 'carId',
      as: 'car',
      onDelete: 'CASCADE'
    });
  };
  return MeetingSchedule;
};
