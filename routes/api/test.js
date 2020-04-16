/* eslint-disable linebreak-style */
const express = require('express');
const passport = require('passport');
const Sequelize = require('sequelize');
const models = require('../../db/models');

const notification = require('../../helpers/notification');
const carHelper = require('../../helpers/car');

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

router.get(
  '/responses/jual/:id',
  passport.authenticate('user', { session: false }),
  async (req, res) => {
    const { id } = req.params;
    const { notifJualStatus } = req.body;
    const userId = req.user.id;
    const emit = await carHelper.emitJual({
      id,
      userId,
      notifJualStatus: notifJualStatus ? notifJualStatus : null
    });
    req.io.emit(`tabJual-${userId}`, emit);

    console.log(emit);
    return res.status(200).json({
      success: true,
      data: emit
    });
  }
);

module.exports = router;
