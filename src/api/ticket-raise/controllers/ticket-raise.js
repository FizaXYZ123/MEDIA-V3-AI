'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::ticket-raise.ticket-raise', ({ strapi }) => ({

  // Get all tickets with populated attachments
  async find(ctx) {
    const { query } = ctx;

    const entity = await strapi.service('api::ticket-raise.ticket-raise').find({
      ...query,
      populate: {
        attachment: true,
        messages: {
          populate: {
            sender: true,
            attachments: true
          }
        },
        user: {
          populate: {
            Profile_image: true, // directly populate profile image
          },
        },
      },
      sort: ctx.query.sort || 'id:desc',
    });

    return entity;
  },

  // Get one ticket, populate attachments, and mark as read
  async findOne(ctx) {
    const { id } = ctx.params;

    const entity = await strapi.service('api::ticket-raise.ticket-raise').findOne(id, {
      populate: {
        attachment: true,
         messages: {
          populate: {
            sender: true,
            attachments: true
          }
        },
        user: {
          populate: {
            Profile_image: true,
          },
        },
      },
    });

    if (!entity) {
      return ctx.notFound('Ticket not found');
    }

    // Mark ticket as read
    await strapi.db.query('api::ticket-raise.ticket-raise').update({
      where: { id },
      data: { is_read: true },
    });

    return { ...entity, is_read: true };
  },

  // Create ticket with attachments
  async create(ctx) {
    const { files } = ctx.request;
    let data = ctx.request.body.data;

    // If data is string, parse it
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (err) {
        return ctx.badRequest('Invalid JSON in data field');
      }
    }

    const entity = await strapi.service('api::ticket-raise.ticket-raise').create({
      data,
      files,
      populate: { attachment: true, user: true },
    });

    return entity;
  },

  // Update ticket (with optional attachments)
  async update(ctx) {
    const { id } = ctx.params;
    const { files } = ctx.request;
    let data = ctx.request.body.data;

    // Only parse if data is a string
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (err) {
        return ctx.badRequest('Invalid JSON in data field');
      }
    }

    const entity = await strapi.service('api::ticket-raise.ticket-raise').update(id, {
      data,
      files,
      populate: { attachment: true, user: true },
    });

    return entity;
  },

  // Delete ticket
  async delete(ctx) {
    const { id } = ctx.params;
    const entity = await strapi.service('api::ticket-raise.ticket-raise').delete(id, {
      populate: { attachment: true, user: true },
    });
    return entity;
  },

}));
