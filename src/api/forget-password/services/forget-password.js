'use strict';

/**
 * forget-password service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::forget-password.forget-password');
