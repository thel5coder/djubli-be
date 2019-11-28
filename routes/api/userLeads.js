/* eslint-disable linebreak-style */
const express = require('express');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const validator = require('validator');
const models = require('../../db/models');
const keys = require('../../config/keys');
const twilio = require('../../helpers/twilio');

const router = express.Router();

router.post('/', async (req, res) => {
  const errors = {};
  const { email, phone, type, companytype } = req.body;

  if (validator.isEmail(email ? email.toString() : '') === false) {
    return res.status(404).json({
      success: false,
      errors: 'Email is incorrect.'
    });
  }

  const trans = await models.sequelize.transaction();
  const userData = await models.UserLead.create(
    {
      email,
      phone,
      type,
      companytype,
      status: 0
    },
    {
      transaction: trans
    }
  ).catch(err => {
    res.status(422).json({
      success: false,
      errors: err
    });
  });
  const key = await userData.id;
  const payload = {
    id: userData.id
  };

  // otp
  const otp = Math.floor(1000 + Math.random() * 9000);
  await twilio.send(
    `halo djubleers ini kode otp mu ${otp}, jangan beritahukan kepada siapapun meskipun itu bapakmu`,
    phone
  );

  // redist
  return req.redis.set(key, otp, 'EX', 180, err1 => {
    if (err1) {
      trans.rollback();
      return res.status(422).json({
        success: false,
        errors: err1
      });
    }

    return jwt.sign(payload, keys.secretKey, { expiresIn: 3600 }, async (err, token) => {
      if (err) {
        trans.rollback();
        errors.jwt = `jwt error ${err}`;
        return res.status(404).json(errors);
      }
      trans.commit();
      return res.json({
        success: true,
        token: `Bearer ${token}`,
        key
      });
    });
  });
});

router.post('/insert', passport.authenticate('otp', { session: false }), async (req, res) => {
  const { otp } = req.body;
  console.log(req.user.id, '--key');
  await req.redis.get(req.user.id, (err, data) => {
    if (err) {
      return res.status(422).json({
        success: false,
        errors: err
      });
    }
    console.log(data, '-redis');

    if (otp == data) {
      return res.json({
        success: true,
        message: 'yay! we got it'
      });
    }
    console.log(data, '-----', otp);
    return res.status(422).json({
      success: false,
      errors: 'wrong otp!'
    });
  });
});

module.exports = router;
