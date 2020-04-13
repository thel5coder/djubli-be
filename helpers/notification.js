/* eslint-disable array-callback-return */
const firebaseHelper = require('./firebase');
const models = require('../db/models');

async function userNotif(params) {
  const userTokens = await models.UserToken.findAll({
    where: {
      userId: params.userId
    }
  });

  userTokens.map(async ut => {
    firebaseHelper.sendNew({
      token: ut.token,
      collapseKey: params.collapseKey,
      notificationTitle: params.notificationTitle,
      notificationBody: params.notificationBody,
      notificationClickAction: params.notificationClickAction,
      dataReferenceId: params.dataReferenceId,
      type: ut.type
    });
  });
}

module.exports = {
  userNotif
};
