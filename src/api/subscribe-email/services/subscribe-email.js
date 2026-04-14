'use strict';

/**
 * subscribe-email service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::subscribe-email.subscribe-email');
