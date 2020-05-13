module.exports = (sequelize, DataTypes) => {
  const SearchHistory = sequelize.define(
    'SearchHistory',
    {
      userId: DataTypes.INTEGER,
      title: DataTypes.STRING,
      countResult: DataTypes.INTEGER,
      apiURL: DataTypes.TEXT
    },
    { timestamps: true, paranoid: true }
  );
  SearchHistory.associate = function(models) {
    SearchHistory.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
      onDelete: 'CASCADE'
    });
    SearchHistory.hasMany(models.SearchHistoryParam, {
      foreignKey: 'searchHistoryId',
      sourceKey: 'id',
      as: 'params',
      onDelete: 'CASCADE'
    });
  };
  return SearchHistory;
};
