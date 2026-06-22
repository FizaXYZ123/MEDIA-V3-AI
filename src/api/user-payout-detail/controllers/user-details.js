module.exports = {
async myAccounts(ctx) {
  try {
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized("You must be logged in");
    }

    console.log("user",user)

    const accounts = await strapi.entityService.findMany(
      "api::user-payout-detail.user-payout-detail",
      {
        filters: {
          userDetail: {
            id: {
              $eq: user.id,
            },
          },
        },
        sort: { createdAt: "desc" },
      }
    );

    return ctx.send(accounts);
  } catch (err) {
    console.error("MY ACCOUNTS ERROR", err);
    return ctx.internalServerError(err.message);
  }
},

async deleteMyAccount(ctx) {
  try {
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized("You must be logged in");
    }

    const { id } = ctx.params;

    const account = await strapi.entityService.findOne(
      "api::user-payout-detail.user-payout-detail",
      id,
      {
        populate: {
          userDetail: true,
        },
      }
    );

    if (!account) {
      return ctx.notFound("Bank account not found");
    }

    if (account.userDetail?.id !== user.id) {
      return ctx.forbidden(
        "You can only delete your own bank accounts"
      );
    }

    await strapi.entityService.delete(
      "api::user-payout-detail.user-payout-detail",
      id
    );

    return ctx.send({
      message: "Bank account deleted successfully",
    });
  } catch (err) {
    console.error("DELETE BANK ACCOUNT ERROR", err);
    return ctx.internalServerError(
      "Failed to delete bank account"
    );
  }
}
};