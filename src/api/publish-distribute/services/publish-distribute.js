'use strict';

/**
 * publish-distribute service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::publish-distribute.publish-distribute');
