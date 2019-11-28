/* eslint-disable linebreak-style */
const express = require('express');

const router = express.Router();

router.get('/:key', async (req, res) => {
  const { key } = req.params;

  return req.redis.get(key, (err, data) => {
    if (err) {
      return res.status(422).json({
        success: false,
        errors: 'Something wrong!!'
      });
    }

    return res.send({
      data
    });
  });
});

router.post('/', async (req, res) => {
  const { key, value } = req.body;
  // return req.redis.set(key, value, 'EX', 60, (err, data) => {
  //   console.log(err);
  //   console.log(data);
  //   req.redis.hmset(key, "data", value);
  //   if (err) {
  //     return res.status(422).json({
  //       success: false,
  //       errors: 'Something wrong!!'
  //     });
  //   }

  //   return res.send({
  //     data
  //   });
  // });

  return req.redis.set(key, value, 'EX', 60, (err, data) => {
    if (err) {
      return res.status(422).json({
        success: false,
        errors: 'Something wrong!!'
      });
    }

    return res.send({
      data
    });
  });
});

module.exports = router;
