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

      // ====================================
      // ✅ GLOBAL DUPLICATE LOCK
      // ====================================
      const existingPayment =
        await strapi.db
          .query(
            "api::payment-log.payment-log"
          )
          .findOne({
            where: {
              $or: [
                {
                  stripeSessionId:
                    session.id,
                },
                {
                  paymentIntentId:
                    session.payment_intent,
                },
              ],
            },
          });

      if (existingPayment) {

        console.log(
          "⚠️ WEBHOOK ALREADY PROCESSED"
        );

        return ctx.send({
          received: true,
        });
      }

      console.log(
        "📦 SESSION METADATA:",
        session.metadata
      );

      console.log(
        "🆔 SESSION ID:",
        session.id
      );

      try {

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

          // ====================================
          // ✅ PREVENT DUPLICATE PAYMENT
          // ====================================
          // const existingPaymentLog =
          //   await strapi.db
          //     .query(
          //       "api::payment-log.payment-log"
          //     )
          //     .findOne({
          //       where: {
          //         $or: [
          //           {
          //             stripeSessionId:
          //               session.id,
          //           },
          //           {
          //             paymentIntentId:
          //               session.payment_intent,
          //           },
          //         ],
          //       },
          //     });

          // if (existingPaymentLog) {

          //   console.log(
          //     "⚠️ EXISTING PAYMENT LOG FOUND:",
          //     existingPaymentLog.id
          //   );

          //   console.log(
          //     "⚠️ UPGRADE ALREADY PROCESSED"
          //   );

          //   return ctx.send({
          //     received: true,
          //   });
          // }

          // console.log(
          //   "🔍 CHECKING EXISTING PAYMENT LOG"
          // );

          // console.log({
          //   stripeSessionId:
          //     session.id,

          //   paymentIntentId:
          //     session.payment_intent,
          // });

          // ====================================
          // ✅ CREATE PAYMENT LOG FIRST
          // ====================================
          const paymentLog =
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
                    "success",

                  type:
                    "upgrade",

                  publishedAt:
                    new Date().toISOString(),
                },
              }
            );

          console.log(
            "🧾 PAYMENT LOG CREATED:",
            {
              id:
                paymentLog.id,

              type:
                paymentLog.type,
            }
          );

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

// const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
// const handleSuccess = require("../../../utils/handle-success");
// const applyPlanFees = require("../../../utils/apply-plan-fees");

// module.exports = {
//   async webhook(ctx) {

//     console.log("🔥 WEBHOOK HIT");

//     const sig =
//       ctx.request.headers["stripe-signature"];

//     let event;

//     try {

//       event =
//         stripe.webhooks.constructEvent(
//           ctx.request.body[
//           Symbol.for("unparsedBody")
//           ],
//           sig,
//           process.env
//             .STRIPE_WEBHOOK_SECRET
//         );

//       console.log(
//         "✅ EVENT RECEIVED:",
//         event.type
//       );

//     } catch (err) {

//       console.log(
//         "❌ WEBHOOK ERROR:",
//         err.message
//       );

//       return ctx.badRequest(
//         `Webhook error: ${err.message}`
//       );
//     }

//     // ====================================
//     // ✅ ONLY HANDLE SUCCESS PAYMENT
//     // ====================================
//     if (
//       event.type ===
//       "checkout.session.completed"
//     ) {

//       console.log(
//         "💰 PAYMENT SUCCESS EVENT"
//       );

//       const session =
//         event.data.object;

//       // ====================================
//       // ✅ FETCH FULL SESSION
//       // ====================================
//       const fullSession =
//         await stripe.checkout.sessions.retrieve(
//           session.id
//         );

//       console.log(
//         "🔥 FULL SESSION METADATA:",
//         fullSession.metadata
//       );

//       console.log(
//         "📦 SESSION METADATA:",
//         session.metadata
//       );

//       console.log(
//         "🆔 SESSION ID:",
//         session.id
//       );

//       try {

//         // ====================================
//         // ✅ UPGRADE FLOW
//         // ====================================
//         if (
//           fullSession.metadata?.type ===
//           "upgrade"
//         ) {

//           console.log(
//             "🔥 PROCESSING UPGRADE"
//           );

//           const userId =
//             fullSession.metadata.userId;

//           const planId =
//             fullSession.metadata.planId;

//           // ====================================
//           // ✅ CREATE PAYMENT LOG
//           // ====================================
//           // ====================================
//           // ✅ PAYMENT PROCESSING LOCK
//           // ====================================
//           let paymentLog =
//             await strapi.db
//               .query(
//                 "api::payment-log.payment-log"
//               )
//               .findOne({
//                 where: {
//                   stripeSessionId:
//                     session.id,
//                 },
//               });
//           // ✅ IF ANOTHER REQUEST IS PROCESSING
//           if (
//             paymentLog &&
//             paymentLog.processing === true
//           ) {

//             console.log(
//               "⚠️ PAYMENT IS ALREADY PROCESSING"
//             );

//             return ctx.send({
//               received: true,
//             });
//           }

//           // ✅ ALREADY FULLY PROCESSED
//           if (
//             paymentLog &&
//             paymentLog.processing === false
//           ) {

//             console.log(
//               "⚠️ PAYMENT ALREADY COMPLETED"
//             );

//             return ctx.send({
//               received: true,
//             });
//           }

//           // ✅ CREATE LOCK
//           if (!paymentLog) {

//             try {

//               paymentLog =
//                 await strapi.entityService.create(
//                   "api::payment-log.payment-log",
//                   {
//                     data: {
//                       users_permissions_user:
//                         userId,

//                       plan:
//                         planId,

//                       stripeSessionId:
//                         session.id,

//                       paymentIntentId:
//                         session.payment_intent,

//                       amount:
//                         session.amount_total / 100,

//                       currency:
//                         session.currency.toUpperCase(),

//                       status:
//                         "processing",

//                       processing:
//                         true,

//                       type:
//                         "upgrade",

//                       publishedAt:
//                         new Date().toISOString(),
//                     },
//                   }
//                 );

//             } catch (err) {

//               // ✅ ANOTHER WEBHOOK CREATED IT
//               if (
//                 err.details?.errors?.some(
//                   e =>
//                     e.message?.includes(
//                       "unique"
//                     )
//                 )
//               ) {

//                 console.log(
//                   "⚠️ LOCK ALREADY EXISTS"
//                 );

//                 paymentLog =
//                   await strapi.db
//                     .query(
//                       "api::payment-log.payment-log"
//                     )
//                     .findOne({
//                       where: {
//                         stripeSessionId:
//                           session.id,
//                       },
//                     });

//                 // // ✅ EXIT SECOND REQUEST
//                 // return ctx.send({
//                 //   received: true,
//                 // });

//               } else {

//                 throw err;
//               }
//             }
//           }
//           console.log(
//             "🧾 PAYMENT LOG CREATED:",
//             {
//               id:
//                 paymentLog?.id,

//               type:
//                 paymentLog?.type,
//             }
//           );

//           // ====================================
//           // ✅ FIND ACTIVE SUB
//           // ====================================
//           const activeSubscription =
//             await strapi.db
//               .query(
//                 "api::user-subscription.user-subscription"
//               )
//               .findOne({
//                 where: {
//                   users_permissions_user:
//                     userId,

//                   status:
//                     "active",
//                 },
//               });

//           console.log(
//             "📄 ACTIVE SUB:",
//             activeSubscription?.id
//           );

//           // ====================================
//           // ✅ EXPIRE OLD SUB
//           // ====================================
//           if (activeSubscription) {

//             await strapi.db
//               .query(
//                 "api::user-subscription.user-subscription"
//               )
//               .update({
//                 where: {
//                   id:
//                     activeSubscription.id,
//                 },

//                 data: {
//                   status:
//                     "expired",
//                 },
//               });

//             console.log(
//               "♻️ OLD SUB EXPIRED:",
//               activeSubscription.id
//             );
//           }

//           // ====================================
//           // ✅ CREATE NEW UPGRADE SUB
//           // ====================================
//           const newSubscription =
//             await strapi.entityService.create(
//               "api::user-subscription.user-subscription",
//               {
//                 data: {
//                   users_permissions_user:
//                     userId,

//                   plan:
//                     planId,

//                   status:
//                     "active",

//                   subscriptionType:
//                     "upgrade",

//                   upgradedAt:
//                     new Date(),

//                   startDate:
//                     activeSubscription?.startDate,

//                   endDate:
//                     activeSubscription?.endDate,

//                   publishedAt:
//                     new Date().toISOString(),
//                 },
//               }
//             );

//           console.log(
//             "✅ NEW UPGRADE SUB CREATED:",
//             {
//               id:
//                 newSubscription.id,

//               subscriptionType:
//                 newSubscription.subscriptionType,

//               upgradedAt:
//                 newSubscription.upgradedAt,
//             }
//           );

//           // ====================================
//           // ✅ GET PLAN
//           // ====================================
//           const plan =
//             await strapi.entityService.findOne(
//               "api::plan.plan",
//               planId
//             );

//           // ====================================
//           // ✅ APPLY FEES
//           // ====================================
//           await applyPlanFees({
//             userId,
//             plan,
//             subscriptionId:
//               newSubscription.id,
//           });

//           console.log(
//             "💸 FEES APPLIED SUCCESSFULLY"
//           );

//           // ====================================
//           // ✅ UPDATE USER
//           // ====================================
//           await strapi.entityService.update(
//             "plugin::users-permissions.user",
//             userId,
//             {
//               data: {
//                 plan:
//                   planId,

//                 user_type:
//                   "subscribed",
//               },
//             }
//           );

//           console.log(
//             "👤 USER UPDATED"
//           );

//           // ====================================
//           // ✅ MARK PAYMENT COMPLETE
//           // ====================================
//           await strapi.db
//             .query(
//               "api::payment-log.payment-log"
//             )
//             .update({
//               where: {
//                 id:
//                   paymentLog.id,
//               },

//               data: {
//                 status:
//                   "success",

//                 processing:
//                   false,
//               },
//             });

//           console.log(
//             "✅ UPGRADE COMPLETED"
//           );

//           return ctx.send({
//             received: true,
//           });
//         }

//         // ====================================
//         // ✅ NORMAL SUBSCRIPTION FLOW
//         // ====================================
//         console.log(
//           "🟢 NORMAL SUBSCRIPTION FLOW"
//         );

//         await handleSuccess(session);

//         console.log(
//           "🎉 handleSuccess EXECUTED"
//         );

//       } catch (err) {

//         console.log(
//           "❌ WEBHOOK PROCESS ERROR:",
//           err.details || err.message || err
//         );

//         return ctx.send({
//           received: true,
//         });
//       }
//     }

//     return ctx.send({
//       received: true,
//     });
//   },
// };