'use strict';
const createUserActivityLog = require("../../../utils/user-activity-log");

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


  async create(ctx) {
    const authUser = ctx.state.user;

    if (!authUser) {
      return ctx.unauthorized("Authentication required");
    }

    const amount = Number(
      ctx.request.body?.data?.amount ?? ctx.request.body?.amount
    );

    const userPayoutDetailId =
      ctx.request.body?.data?.userPayoutDetailId ??
      ctx.request.body?.userPayoutDetailId;

    if (!amount || isNaN(amount) || amount <= 0) {
      return ctx.badRequest("A positive amount is required");
    }

    if (!userPayoutDetailId) {
      return ctx.badRequest("Please select a payout account");
    }

    const fresh = await loadFullUser(authUser.id);

    if (!fresh) {
      return ctx.notFound("User not found");
    }

    const payoutDetail = await strapi.entityService.findOne(
      "api::user-payout-detail.user-payout-detail",
      userPayoutDetailId,
      {
        populate: {
          userDetail: true,
        },
      }
    );

    if (!payoutDetail) {
      return ctx.notFound("Selected payout account not found");
    }

    // Security check - ensure account belongs to logged in user
    if (payoutDetail.userDetail?.id !== fresh.id) {
      return ctx.forbidden(
        "You are not authorized to use this payout account"
      );
    }



    const settings = await loadGlobalSettings();

    const threshold = Number(
      settings.minimumPayoutThreshold || 50
    );

    const invoices = await strapi.entityService.findMany(
      "api::invoice.invoice",
      {
        filters: {
          users_permissions_user: {
            id: authUser.id,
          },
        },
        fields: ["finalAmountPayable"],
      }
    );

    const payoutRequests = await strapi.entityService.findMany(
      "api::payout-request.payout-request",
      {
        filters: {
          user: {
            id: authUser.id,
          },
          status: "completed",
        },
        fields: ["amount"],
      }
    );

    const totalEarned = invoices.reduce(
      (sum, invoice) =>
        sum + Number(invoice.finalAmountPayable || 0),
      0
    );

    const totalPaid = payoutRequests.reduce(
      (sum, payout) =>
        sum + Number(payout.amount || 0),
      0
    );

    const balance = Math.max(
      totalEarned - totalPaid,
      0
    );

    // Requested amount must be at least minimum threshold
    if (amount < threshold) {
      return ctx.badRequest(
        `Minimum withdrawal amount is ${threshold}`
      );
    }

    // User cannot withdraw more than available balance
    if (amount > balance) {
      return ctx.badRequest(
        `Requested amount ${amount} exceeds available balance ${balance}`
      );
    }

    const created = await strapi.entityService.create(
      PAYOUT_API,
      {
        data: {
          user: fresh.id,
          amount,
          currency: payoutDetail.currency,
          status: "pending",

          user_payout_detail: payoutDetail.id,

          publishedAt: new Date(),
        },
      }
    );

    await createUserActivityLog({
      userId: fresh.id,
      action: "withdraw_request",
      description: `Withdrawal request submitted for ${amount} ${payoutDetail.currency}. Request ID: ${created.id}`,
    });

    // Move funds from available -> pending
    const newAvailable = Number(
      (balance - amount).toFixed(2)
    );

    const newPending = Number(
      (
        Number(fresh.pendingBalance || 0) + amount
      ).toFixed(2)
    );

    await strapi.db.query(USER_API).update({
      where: { id: fresh.id },
      data: {
        availableBalance: newAvailable,
        pendingBalance: newPending,
      },
    });

    return ctx.send({
      success: true,
      message: "Payout request submitted successfully",
      data: created,
    });
  },

 async find(ctx) {
  try {
    const authUser = ctx.state.user;

    if (!authUser) {
      return ctx.unauthorized("Unauthorized.");
    }

    const currentUser = await strapi.entityService.findOne(
      "plugin::users-permissions.user",
      authUser.id,
      {
        populate: {
          role: true,
        },
      }
    );

    const role = currentUser?.role?.name;

    const filters = { ...(ctx.query.filters || {}) };

    // Client can only see their own payout requests
    if (role === "Client") {
      filters.user = authUser.id;
    }
    // Authenticated & SubAdmin can see all requests
    else if (!["Authenticated", "SubAdmin"].includes(role)) {
      return ctx.forbidden("You are not authorized to access payout requests.");
    }

    const { results, pagination } = await strapi
      .service("api::payout-request.payout-request")
      .find({
        ...ctx.query,
        filters,
        populate: {
          user_payout_detail: true,
          reviewedBy: true,
        },
        sort: {
          createdAt: "desc",
        },
      });

    return {
      data: results,
      meta: {
        pagination,
      },
    };
  } catch (error) {
    strapi.log.error(error);
    return ctx.internalServerError("Failed to fetch payout requests");
  }
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
    } catch (_) { }

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
    } catch (_) { }

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
    } catch (_) { }

    return ctx.send({ data: updated });
  },

}));
