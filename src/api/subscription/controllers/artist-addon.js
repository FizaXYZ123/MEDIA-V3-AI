const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const VALID_AMOUNTS = {
  INR: {
    5: 1000,
    10: 1800,
    15: 2700,
    20: 3600,
    25: 4500,
  },

  CAD: {
    5: 12,
    10: 21.6,
    15: 32.4,
    20: 43.2,
    25: 54,
  },

  USD: {
    5: 9,
    10: 16.2,
    15: 24.3,
    20: 32.4,
    25: 40.5,
  },
};

module.exports = {
  async createSession(ctx) {
    try {
      const userId = ctx.state.user.id;

      const {
        artists,
        amount,
        currency,
        platform = "web",
      } = ctx.request.body;

      const isApp = platform === "app";

      const successUrl = isApp
        ? `exp://192.168.1.13:8081/--/profile`
        : `${process.env.FRONTEND_BASE_URL}/profile`;

      const cancelUrl = isApp
        ? `exp://192.168.1.13:8081/--/upgrade-plan`
        : `${process.env.FRONTEND_BASE_URL}/upgrade-plan`;

      // =========================
      // VALIDATE ARTIST COUNT
      // =========================

      if (
        ![5, 10, 15, 20, 25].includes(
          Number(artists)
        )
      ) {
        return ctx.badRequest(
          "Invalid artist count"
        );
      }

      // =========================
      // VALIDATE PRICE
      // =========================

      const expectedAmount =
        VALID_AMOUNTS[currency]?.[
        Number(artists)
        ];

      if (!expectedAmount) {
        return ctx.badRequest(
          "Invalid pricing"
        );
      }

      if (
        Number(amount) !==
        Number(expectedAmount)
      ) {
        return ctx.badRequest(
          "Invalid amount"
        );
      }

      // =========================
      // ACTIVE SUB REQUIRED
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
          });

      if (!activeSubscription) {
        return ctx.badRequest(
          "Active subscription required"
        );
      }

      const user =
        await strapi.entityService.findOne(
          "plugin::users-permissions.user",
          userId
        );

      // =========================
      // CREATE STRIPE SESSION
      // =========================

      const session =
        await stripe.checkout.sessions.create({
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
                currency:
                  currency.toLowerCase(),

                product_data: {
                  name:
                    `${artists} Extra Artists`,
                },

                unit_amount:
                  Math.round(
                    Number(amount) * 100
                  ),
              },

              quantity: 1,
            },
          ],

          metadata: {
            type:
              "artist-addon",

            userId:
              userId.toString(),

            artists:
              artists.toString(),

            platform,
          },



          success_url:
            successUrl,

          cancel_url:
            cancelUrl,
        });

      return ctx.send({
        url: session.url,
      });
    } catch (err) {
      console.log(
        "❌ ARTIST ADDON ERROR:",
        err
      );

      return ctx.internalServerError(
        "Failed to create session"
      );
    }
  },
};