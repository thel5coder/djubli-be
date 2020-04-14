const FCM = require('fcm-node');
const key = require('../config/keys');

const serverKey = key.firebaseKey;
const fcm = new FCM(serverKey);

function send(
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

function sendNew(params) {
  if (!('device' in params)) Object.assign(params, { device: `android` });

  const message = {
    to: params.token ? params.token : null,
    collapse_key: params.collapseKey ? params.collapseKey : `green`,
    notification: { title: params.notificationTitle, body: params.notificationBody },
    priority: `high`,
    data: {
      click_action: `FLUTTER_NOTIFICATION_CLICK`,
      id: params.dataReferenceId,
      status: `done`
    }
  };

  console.log(message);
  console.log(`sendNew`);
  console.log(``);

  fcm.send(message, (err, response) => {
    if (err) {
      console.log(err);
      return err;
    }
    console.log(response);
    return response;
  });
}

module.exports = {
  send,
  sendNew
};
