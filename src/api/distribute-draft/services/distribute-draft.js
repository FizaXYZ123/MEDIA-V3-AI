'use strict';

/**
 * distribute-draft service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::distribute-draft.distribute-draft');
