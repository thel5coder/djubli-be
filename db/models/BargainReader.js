module.exports = (sequelize, DataTypes) => {
	const BargainReader = sequelize.define(
	  	'BargainReader', 
	  	{
		    userId: DataTypes.INTEGER,
		    bargainId: DataTypes.INTEGER,
		    isRead: DataTypes.BOOLEAN
		}, 
		{ timestamps: true, paranoid: true }
	);
  	BargainReader.associate = function(models) {
	    BargainReader.belongsTo(models.User, {
	      	foreginKey: 'userId',
	      	as: 'user',
	      	onDelete: 'CASCADE'
	    });
	    BargainReader.belongsTo(models.Bargain, {
	      	foreginKey: 'bargainId',
	      	as: 'bargain',
	      	onDelete: 'CASCADE'
	    });
  	};
  	return BargainReader;
};