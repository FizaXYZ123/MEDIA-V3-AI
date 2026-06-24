module.exports = {

  async getMyBalance(ctx) {
    try {
      const authUser = ctx.state.user;

      if (!authUser) {
        return ctx.unauthorized(
          "You are not authorized to access this resource."
        );
      }

      const userId = authUser.id;

      const invoices = await strapi.entityService.findMany(
        "api::invoice.invoice",
        {
          filters: {
            users_permissions_user: {
              id: userId,
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
              id: userId,
            },
            status: {
              $ne: "rejected",
            },
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

      const availableBalance = Math.max(
        totalEarned - totalPaid,
        0
      );

      return ctx.send({
        availableBalance,
      });
    } catch (error) {
      strapi.log.error(
        "Error fetching payout balance:",
        error
      );

      return ctx.internalServerError(
        "Failed to fetch payout balance"
      );
    }
  }

}