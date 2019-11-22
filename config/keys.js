console.log(`Node environment is: ${process.env.NODE_ENV}`);
module.exports = {
  secretKey: process.env.SECRET_KEY,
  refreshSecret: process.env.REFRESH_SECRET_KEY,
  serverUrl: process.env.SERVER_URL,
  stripeKey: process.env.STRIPE_SECRET_KEY,
  firebaseKey: process.env.FIREBASE_KEY
};
