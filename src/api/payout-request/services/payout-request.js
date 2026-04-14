'use strict';

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::payout-request.payout-request');
