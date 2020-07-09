/* eslint-disable linebreak-style */
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    'User',
    {
      phone: DataTypes.STRING(100),
      email: DataTypes.STRING(100),
      emailValidAt: DataTypes.DATE,
      type: DataTypes.INTEGER,
      companyType: DataTypes.INTEGER,
      password: DataTypes.STRING,
      profileImageId: DataTypes.INTEGER,
      name: DataTypes.STRING(100),
      address: DataTypes.STRING(200),
      status: DataTypes.BOOLEAN,
      profileUser: {
        type: DataTypes.VIRTUAL,
        get() {
          if (this.type == 0 && this.companyType == 0) return 'End User';
          else if (this.type == 0 && this.companyType == 1) return 'End User';
          else if (this.type == 1 && this.companyType == 0) return 'Dealer';
          else if (this.type == 1 && this.companyType == 1) return 'Dealer';
          else return 'unknown';
        }
      },
      cityId: DataTypes.INTEGER,
      subdistrictId: DataTypes.INTEGER
    },
    {
      timestamps: true,
      paranoid: true
    }
  );
  User.associate = models => {
    User.belongsTo(models.File, {
      foreignKey: 'profileImageId',
      as: 'file',
      onDelete: 'CASCADE'
    });
    User.hasMany(models.UserEndUserCreditCardDetail, {
      foreignKey: 'userId',
      sourceKey: 'id',
      as: 'userCreditCard',
      onDelete: 'CASCADE'
    });
    User.hasMany(models.UserEndUserCarDetail, {
      foreignKey: 'userId',
      sourceKey: 'id',
      as: 'userCar',
      onDelete: 'CASCADE'
    });
    User.hasMany(models.UserEndUserHouseDetail, {
      foreignKey: 'userId',
      sourceKey: 'id',
      as: 'userHouse',
      onDelete: 'CASCADE'
    });
    User.hasMany(models.Dealer, {
      foreignKey: 'userId',
      sourceKey: 'id',
      as: 'dealer',
      onDelete: 'CASCADE'
    });
    User.hasMany(models.Company, {
      foreignKey: 'userId',
      sourceKey: 'id',
      as: 'company',
      onDelete: 'CASCADE'
    });
    User.hasMany(models.Like, {
      foreignKey: 'userId',
      sourceKey: 'id',
      as: 'like',
      onDelete: 'CASCADE'
    });
    User.hasMany(models.View, {
      foreignKey: 'userId',
      sourceKey: 'id',
      as: 'view',
      onDelete: 'CASCADE'
    });
    User.hasMany(models.Purchase, {
      foreignKey: 'userId',
      sourceKey: 'id',
      as: 'purchase',
      onDelete: 'CASCADE'
    });
    User.hasMany(models.Car, {
      foreignKey: 'userId',
      sourceKey: 'id',
      as: 'car',
      onDelete: 'CASCADE'
    });
    User.hasMany(models.Notification, {
      foreignKey: 'userId',
      sourceKey: 'id',
      as: 'notifications',
      onDelete: 'CASCADE'
    });
    User.hasMany(models.RoomMember, {
      foreignKey: 'userId',
      sourceKey: 'id',
      as: 'members',
      onDelete: 'CASCADE'
    });
    User.belongsTo(models.City, {
      foreignKey: 'cityId',
      as: 'city',
      onDelete: 'CASCADE'
    });
    User.belongsTo(models.SubDistrict, {
      foreignKey: 'subdistrictId',
      as: 'subdistrict',
      onDelete: 'CASCADE'
    });
  };
  return User;
};
