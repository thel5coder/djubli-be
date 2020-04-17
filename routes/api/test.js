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
  const { title, body, action, carId } = req.body;
  let { socketId, attributeId } = req.body;
  socketId = socketId ? socketId : `notification`;
  attributeId = attributeId ? attributeId : id;

  const data = { id: carId ? carId : 13 };
  const userNotif = {
    userId: id,
    collapseKey: null,
    notificationTitle: title ? title : `Car Sell`,
    notificationBody: body ? `${body} #${data.id}` : `Car Sell #${data.id}`,
    notificationClickAction: action ? action : `carSell`,
    dataReferenceId: data.id,
    category: 1,
    status: 1
  };
  const emit = await notification.insertNotification(userNotif);
  req.io.emit(`${socketId}-${attributeId}`, emit);
  notification.userNotif(userNotif);

  return res.status(200).json({
    success: true,
    data: `parameter oke`,
    emit
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

router.post(
  '/responses/jual/:id',
  passport.authenticate('user', { session: false }),
  async (req, res) => {
    const { id } = req.params;
    const { notifJualStatus } = req.body;
    const userId = req.user.id;
    const emit = await carHelper.emitJual({
      id,
      userId,
      notifJualStatus: notifJualStatus ? Number(notifJualStatus) : null
    });
    req.io.emit(`tabJual-${userId}`, JSON.stringify(emit));

    console.log(emit);
    return res.status(200).json({
      success: true,
      data: emit
    });
  }
);

module.exports = router;
