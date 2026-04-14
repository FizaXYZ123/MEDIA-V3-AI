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
  'api::audit-log.audit-log',
  ({ strapi }) => ({
    async find(ctx) {
      if (!isAdminRequest(ctx)) return ctx.forbidden('Admins only');

      const { actorId, action, targetType, from, to } = ctx.query || {};
      const where = {};
      if (actorId) where.actor = actorId;
      if (action) where.action = { $containsi: action };
      if (targetType) where.targetType = targetType;
      if (from || to) {
        where.createdAt = {};
        if (from) where.createdAt.$gte = from;
        if (to) where.createdAt.$lte = to;
      }

      const page = Number(ctx.query.page || 1);
      const pageSize = Math.min(Number(ctx.query.pageSize || 50), 200);

      const [entries, total] = await Promise.all([
        strapi.db.query('api::audit-log.audit-log').findMany({
          where,
          orderBy: { createdAt: 'desc' },
          populate: { actor: true },
          limit: pageSize,
          offset: (page - 1) * pageSize,
        }),
        strapi.db.query('api::audit-log.audit-log').count({ where }),
      ]);

      ctx.body = {
        data: entries,
        meta: {
          pagination: {
            page,
            pageSize,
            total,
            pageCount: Math.ceil(total / pageSize),
          },
        },
      };
    },
  })
);
