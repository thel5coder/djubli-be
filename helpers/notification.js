/* eslint-disable array-callback-return */
const firebaseHelper = require('./firebase');
const models = require('../db/models');

async function userNotif(
  userId,
  collapseKey,
  notificationTitle,
  notificationBody,
  notificationClickAction,
  dataReferenceId
) {
  const userToken = await models.UserFirebaseToken.findAll({
    where: {
      userId
    }
  });

  userToken.map(ut => {
    firebaseHelper.send(
      ut.token,
      collapseKey,
      notificationTitle,
      notificationBody,
      notificationClickAction,
      dataReferenceId,
      ut.type
    );
  });
}

async function jockeyNotif(
  jockeyId,
  collapseKey,
  notificationTitle,
  notificationBody,
  notificationClickAction,
  dataReferenceId
) {
  const jockeyToken = await models.JockeyFirebaseToken.findAll({
    where: {
      jockeyId
    }
  });

  jockeyToken.map(jt => {
    firebaseHelper.send(
      jt.token,
      collapseKey,
      notificationTitle,
      notificationBody,
      notificationClickAction,
      dataReferenceId,
      jt.type
    );
  });
}

module.exports = {
  userNotif,
  jockeyNotif
};
