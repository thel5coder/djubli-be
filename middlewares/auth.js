/* eslint-disable consistent-return */
const jwt = require('jsonwebtoken');

const keys = require('../config/keys');

const checkSuperAdmin = async (req, res, next) => {
  if (!req.user.isSuperAdmin)
    return res.status(500).send({ auth: false, message: 'Only superadmin can do this job' });

  return next();
};

const refreshAuth = (req, res, next) => {
  const bearerHeader = req.headers.authorization;
  if (typeof bearerHeader !== 'undefined') {
    const bearer = bearerHeader.split(' ');
    const bearerToken = bearer[1];
    jwt.verify(bearerToken, keys.refreshSecret, (err, decoded) => {
      if (err)
        return res.status(500).send({ auth: false, message: 'Failed to authenticate token.' });
      req.user = decoded;
      next();
    });
  } else {
    res.status(403).send({ auth: false, message: 'No token provided.' });
  }
};

module.exports = {
  checkSuperAdmin,
  refreshAuth
};
