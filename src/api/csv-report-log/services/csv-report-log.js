'use strict';

/**
 * csv-report-log service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::csv-report-log.csv-report-log');
