const stripe = require("stripe")(
  process.env.STRIPE_SECRET_KEY
);

module.exports = {

  async createUpgradeSession(ctx) {

    console.log(
      "🔥 CREATE UPGRADE SESSION"
    );

    const userId =
      ctx.state.user.id;

    const { planName , platform = "web"} =
      ctx.request.body;

      const isApp = platform === "app";

      const successUrl = isApp
  ? `exp://192.168.1.8:8081/--/profile`
  :  `${process.env.FRONTEND_BASE_URL}/profile`;

const cancelUrl = isApp
  ? `exp://192.168.1.8:8081/--/upgrade-plan`
  :  `${process.env.FRONTEND_BASE_URL}/upgrade-plan`;

    // =========================
    // ✅ TARGET PLAN
    // =========================
    const plan =
      await strapi.db
        .query("api::plan.plan")
        .findOne({
          where: {
            name: planName,
            isActive: true,
          },
        });

    if (!plan) {
      return ctx.badRequest(
        "Invalid plan"
      );
    }

    // =========================
    // ✅ ACTIVE SUBSCRIPTION
    // =========================
    const activeSubscription =
      await strapi.db
        .query(
          "api::user-subscription.user-subscription"
        )
        .findOne({
          where: {
            users_permissions_user:
              userId,

            status: "active",
          },

          populate: ["plan"],
        });

    if (!activeSubscription) {
      return ctx.badRequest(
        "No active subscription found"
      );
    }

    // =========================
    // ✅ ONLY ALLOW UPGRADE
    // =========================
    if (
      plan.priority_order <=
      activeSubscription.plan
        .priority_order
    ) {

      return ctx.badRequest(
        "Invalid upgrade plan"
      );
    }

    // =========================
    // ✅ USER
    // =========================
    const user =
      await strapi.entityService.findOne(
        "plugin::users-permissions.user",
        userId
      );

    // =========================
    // ✅ LAST PAYMENT
    // =========================
    const lastPaymentLog =
      await strapi.db
        .query(
          "api::payment-log.payment-log"
        )
        .findOne({
          where: {
            users_permissions_user:
              userId,

            type: {
              $in: [
                "subscription",
                "upgrade",
              ],
            },

            status: "success",
          },

          orderBy: {
            createdAt: "desc",
          },
        });

    if (!lastPaymentLog) {
      return ctx.badRequest(
        "Previous payment not found"
      );
    }

    // =========================
    // ✅ LOCK CURRENCY
    // =========================
    const currency =
      lastPaymentLog.currency;

    const getPlanPriceByCurrency =
      (plan, currency) => {

        switch (currency) {

          case "INR":
            return Number(
              plan.price_inr || 0
            );

          case "CAD":
            return Number(
              plan.price_cad || 0
            );

          default:
            return Number(
              plan.price_usd || 0
            );
        }
      };

    // =========================
    // ✅ PLAN PRICES
    // =========================
    const currentPlanPrice =
      getPlanPriceByCurrency(
        activeSubscription.plan,
        currency
      );

    const newPlanPrice =
      getPlanPriceByCurrency(
        plan,
        currency
      );

    // =========================
    // ✅ DAYS
    // =========================
    const totalDays = 365;

    const startDate =
      new Date(
        activeSubscription.startDate
      );

    const now = new Date();

    const usedMs =
      now - startDate;

    const usedDays =
      Math.floor(
        usedMs /
        (1000 * 60 * 60 * 24)
      );

    const remainingDays =
      totalDays - usedDays;

    // =========================
    // ✅ CREDIT
    // =========================
    const oneDayPrice =
      currentPlanPrice /
      totalDays;

    const remainingCredit =
      oneDayPrice *
      remainingDays;

    // =========================
    // ✅ FINAL AMOUNT
    // =========================
    let amount =
      newPlanPrice -
      remainingCredit;

    amount = Number(
      Math.max(amount, 1).toFixed(2)
    );

    // console.log(
    //   "🔥 UPGRADE PRICE:",
    //   {
    //     currentPlanPrice,
    //     newPlanPrice,
    //     remainingCredit,
    //     amount,
    //     currency,
    //   }
    // );

    // =========================
    // ✅ STRIPE SESSION
    // =========================
    const session =
      await stripe.checkout.sessions.create(
        {
          mode: "payment",

          customer_email:
            user.email,

          payment_method_types: [
            "card",
            "upi",
          ],

          line_items: [
            {
              price_data: {
                currency,

                product_data: {
                  name:
                    `${plan.name} Upgrade`,
                },

                unit_amount:
                  Math.round(
                    amount * 100
                  ),
              },

              quantity: 1,
            },
          ],

          metadata: {
            userId:
              userId.toString(),

            planId:
              plan.id.toString(),

            type: "upgrade",
            platform
          },

          success_url:
           successUrl,

          cancel_url:
            cancelUrl,
        }
      );

    return ctx.send({
      url: session.url,
    });
  },
};