/* eslint-disable linebreak-style */
const express = require('express');
const passport = require('passport');
const Sequelize = require('sequelize');
const notification = require('../../helpers/notification');

const { Op } = Sequelize;
const router = express.Router();

router.post('/firebase', passport.authenticate('user', { session: false }), async (req, res) => {
  const { id } = req.user;
  const { title, body, action } = req.body;
  const data = { id: 123 };
  const userNotif = {
    userId: id,
    collapseKey: null,
    notificationTitle: title ? title : `Car Sell`,
    notificationBody: body ? `${body} #${data.id}` : `Car Sell #${data.id}`,
    notificationClickAction: action ? action : `carSell`,
    dataReferenceId: data.id
  };
  notification.userNotif(userNotif);

  return res.status(200).json({
    success: true,
    data: `parameter oke`
  });
});
router.post('/socket', passport.authenticate('user', { session: false }), async (req, res) => {
  const { id } = req.user;
  let { socketId, attributeId } = req.body;
  socketId = socketId ? socketId : `notification`;
  attributeId = attributeId ? attributeId : id;
  const data = { id: 123, description: `test` };

  req.io.emit(`${socketId}-${attributeId}`, JSON.stringify({ data }));

  return res.status(200).json({
    success: true,
    data: `parameter oke`
  });
});

module.exports = router;
