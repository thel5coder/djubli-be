module.exports = (sequelize, DataTypes) => {
  const Brand = sequelize.define(
    'Brand',
    {
      name: DataTypes.STRING,
      logo: DataTypes.STRING,
      status: DataTypes.STRING
    },
    {
      timestamps: true,
      paranoid: true,
      getterMethods: {
        logoUrl() {
          return this.logo ? process.env.HDRIVE_S3_BASE_URL + this.logo : null;
        }
      }
    }
  );
  Brand.associate = function(models) {
    // associations can be defined here
  };
  return Brand;
};
