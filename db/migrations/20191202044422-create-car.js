module.exports = {
  up: (queryInterface, Sequelize) =>
    queryInterface.createTable('Cars', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userId: {
        type: Sequelize.INTEGER
      },
      brandId: {
        type: Sequelize.INTEGER
      },
      modelId: {
        type: Sequelize.INTEGER
      },
      groupModelId: {
        type: Sequelize.INTEGER
      },
      modelYearId: {
        type: Sequelize.INTEGER
      },
      exteriorColorId: {
        type: Sequelize.INTEGER
      },
      interiorColorId: {
        type: Sequelize.INTEGER
      },
      price: {
        type: Sequelize.NUMERIC
      },
      condition: {
        type: Sequelize.INTEGER,
        comment: '0 => bekas, 1 => baru'
      },
      usedFrom: {
        type: Sequelize.INTEGER
      },
      frameNumber: {
        type: Sequelize.STRING(100)
      },
      engineNumber: {
        type: Sequelize.STRING(100)
      },
      STNKnumber: {
        type: Sequelize.STRING(100)
      },
      STNKphoto: {
        type: Sequelize.STRING
      },
      location: {
        type: Sequelize.STRING
      },
      status: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      km: {
        type: Sequelize.NUMERIC,
        defaultValue: 0
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      deletedAt: Sequelize.DATE
    }),
  down: (queryInterface, Sequelize) => queryInterface.dropTable('Cars')
};
