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
    to: params.userToken,
    collapseKey: params.collapseKey,
    content_available: true,
    notification: `notification`,
    data: {
      title: params.notificationTitle,
      body: params.notificationBody,
      sound: true,
      vibrate: true,
      routes: params.notificationClickAction,
      id: params.dataReferenceId
    }
  };
  if (device.toString() === 'ios') {
    Object.assign(message, {
      notification: {
        title: params.notificationTitle,
        body: params.notificationBody,
        sound: true,
        vibrate: true
      }
    });
  } else delete message.notification;

  console.log(message);

  // fcm.send(message, (err, response) => {
  //   if (err) {
  //     console.log(err);
  //     return err;
  //   }
  //   console.log(response);
  //   return response;
  // });
}

module.exports = {
  send,
  sendNew
};
