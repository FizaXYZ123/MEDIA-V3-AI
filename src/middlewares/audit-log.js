'use strict';

// V3 — Priority 7: global audit logging middleware.
// Logs every successful mutating request (POST/PUT/PATCH/DELETE) made by an
// authenticated admin (or while impersonating). Read-only requests and
// requests from regular artists are skipped to keep the table focused on
// compliance-relevant events.

const SKIP_PATHS = [
  '/api/auth',
  '/api/audit-logs',
  '/api/upload', // attachments — too noisy
];

function isMutating(method) {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
}

function shouldSkip(path) {
  return SKIP_PATHS.some((p) => path.startsWith(p));
}

function isAdminLike(user) {
  if (!user) return false;
  const role = user.role;
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

function deriveTarget(path) {
  // Best-effort: turn `/api/users/42` into { type: 'users', id: '42' }.
  const m = path.match(/^\/api\/([\w-]+)(?:\/(\d+|[\w-]+))?/);
  if (!m) return { type: null, id: null };
  return { type: m[1], id: m[2] || null };
}

module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    await next();

    try {
      const method = ctx.request.method;
      const path = ctx.request.path || '';

      if (!isMutating(method)) return;
      if (shouldSkip(path)) return;
      if (ctx.response.status >= 400) return;

      const user = ctx.state?.user;
      // Only record admin or impersonation events.
      const impersonatedBy = ctx.state?.userPayload?.impersonatedBy;
      if (!isAdminLike(user) && !impersonatedBy) return;

      const target = deriveTarget(path);

      await strapi
        .service('api::audit-log.audit-log')
        .record({
          actor: impersonatedBy || user?.id || null,
          actorEmail: user?.email || null,
          impersonatedUserId: impersonatedBy ? user?.id : null,
          action: `${method} ${path}`,
          method,
          path,
          targetType: target.type,
          targetId: target.id,
          statusCode: ctx.response.status,
          ipAddress: ctx.request.ip,
          userAgent: ctx.request.header['user-agent'] || null,
          metadata: null,
        });
    } catch (err) {
      strapi.log.error('audit-log middleware: failed', err);
    }
  };
};
