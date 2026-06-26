"use strict";

module.exports = async (strapi) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  while (true) {
    let ticketNumber = "TKT-";

    for (let i = 0; i < 6; i++) {
      ticketNumber += chars.charAt(
        Math.floor(Math.random() * chars.length)
      );
    }

    const existing = await strapi.entityService.findMany(
      "api::ticket-raise.ticket-raise",
      {
        filters: {
          ticketNumber,
        },
        limit: 1,
      }
    );

    if (!existing.length) {
      return ticketNumber;
    }
  }
};