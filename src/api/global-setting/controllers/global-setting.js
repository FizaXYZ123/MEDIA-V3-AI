'use strict';

// V3 — Priority 9: ensure the single-type global-setting is always
// accessible (auto-created on first read) and that updates only work for
// admins.

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
  'api::global-setting.global-setting',
  ({ strapi }) => ({
    async find(ctx) {
      const settings = await strapi
        .service('api::global-setting.global-setting')
        .getOrCreate();
      ctx.body = { data: settings };
    },

    async update(ctx) {
      if (!isAdminRequest(ctx)) return ctx.forbidden('Admins only');

      const body = ctx.request.body?.data || ctx.request.body || {};
      const current = await strapi
        .service('api::global-setting.global-setting')
        .getOrCreate();

      const updated = await strapi.entityService.update(
        'api::global-setting.global-setting',
        current.id,
        { data: body }
      );

      ctx.body = { data: updated };
    },
  })
);
