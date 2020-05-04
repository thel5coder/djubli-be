module.exports = (sequelize, DataTypes) => {
  const SearchHistory = sequelize.define(
    'SearchHistory',
    {
      userId: DataTypes.INTEGER,
      title: DataTypes.STRING,
      apiURL: DataTypes.STRING,
      countResult: DataTypes.INTEGER
    },
    { timestamps: true, paranoid: true }
  );
  SearchHistory.associate = function(models) {
    SearchHistory.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
      onDelete: 'CASCADE'
    });
  };
  return SearchHistory;
};
