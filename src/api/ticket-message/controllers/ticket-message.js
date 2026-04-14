'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

function isAdminRequest(ctx) {
  const role = ctx.state?.user?.role;
  if (!role) return false;
  const name = String(role.name || '').toLowerCase();
  const type = String(role.type || '').toLowerCase();
  return (
    name === 'admin' ||
    name === 'super admin' ||
    name === 'super-admin' ||
    type === 'admin' ||
    type === 'super-admin'
  );
}

module.exports = createCoreController(
  'api::ticket-message.ticket-message',
  ({ strapi }) => ({
    /**
     * List messages for a ticket. Filters out `isInternal` notes for non-admins.
     */
    async find(ctx) {
      const isAdmin = isAdminRequest(ctx);
      const ticketId = ctx.query?.filters?.ticket?.id?.$eq ?? ctx.query?.ticket;

      const where = ticketId ? { ticket: ticketId } : {};
      if (!isAdmin) where.isInternal = false;

      const entries = await strapi.db
        .query('api::ticket-message.ticket-message')
        .findMany({
          where,
          orderBy: { createdAt: 'asc' },
          populate: { sender: true, attachments: true, ticket: true },
        });

      return { data: entries };
    },

    /**
     * Create a message. The sender is forced to the authenticated user.
     * Non-admins cannot post internal notes. Admins can post on any ticket;
     * regular users can only post on their own ticket.
     */
    async create(ctx) {
      const user = ctx.state.user;
      if (!user) return ctx.unauthorized('Authentication required');

      const body = ctx.request.body?.data || ctx.request.body || {};
      const { ticket, message } = body;
      const isInternal = isAdminRequest(ctx) ? !!body.isInternal : false;

      if (!ticket || !message) {
        return ctx.badRequest('ticket and message are required');
      }

      // Ownership check for non-admins
      const ticketRow = await strapi.db
        .query('api::ticket-raise.ticket-raise')
        .findOne({ where: { id: ticket }, populate: { user: true } });
      if (!ticketRow) return ctx.notFound('Ticket not found');

      if (!isAdminRequest(ctx) && ticketRow.user?.id !== user.id) {
        return ctx.forbidden('You can only post on your own ticket');
      }

      const created = await strapi.entityService.create(
        'api::ticket-message.ticket-message',
        {
          data: {
            ticket,
            message,
            isInternal,
            sender: user.id,
            publishedAt: new Date(),
          },
          populate: { sender: true, attachments: true },
        }
      );

      // Bump ticket status: when artist replies on a waiting ticket, move it
      // back to in_progress so admins see it again.
      if (!isAdminRequest(ctx) && ticketRow.status === 'waiting_on_customer') {
        await strapi.db
          .query('api::ticket-raise.ticket-raise')
          .update({ where: { id: ticket }, data: { status: 'in_progress' } });
      }

      return { data: created };
    },
  })
);
