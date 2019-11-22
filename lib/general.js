const bcrypt = require('bcryptjs');

async function encryptPassword(password) {
  const hashResult = await new Promise((resolve, reject) => {
    bcrypt.genSalt(10, (err, salt) => {
      bcrypt.hash(password, salt, (error, hash) => {
        if (error) reject(error);
        resolve(hash);
      });
    });
  });
  return hashResult;
}

function paging(page, count, limit) {
  return {
    currentPage: parseInt(page, 10),
    lastPage: parseInt(count / limit, 10) + parseInt(count % limit !== 0 ? 1 : 0, 10),
    count,
    recordPerPage: parseInt(limit, 10)
  };
}

module.exports = {
  encryptPassword,
  paging
};
