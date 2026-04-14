'use strict';

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::ticket-message.ticket-message');
