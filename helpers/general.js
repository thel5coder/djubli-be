/* eslint-disable linebreak-style */
function mapping(objectData) {
  const tempData = [];
  objectData.map(async data => {
    tempData.push(data);
  });
  return tempData;
}

function customReplace(str, aw, ak) {
  let n = str.indexOf(aw);
  while (n >= 0) {
    str = str.replace(aw, ak);
    n = str.indexOf(aw);
  }
  return str;
}

module.exports = {
  mapping,
  customReplace
};
