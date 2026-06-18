'use strict';

/**
 * user-activity-log service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::user-activity-log.user-activity-log');
