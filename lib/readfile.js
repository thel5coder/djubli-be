const fs = require('fs');
const path = require('path');

const walkSync = (dir, filelist = []) => {
  // eslint-disable-next-line array-callback-return
  fs.readdirSync(dir).map(file => {
    // eslint-disable-next-line no-param-reassign
    filelist = fs.statSync(path.join(dir, file)).isDirectory()
      ? walkSync(path.join(dir, file), filelist)
      : filelist.concat(path.join(dir, file));
  });
  return filelist;
};

module.exports = {
  walkSync
};
