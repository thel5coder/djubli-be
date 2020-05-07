module.exports = (sequelize, DataTypes) => {
  const SearchHistoryParam = sequelize.define(
    'SearchHistoryParam',
    {
      searchHistoryId: DataTypes.INTEGER,
      key: DataTypes.STRING,
      value: DataTypes.STRING
    },
    { timestamps: true, paranoid: true }
  );
  SearchHistoryParam.associate = function(models) {
    SearchHistoryParam.belongsTo(models.SearchHistory, {
      foreignKey: 'searchHistoryId',
      as: 'searchHistory',
      onDelete: 'CASCADE'
    });
  };
  return SearchHistoryParam;
};
