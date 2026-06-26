"use strict";

module.exports = {

  async createTicket(ctx) {
    return await strapi
      .service("api::ticket-raise.ticket-raise")
      .createTicket(ctx);
  },

  async myTickets(ctx) {
    return await strapi
      .service("api::ticket-raise.ticket-raise")
      .myTickets(ctx);
  },

  async findOne(ctx) {
    return await strapi
      .service("api::ticket-raise.ticket-raise")
      .findOne(ctx);
  },

  async reply(ctx) {
    return await strapi
      .service("api::ticket-raise.ticket-raise")
      .reply(ctx);
  },

  async adminTickets(ctx) {
    return await strapi
      .service("api::ticket-raise.ticket-raise")
      .adminTickets(ctx);
  },
  
  async resolve(ctx) {
  return await strapi
    .service("api::ticket-raise.ticket-raise")
    .resolve(ctx);
}

};