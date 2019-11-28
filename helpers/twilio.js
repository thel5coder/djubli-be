const Twilio = require('twilio');
const keys = require('../config/keys');

const accountSid = keys.twilioSid;
const authToken = keys.twilioToken;
const from = keys.twilioNumber;
const client = new Twilio(accountSid, authToken);

module.exports = {
  send(body, to) {
    console.log(body, to, 'console twilio', accountSid, authToken, from);

    return client.messages
      .create({
        body,
        to,
        from
      })
      .then((err, message) => {
        console.log(err, message, 'ada apa denganmu');
        if (err) {
          console.log(err);
          return err;
        }

        console.log(message.sid);
        return message;
      })
      .catch(err => {
        console.log(err);
        return err;
      });
  }
};
