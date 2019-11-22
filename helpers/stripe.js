/* eslint-disable no-param-reassign */
/* eslint-disable camelcase */
/* eslint-disable import/order */
const keys = require('../config/keys');
const stripe = require('stripe')(keys.stripeKey);
const models = require('../db/models');

module.exports = {
  async createCustomer(customerId) {
    const customer = await stripe.customers
      .create({
        description: `Customer ID ${customerId}`
      })
      .catch(() => null);
    return customer;
  },

  async getCustomer(customerId) {
    const cust = await stripe.customers.retrieve(customerId).catch(() => null);
    return cust;
  },

  async saveCard(number, exp_month, exp_year, cvc, customerId) {
    number = number.toString();
    exp_month = parseInt(exp_month, 10);
    exp_year = parseInt(exp_year, 10);
    cvc = cvc.toString();
    const card = await stripe.tokens
      .create({
        card: {
          number,
          exp_month,
          exp_year,
          cvc
        }
      })
      .catch(() => null);
    if (!card) return null;

    const tokenID = card.id;

    return stripe.customers
      .createSource(customerId, {
        source: tokenID
      })
      .catch(() => null);
  },

  async removeCard(customerId, cardId) {
    const card = await stripe.customers.deleteSource(customerId, cardId).catch(() => null);
    return card;
  },

  async chargeCard(amount, customer, card, description) {
    const currency = await models.Currency.findOne();
    if (!currency) return null;

    const charge = await stripe.charges
      .create({
        amount: parseFloat(amount, 10) * currency.stripeConversion,
        currency: currency.code,
        customer,
        card,
        description,
        capture: false
      })
      .catch(() => null);
    return charge;
  },

  async chargeCardCaptured(amount, customer, card, description) {
    const currency = await models.Currency.findOne();
    if (!currency) return null;

    const charge = await stripe.charges
      .create({
        amount: parseFloat(amount, 10) * currency.stripeConversion,
        currency: currency.code,
        customer,
        card,
        description
      })
      .catch(() => null);
    return charge;
  },

  async captureTransaction(transactionId) {
    const charge = await stripe.charges.capture(transactionId).catch(() => null);
    return charge;
  },

  async captureTransactionPartial(transactionId, amount) {
    const currency = await models.Currency.findOne();
    if (!currency) return null;

    const charge = await stripe.charges
      .capture(transactionId, {
        amount: parseFloat(amount, 10) * currency.stripeConversion
      })
      .catch(() => null);
    return charge;
  },

  async refundTransaction(transactionId) {
    const charge = await stripe.refunds
      .create({
        charge: transactionId
      })
      .catch(() => null);
    return charge;
  },

  async refundTransactionPartial(transactionId, amount) {
    const currency = await models.Currency.findOne();
    if (!currency) return null;

    const charge = await stripe.refunds
      .create({
        charge: transactionId,
        amount: parseFloat(amount, 10) * currency.stripeConversion
      })
      .catch(() => null);
    return charge;
  },

  async viewTransaction(transactionId) {
    const charge = await stripe.charges.retrieve(transactionId).catch(() => null);
    return charge;
  }
};
