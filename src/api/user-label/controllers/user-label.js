'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::user-label.user-label', ({ strapi }) => ({

  // GET /me/labels?q=po
  async findMy(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const q = (ctx.query.q || '').toString().trim().toLowerCase();
    const filters = { owner: user.id };
    if (q) {
      filters.$or = [
        { labelLower: { $contains: q } },
        { label:      { $containsi: q } },
      ];
    }

    const data = await strapi.entityService.findMany('api::user-label.user-label', {
      filters,
      sort: { label: 'asc' },
      fields: ['id', 'label'],
      populate: { owner: false },
      limit: 50,
    });

    ctx.body = { data };
  },

  // POST /me/labels/ensure  
  async ensure(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const body = ctx.request.body?.data || ctx.request.body || {};
    const raw = (body.label || '').toString().trim();
    if (!raw) return ctx.badRequest('label is required');

    const labelLower = raw.toLowerCase();

    // Check if exists for this owner
    const existing = await strapi.entityService.findMany('api::user-label.user-label', {
      filters: { owner: user.id, labelLower },
      fields: ['id', 'label'],
      limit: 1,
    });

    if (existing.length) {
      ctx.body = { data: existing[0], meta: { created: false } };
      return;
    }

    // Create new for this owner
    const created = await strapi.entityService.create('api::user-label.user-label', {
      data: { label: raw, labelLower, owner: user.id },
    });

    ctx.body = { data: { id: created.id, label: created.label }, meta: { created: true } };
  },

  // DELETE /me/labels/:id
  async deleteMy(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const { id } = ctx.params;
    if (!id) return ctx.badRequest('id is required');

    const item = await strapi.entityService.findOne('api::user-label.user-label', id, {
      populate: { owner: true },
    });
    if (!item) return ctx.notFound('Label not found');
    if (!item.owner || item.owner.id !== user.id) return ctx.forbidden('Not your label');

    const deleted = await strapi.entityService.delete('api::user-label.user-label', id);
    ctx.body = { data: { id: deleted.id, label: deleted.label } };
  },

}));
