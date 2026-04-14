'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

const USER_API = 'plugin::users-permissions.user';
const PAYOUT_API = 'api::payout-request.payout-request';

function isAdminRequest(ctx) {
  // Strapi users-permissions: clients have role.type "authenticated" / "client".
  // Admins are typically a custom role named "admin" / "super-admin".
  // We accept either by name or by type.
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

async function loadFullUser(userId) {
  return strapi.db.query(USER_API).findOne({
    where: { id: userId },
    select: [
      'id',
      'email',
      'availableBalance',
      'pendingBalance',
      'paymentMethod',
    ],
  });
}

async function loadGlobalSettings() {
  return strapi
    .service('api::global-setting.global-setting')
    .getOrCreate();
}

module.exports = createCoreController(PAYOUT_API, ({ strapi }) => ({

  /**
   * Artist creates a payout request.
   * Body: { amount }
   * Validates:
   *   - user authenticated
   *   - amount > 0
   *   - user.availableBalance >= globalSettings.minimumPayoutThreshold
   *   - user.availableBalance >= amount
   */
  async create(ctx) {
    const authUser = ctx.state.user;
    if (!authUser) return ctx.unauthorized('Authentication required');

    const amount = Number(ctx.request.body?.data?.amount ?? ctx.request.body?.amount);
    if (!amount || isNaN(amount) || amount <= 0) {
      return ctx.badRequest('A positive amount is required');
    }

    const fresh = await loadFullUser(authUser.id);
    if (!fresh) return ctx.notFound('User not found');

    const settings = await loadGlobalSettings();
    const threshold = Number(settings.minimumPayoutThreshold || 0);
    const balance = Number(fresh.availableBalance || 0);

    if (balance < threshold) {
      return ctx.badRequest(
        `Available balance ${balance} is below the minimum payout threshold ${threshold}`
      );
    }
    if (balance < amount) {
      return ctx.badRequest(
        `Requested amount ${amount} exceeds available balance ${balance}`
      );
    }

    const created = await strapi.entityService.create(PAYOUT_API, {
      data: {
        user: fresh.id,
        amount,
        currency: 'USD',
        status: 'pending',
        paymentMethodSnapshot: fresh.paymentMethod || null,
        publishedAt: new Date(),
      },
    });

    // Move funds from available -> pending so balance reflects the held amount.
    const newAvailable = Number((balance - amount).toFixed(2));
    const newPending = Number((Number(fresh.pendingBalance || 0) + amount).toFixed(2));

    await strapi.db.query(USER_API).update({
      where: { id: fresh.id },
      data: { availableBalance: newAvailable, pendingBalance: newPending },
    });

    return ctx.send({ data: created });
  },

  /**
   * Admin approves a pending request.
   * Funds were already moved to pending on creation; approval just transitions status.
   */
  async approve(ctx) {
    if (!isAdminRequest(ctx)) return ctx.forbidden('Admin only');

    const { id } = ctx.params;
    const existing = await strapi.entityService.findOne(PAYOUT_API, id, {
      populate: { user: true },
    });
    if (!existing) return ctx.notFound('Payout request not found');
    if (existing.status !== 'pending') {
      return ctx.badRequest(`Cannot approve a request in status "${existing.status}"`);
    }

    const updated = await strapi.entityService.update(PAYOUT_API, id, {
      data: {
        status: 'approved',
        reviewedBy: ctx.state.user.id,
        reviewedAt: new Date(),
      },
    });

    try {
      await strapi.entityService.create('api::notification.notification', {
        data: {
          title: 'Payout Approved',
          message: `Your payout request of ${existing.amount} ${existing.currency || 'USD'} has been approved.`,
          users_permissions_user: existing.user?.id,
          publishedAt: new Date(),
        },
      });
    } catch (_) {}

    return ctx.send({ data: updated });
  },

  /**
   * Admin marks an approved request as completed.
   * Body: { transactionReference }
   * Clears the held pending balance for this user.
   */
  async complete(ctx) {
    if (!isAdminRequest(ctx)) return ctx.forbidden('Admin only');

    const { id } = ctx.params;
    const transactionReference =
      ctx.request.body?.data?.transactionReference ??
      ctx.request.body?.transactionReference ??
      null;

    const existing = await strapi.entityService.findOne(PAYOUT_API, id, {
      populate: { user: true },
    });
    if (!existing) return ctx.notFound('Payout request not found');
    if (!['approved', 'processing'].includes(existing.status)) {
      return ctx.badRequest(`Cannot complete a request in status "${existing.status}"`);
    }

    const updated = await strapi.entityService.update(PAYOUT_API, id, {
      data: {
        status: 'completed',
        completedAt: new Date(),
        transactionReference,
      },
    });

    // Release the held pending amount (funds have left the platform).
    const fresh = await loadFullUser(existing.user.id);
    if (fresh) {
      const newPending = Number(
        Math.max(0, Number(fresh.pendingBalance || 0) - Number(existing.amount || 0)).toFixed(2)
      );
      await strapi.db.query(USER_API).update({
        where: { id: fresh.id },
        data: { pendingBalance: newPending },
      });
    }

    try {
      await strapi.entityService.create('api::notification.notification', {
        data: {
          title: 'Payout Completed',
          message: `Your payout of ${existing.amount} ${existing.currency || 'USD'} has been sent. Reference: ${transactionReference || 'N/A'}`,
          users_permissions_user: existing.user?.id,
          publishedAt: new Date(),
        },
      });
    } catch (_) {}

    return ctx.send({ data: updated });
  },

  /**
   * Admin rejects a request and returns the funds to availableBalance.
   * Body: { rejectionReason }
   */
  async reject(ctx) {
    if (!isAdminRequest(ctx)) return ctx.forbidden('Admin only');

    const { id } = ctx.params;
    const rejectionReason =
      ctx.request.body?.data?.rejectionReason ??
      ctx.request.body?.rejectionReason ??
      null;

    const existing = await strapi.entityService.findOne(PAYOUT_API, id, {
      populate: { user: true },
    });
    if (!existing) return ctx.notFound('Payout request not found');
    if (!['pending', 'approved'].includes(existing.status)) {
      return ctx.badRequest(`Cannot reject a request in status "${existing.status}"`);
    }

    const updated = await strapi.entityService.update(PAYOUT_API, id, {
      data: {
        status: 'rejected',
        rejectionReason,
        reviewedBy: ctx.state.user.id,
        reviewedAt: new Date(),
      },
    });

    // Return funds: pending -> available
    const fresh = await loadFullUser(existing.user.id);
    if (fresh) {
      const amount = Number(existing.amount || 0);
      const newPending = Number(
        Math.max(0, Number(fresh.pendingBalance || 0) - amount).toFixed(2)
      );
      const newAvailable = Number(
        (Number(fresh.availableBalance || 0) + amount).toFixed(2)
      );
      await strapi.db.query(USER_API).update({
        where: { id: fresh.id },
        data: { pendingBalance: newPending, availableBalance: newAvailable },
      });
    }

    try {
      await strapi.entityService.create('api::notification.notification', {
        data: {
          title: 'Payout Rejected',
          message: `Your payout request was rejected${rejectionReason ? `: ${rejectionReason}` : '.'} Funds have been returned to your available balance.`,
          users_permissions_user: existing.user?.id,
          publishedAt: new Date(),
        },
      });
    } catch (_) {}

    return ctx.send({ data: updated });
  },

}));
