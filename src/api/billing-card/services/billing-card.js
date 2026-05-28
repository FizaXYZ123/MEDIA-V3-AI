'use strict';

/**
 * billing-card service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::billing-card.billing-card');
