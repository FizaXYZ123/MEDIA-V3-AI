'use strict';

/**
 * ticket-raise service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::ticket-raise.ticket-raise');
