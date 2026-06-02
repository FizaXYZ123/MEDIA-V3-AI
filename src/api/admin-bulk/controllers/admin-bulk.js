'use strict';

// V3 — Priority 8: bulk admin actions controller.
//
// Each handler accepts `{ ids: number[], action: string, payload?: object }`
// and processes the records sequentially so a single bad row only fails its
// own update. Returns a per-id success/error map for the UI to display.

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
    type === 'super-admin' ||
    name === 'authenticated' ||
    type === 'authenticated'
  );
}

const USER_ACTIONS = {
  block: { blocked: true },
  unblock: { blocked: false },
};

const RELEASE_ACTIONS = {
  approve: { release_status: 'approved' },
  reject: { release_status: 'rejected' },
  delete: null, // handled separately
};

module.exports = {
  async bulkUpdateUsers(ctx) {
    if (!isAdminRequest(ctx)) return ctx.forbidden('Admins only');

    const { ids, action, payload } = ctx.request.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return ctx.badRequest('ids array is required');
    }
    if (!action || (!USER_ACTIONS[action] && action !== 'set-plan')) {
      return ctx.badRequest('unsupported action');
    }

    const results = [];
    for (const id of ids) {
      try {
        let data;
        if (action === 'set-plan') {
          if (!payload?.planId)
            throw new Error('payload.planId required for set-plan');
          data = { plan: payload.planId };
        } else {
          data = USER_ACTIONS[action];
        }
        await strapi.entityService.update(
          'plugin::users-permissions.user',
          id,
          { data }
        );
        results.push({ id, ok: true });
      } catch (err) {
        strapi.log.warn(`bulk-update-users failed for ${id}: ${err.message}`);
        results.push({ id, ok: false, error: err.message });
      }
    }

    ctx.body = { results, processed: results.length };
  },

  async bulkUpdateReleases(ctx) {
    if (!isAdminRequest(ctx)) return ctx.forbidden('Admins only');

    const { ids, action } = ctx.request.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return ctx.badRequest('ids array is required');
    }
    if (!action || !(action in RELEASE_ACTIONS)) {
      return ctx.badRequest('unsupported action');
    }

    const results = [];
    for (const id of ids) {
      try {
        if (action === 'delete') {
          await strapi.entityService.delete(
            'api::publish-distribute.publish-distribute',
            id
          );
        } else {
          await strapi.entityService.update(
            'api::publish-distribute.publish-distribute',
            id,
            { data: RELEASE_ACTIONS[action] }
          );
        }
        results.push({ id, ok: true });
      } catch (err) {
        strapi.log.warn(
          `bulk-update-releases failed for ${id}: ${err.message}`
        );
        results.push({ id, ok: false, error: err.message });
      }
    }

    ctx.body = { results, processed: results.length };
  },
};
