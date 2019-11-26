/* eslint-disable linebreak-style */
function mapping(objectData) {
  const tempData = [];
  objectData.map(async data => {
    tempData.push(data);
  });
  return tempData;
}

module.exports = {
  mapping
};
