module.exports = (sequelize, DataTypes) => {
  const Car = sequelize.define(
    'Car',
    {
      userId: DataTypes.INTEGER,
      brandId: DataTypes.INTEGER,
      modelId: DataTypes.INTEGER,
      groupModelId: DataTypes.INTEGER,
      modelYearId: DataTypes.INTEGER,
      exteriorColorId: DataTypes.INTEGER,
      interiorColorId: DataTypes.INTEGER,
      price: DataTypes.NUMERIC,
      condition: DataTypes.INTEGER,
      usedFrom: DataTypes.INTEGER,
      frameNumber: DataTypes.STRING(100),
      engineNumber: DataTypes.STRING(100),
      STNKnumber: DataTypes.STRING(100),
      STNKphoto: DataTypes.STRING,
      location: DataTypes.STRING,
      status: DataTypes.INTEGER,
      km: DataTypes.NUMERIC,
      address: DataTypes.STRING,
      cityId: DataTypes.INTEGER,
      subDistictId: DataTypes.INTEGER,
      roomId: DataTypes.INTEGER
    },
    {
      timestamps: true,
      paranoid: true,
      getterMethods: {
        stnkUrl() {
          return this.STNKphoto ? process.env.HDRIVE_S3_BASE_URL + this.STNKphoto : null;
        }
      }
    }
  );
  Car.associate = models => {
    Car.hasMany(models.InteriorGalery, {
      foreignKey: 'carId',
      sourceKey: 'id',
      as: 'interiorGalery',
      onDelete: 'CASCADE'
    });
    Car.hasMany(models.ExteriorGalery, {
      foreignKey: 'carId',
      sourceKey: 'id',
      as: 'exteriorGalery',
      onDelete: 'CASCADE'
    });
    Car.hasMany(models.MeetingSchedule, {
      foreignKey: 'carId',
      sourceKey: 'id',
      as: 'meetingSchedule',
      onDelete: 'CASCADE'
    });
    Car.hasMany(models.Bargain, {
      foreignKey: 'carId',
      sourceKey: 'id',
      as: 'bargain',
      onDelete: 'CASCADE'
    });
    Car.hasMany(models.Like, {
      foreignKey: 'carId',
      sourceKey: 'id',
      as: 'like',
      onDelete: 'CASCADE'
    });
    Car.hasMany(models.View, {
      foreignKey: 'carId',
      sourceKey: 'id',
      as: 'view',
      onDelete: 'CASCADE'
    });
    Car.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
      onDelete: 'CASCADE'
    });

    Car.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'profile',
      onDelete: 'CASCADE'
    });

    Car.belongsTo(models.Brand, {
      foreignKey: 'brandId',
      as: 'brand',
      onDelete: 'CASCADE'
    });
    Car.belongsTo(models.Model, {
      foreignKey: 'modelId',
      as: 'model',
      onDelete: 'CASCADE'
    });
    Car.belongsTo(models.GroupModel, {
      foreignKey: 'groupModelId',
      as: 'groupModel',
      onDelete: 'CASCADE'
    });
    Car.belongsTo(models.ModelYear, {
      foreignKey: 'modelYearId',
      as: 'modelYear',
      onDelete: 'CASCADE'
    });
    Car.belongsTo(models.Color, {
      foreignKey: 'interiorColorId',
      as: 'interiorColor',
      onDelete: 'CASCADE'
    });
    Car.belongsTo(models.Color, {
      foreignKey: 'exteriorColorId',
      as: 'exteriorColor',
      onDelete: 'CASCADE'
    });

    Car.hasMany(models.Notification, {
      foreignKey: 'referenceId',
      targetKey: 'id',
      as: 'notifications'
    });

    Car.belongsTo(models.Room, {
      foreignKey: 'roomId',
      targetKey: 'id',
      as: 'room'
    });
  };
  return Car;
};
