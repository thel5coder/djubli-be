const FCM = require('fcm-node');
const key = require('../config/keys');

const serverKey = key.firebaseKey;
const fcm = new FCM(serverKey);

module.exports = {
  send(
    userToken,
    collapseKey,
    notificationTitle,
    notificationBody,
    notificationClickAction,
    dataReferenceId,
    device = 'android'
  ) {
    let message = '';
    if (device.toString() === 'ios') {
      message = {
        to: userToken,
        collapseKey,
        content_available: true,
        notification: {
          title: notificationTitle,
          body: notificationBody,
          sound: true,
          vibrate: true
        },
        data: {
          title: notificationTitle,
          body: notificationBody,
          sound: true,
          vibrate: true,
          routes: notificationClickAction,
          id: dataReferenceId
        }
      };
    } else {
      message = {
        to: userToken,
        collapseKey,
        content_available: true,
        data: {
          title: notificationTitle,
          body: notificationBody,
          sound: true,
          vibrate: true,
          routes: notificationClickAction,
          id: dataReferenceId
        }
      };
    }

    fcm.send(message, (err, response) => {
      if (err) {
        console.log(err);
        return err;
      }
      console.log(response);
      return response;
    });
  }
};
