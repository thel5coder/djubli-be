module.exports = (sequelize, DataTypes) => {
  const ModelYear = sequelize.define(
    'ModelYear',
    {
      year: DataTypes.STRING,
      picture: DataTypes.STRING
    },
    {
      timestamps: true,
      paranoid: true,
      getterMethods: {
        pictureUrl() {
          return this.picture ? process.env.HDRIVE_S3_BASE_URL + this.picture : null;
        }
      }
    }
  );
  ModelYear.associate = function(models) {
    // associations can be defined here
  };
  return ModelYear;
};
