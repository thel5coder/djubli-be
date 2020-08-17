const Sequelize = require('sequelize');
const models = require('../db/models');

function calculate(latitude, longitude, queryLatitude, queryLongitude) {
    return `(SELECT (((acos(sin((pi() * ${latitude} / 180)) * sin((pi() * ${queryLatitude} / 180)) + cos((pi() * ${latitude} / 180)) * cos((pi() * ${queryLatitude} / 180)) * cos((pi() * (${longitude} - ${queryLongitude}) / 180))) * 180 / pi()) * 60 * 1.1515) * 1.609344))`;
}

module.exports = {
  calculate
};
