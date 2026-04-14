'use strict';

// V3 — Priority 6: admin impersonation controller.
// Issues a short-lived JWT for the target user and records the actor in the
// token payload so audit logging can attribute all subsequent actions back
// to the original admin.

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

module.exports = {
  async impersonate(ctx) {
    const actor = ctx.state.user;
    if (!actor) return ctx.unauthorized('Authentication required');
    if (!isAdminRequest(ctx)) return ctx.forbidden('Admins only');

    const { userId } = ctx.params;
    if (!userId) return ctx.badRequest('userId is required');

    const target = await strapi
      .query('plugin::users-permissions.user')
      .findOne({
        where: { id: userId },
        populate: { role: true, plan: true },
      });

    if (!target) return ctx.notFound('Target user not found');

    // Disallow impersonating other admins for safety.
    const targetRoleName = String(target.role?.name || '').toLowerCase();
    const targetRoleType = String(target.role?.type || '').toLowerCase();
    if (
      targetRoleName.includes('admin') ||
      targetRoleType === 'admin' ||
      targetRoleType === 'super-admin'
    ) {
      return ctx.forbidden('Cannot impersonate another admin user');
    }

    const jwt = strapi.plugins['users-permissions'].services.jwt.issue(
      {
        id: target.id,
        // Carry impersonation provenance through the token. Audit middleware
        // can read this to label entries as "actor X acting as Y".
        impersonatedBy: actor.id,
      },
      { expiresIn: '1h' }
    );

    // Strip sensitive fields before returning.
    const sanitized = {
      id: target.id,
      username: target.username,
      email: target.email,
      firstName: target.firstName,
      lastName: target.lastName,
      role: target.role,
      plan: target.plan,
    };

    ctx.body = {
      jwt,
      user: sanitized,
      impersonation: {
        actorId: actor.id,
        actorEmail: actor.email,
        targetId: target.id,
        targetEmail: target.email,
        startedAt: new Date().toISOString(),
        expiresInSeconds: 60 * 60,
      },
    };
  },
};
