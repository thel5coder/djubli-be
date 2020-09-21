/* eslint-disable linebreak-style */
const { ExtractJwt, Strategy } = require('passport-jwt');
const models = require('../db/models/index');
const keys = require('./keys');

const opts = {};
opts.jwtFromRequest = ExtractJwt.fromAuthHeaderAsBearerToken();
opts.secretOrKey = keys.secretKey;

module.exports = passport => {
  passport.use(
    'otp',
    new Strategy(opts, async (jwtPayload, done) => {
      console.log(opts);
      console.log(jwtPayload);
      const data = await models.UserLead.findByPk(jwtPayload.id);
      if (data) {
        return done(null, data);
      }

      return done(null, false);
    })
  );

  passport.use(
    'admin',
    new Strategy(opts, async (jwtPayload, done) => {
      const data = await models.Admin.findByPk(jwtPayload.id);
      if (data) {
        return done(null, data);
      }

      return done(null, false);
    })
  );

  passport.use(
    'user',
    new Strategy(opts, async (jwtPayload, done) => {
      console.log(jwtPayload);
      const data = await models.User.findByPk(jwtPayload.id);
      if (data) {
        return done(null, data);
      }

      return done(null, false);
    })
  );
};
