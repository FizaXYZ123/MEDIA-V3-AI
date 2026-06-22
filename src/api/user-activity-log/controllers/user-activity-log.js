"use strict";

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController('api::user-activity-log.user-activity-log');