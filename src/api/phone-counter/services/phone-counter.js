'use strict';

/**
 * phone-counter service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::phone-counter.phone-counter');
