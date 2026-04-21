'use strict';

/**
 * payment-log service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::payment-log.payment-log');
