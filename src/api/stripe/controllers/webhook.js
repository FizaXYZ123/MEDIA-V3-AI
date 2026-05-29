const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const handleSuccess = require("../../../utils/handle-success");
const applyPlanFees = require("../../../utils/apply-plan-fees");

module.exports = {
  async webhook(ctx) {

    console.log("🔥 WEBHOOK HIT");

    const sig =
      ctx.request.headers["stripe-signature"];

    let event;

    try {

      event =
        stripe.webhooks.constructEvent(
          ctx.request.body[
          Symbol.for("unparsedBody")
          ],
          sig,
          process.env
            .STRIPE_WEBHOOK_SECRET
        );

      console.log(
        "✅ EVENT RECEIVED:",
        event.type
      );

    } catch (err) {

      console.log(
        "❌ WEBHOOK ERROR:",
        err.message
      );

      return ctx.badRequest(
        `Webhook error: ${err.message}`
      );
    }

    // ====================================
    // ✅ ONLY HANDLE SUCCESS PAYMENT
    // ====================================
    if (
      event.type ===
      "checkout.session.completed"
    ) {

      console.log(
        "💰 PAYMENT SUCCESS EVENT"
      );

      const session =
        event.data.object;

      console.log(
        "📦 SESSION METADATA:",
        session.metadata
      );

      let paymentLog;

      console.log(
        "🆔 SESSION ID:",
        session.id
      );

      try {

        // ====================================
        // ✅ ARTIST ADDON FLOW
        // ====================================
        if (
          session.metadata?.type ===
          "artist-addon"
        ) {

          console.log(
            "🔥 PROCESSING ARTIST ADDON"
          );

          const userId =
            session.metadata.userId;

          const artists =
            Number(
              session.metadata.artists
            );

          if (
            ![5, 10, 15, 20, 25].includes(
              artists
            )
          ) {
            throw new Error(
              `Invalid artist count: ${artists}`
            );
          }

          // ====================================
          // ✅ CREATE PAYMENT LOG FIRST
          // ====================================

          try {

            paymentLog =
              await strapi.entityService.create(
                "api::payment-log.payment-log",
                {
                  data: {
                    users_permissions_user:
                      userId,

                    stripeSessionId:
                      session.id,

                    paymentIntentId:
                      session.payment_intent,

                    amount:
                      session.amount_total / 100,

                    currency:
                      session.currency.toUpperCase(),

                    status:
                      "processing",

                    processing:
                      true,

                    type:
                      "artist-addon",

                    paidAt:
                      new Date(),

                    publishedAt:
                      new Date().toISOString(),
                  },
                }
              );

            console.log(
              "🔒 ARTIST ADDON LOCK CREATED:",
              paymentLog.id
            );

          } catch (err) {

            console.log(
              "⚠️ DUPLICATE ARTIST ADDON BLOCKED"
            );

            console.log(
              err?.message || err
            );

            return ctx.send({
              received: true,
            });
          }

          try {

            // ====================================
            // ✅ FIND ACTIVE SUBSCRIPTION
            // ====================================

            const activeSubscription =
              await strapi.db
                .query(
                  "api::user-subscription.user-subscription"
                )
                .findOne({
                  where: {
                    users_permissions_user:
                      userId,

                    status:
                      "active",
                  },
                });

            if (!activeSubscription) {
              throw new Error(
                "No active subscription found"
              );
            }

            console.log(
              "📄 ACTIVE SUB:",
              activeSubscription.id
            );

            // ====================================
            // ✅ UPDATE ARTIST LIMIT
            // ====================================

            const currentArtists =
              parseInt(
                activeSubscription.artistsAllowed || "0",
                10
              ) || 0;

            await strapi.entityService.update(
              "api::user-subscription.user-subscription",
              activeSubscription.id,
              {
                data: {
                  artistsAllowed:
                    String(
                      currentArtists +
                      artists
                    ),
                },
              }
            );

            console.log(
              "✅ ARTIST LIMIT UPDATED:",
              {
                previous:
                  currentArtists,

                purchased:
                  artists,

                newLimit:
                  currentArtists +
                  artists,
              }
            );

            // ====================================
            // ✅ MARK PAYMENT SUCCESS
            // ====================================

            await strapi.db
              .query(
                "api::payment-log.payment-log"
              )
              .update({
                where: {
                  id:
                    paymentLog.id,
                },

                data: {
                  status:
                    "success",

                  processing:
                    false,
                },
              });

            console.log(
              "✅ ARTIST ADDON COMPLETED"
            );

            return ctx.send({
              received: true,
            });

          } catch (err) {

            console.log(
              "❌ ARTIST ADDON ERROR:",
              err
            );

            if (paymentLog?.id) {

              await strapi.db
                .query(
                  "api::payment-log.payment-log"
                )
                .update({
                  where: {
                    id:
                      paymentLog.id,
                  },

                  data: {
                    status:
                      "failed",

                    processing:
                      false,
                  },
                });
            }

            return ctx.send({
              received: true,
            });
          }
        }

        // ====================================
        // ✅ UPGRADE FLOW
        // ====================================
        if (
          session.metadata?.type ===
          "upgrade"
        ) {

          console.log(
            "🔥 PROCESSING UPGRADE"
          );

          const userId =
            session.metadata.userId;

          const planId =
            session.metadata.planId;

          try {

            paymentLog =
              await strapi.entityService.create(
                "api::payment-log.payment-log",
                {
                  data: {
                    users_permissions_user:
                      userId,

                    plan:
                      planId,

                    stripeSessionId:
                      session.id,

                    paymentIntentId:
                      session.payment_intent,

                    amount:
                      session.amount_total / 100,

                    currency:
                      session.currency.toUpperCase(),

                    status:
                      "processing",

                    processing:
                      true,

                    type:
                      "upgrade",

                    paidAt:
                      new Date(),

                    publishedAt:
                      new Date().toISOString(),
                  },
                }
              );

            console.log(
              "🔒 PAYMENT LOCK CREATED:",
              paymentLog.id
            );

          } catch (err) {

            console.log(
              "⚠️ DUPLICATE WEBHOOK BLOCKED"
            );

            console.log(
              err?.message || err
            );

            return ctx.send({
              received: true,
            });
          }

          // ====================================
          // ✅ FIND ACTIVE SUB
          // ====================================
          const activeSubscription =
            await strapi.db
              .query(
                "api::user-subscription.user-subscription"
              )
              .findOne({
                where: {
                  users_permissions_user:
                    userId,

                  status:
                    "active",
                },
              });

          console.log(
            "📄 ACTIVE SUB:",
            activeSubscription?.id
          );

          // ====================================
          // ✅ EXPIRE OLD SUB
          // ====================================
          if (activeSubscription) {

            await strapi.db
              .query(
                "api::user-subscription.user-subscription"
              )
              .update({
                where: {
                  id:
                    activeSubscription.id,
                },

                data: {
                  status:
                    "expired",
                },
              });

            console.log(
              "♻️ OLD SUB EXPIRED:",
              activeSubscription.id
            );
          }

          // ====================================
          // ✅ CREATE NEW SUB
          // ====================================
          const newSubscription =
            await strapi.entityService.create(
              "api::user-subscription.user-subscription",
              {
                data: {
                  users_permissions_user:
                    userId,

                  plan:
                    planId,

                  status:
                    "active",

                  subscriptionType:
                    "upgrade",

                  upgradedAt:
                    new Date(),

                  startDate:
                    activeSubscription?.startDate,

                  endDate:
                    activeSubscription?.endDate,

                  publishedAt:
                    new Date().toISOString(),
                },
              }
            );

          console.log(
            "✅ NEW UPGRADE SUB CREATED:",
            {
              id:
                newSubscription.id,

              subscriptionType:
                newSubscription.subscriptionType,

              upgradedAt:
                newSubscription.upgradedAt,
            }
          );

          // ====================================
          // ✅ GET PLAN
          // ====================================
          const plan =
            await strapi.entityService.findOne(
              "api::plan.plan",
              planId
            );

          // ====================================
          // ✅ APPLY FEES
          // ====================================
          await applyPlanFees({
            userId,
            plan,
            subscriptionId:
              newSubscription.id,
          });

          console.log(
            "💸 FEES APPLIED SUCCESSFULLY"
          );

          // ✅ UPDATE ARTISTS ALLOWED
          await strapi.entityService.update(
            "api::user-subscription.user-subscription",
            newSubscription.id,
            {
              data: {
                artistsAllowed:
                  plan.maxPrimaryArtists || "1",
              },
            }
          );

          // ====================================
          // ✅ UPDATE USER
          // ====================================
          await strapi.entityService.update(
            "plugin::users-permissions.user",
            userId,
            {
              data: {
                plan:
                  planId,

                user_type:
                  "subscribed",
              },
            }
          );

          console.log(
            "👤 USER UPDATED"
          );

          // ====================================
          // ✅ MARK PAYMENT SUCCESS
          // ====================================
          await strapi.db
            .query(
              "api::payment-log.payment-log"
            )
            .update({
              where: {
                id:
                  paymentLog.id,
              },

              data: {
                status:
                  "success",

                processing:
                  false,
              },
            });

          console.log(
            "✅ PAYMENT MARKED SUCCESS"
          );

          console.log(
            "✅ UPGRADE COMPLETED"
          );

          return ctx.send({
            received: true,
          });
        }

        // ====================================
        // ✅ NORMAL SUBSCRIPTION FLOW
        // ====================================
        console.log(
          "🟢 NORMAL SUBSCRIPTION FLOW"
        );

        await handleSuccess(session);

        console.log(
          "🎉 handleSuccess EXECUTED"
        );

      } catch (err) {

        console.log(
          "❌ WEBHOOK PROCESS ERROR:",
          err
        );

        // ====================================
        // ✅ MARK PAYMENT FAILED
        // ====================================
        if (paymentLog?.id) {

          await strapi.db
            .query(
              "api::payment-log.payment-log"
            )
            .update({
              where: {
                id:
                  paymentLog.id,
              },

              data: {
                status:
                  "failed",

                processing:
                  false,
              },
            });
        }

        return ctx.send({
          received: true,
        });
      }
    }

    return ctx.send({
      received: true,
    });
  },
};
