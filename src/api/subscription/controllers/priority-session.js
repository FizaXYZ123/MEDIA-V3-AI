const {
  createPriorityStripeSession,
  savePriorityPaymentLog,
} = require("../../../utils/priority-payment");

const { fullDistribute } = require("../../../utils/distribute-after-payment");

module.exports = {
  async createPrioritySession(ctx) {
    try {
      const userId = ctx.state.user?.id;
      const { draftId, amount, currency } = ctx.request.body;

      if (!draftId) return ctx.badRequest("draftId is required");
      if (!amount || amount <= 0)
        return ctx.badRequest("Valid amount is required");
      if (!currency) return ctx.badRequest("currency is required");

      const draft = await strapi.entityService.findOne(
        "api::distribute-draft.distribute-draft",
        draftId,
        {
          populate: ["TrackList", "UserDetail"],
        }
      );

      if (!draft) return ctx.badRequest("Draft not found");

      if (draft?.UserDetail?.id !== userId) {
        return ctx.unauthorized("Not your draft");
      }

      if (draft.Priority !== "Priority") {
        return ctx.badRequest("Draft is not marked as Priority");
      }

      // ✅ NO CHANGE HERE
      const session = await createPriorityStripeSession({
        userId,
        draft,
        amount,
        currency,
      });

      return ctx.send({
        url: session.url,
      });
    } catch (err) {
      console.error("❌ ERROR:", err.message);
      return ctx.internalServerError("Failed to create session");
    }
  },

  // async verifyPrioritySession(ctx) {
  //   try {
  //     const { session_id } = ctx.request.body;

  //     if (!session_id) {
  //       return ctx.badRequest("session_id is required");
  //     }

  //     const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
  //     const session = await stripe.checkout.sessions.retrieve(session_id);

  //     if (session.payment_status !== "paid") {
  //       return ctx.badRequest("Payment not completed");
  //     }

  //     const draftId = session.metadata?.draftId
  //       ? Number(session.metadata.draftId)
  //       : null;

  //     if (!draftId) {
  //       return ctx.badRequest("draftId missing in Stripe metadata");
  //     }

  //     // ✅ Check if any payment log for this draft already has publish_distribute
  //     const alreadyPublished = await strapi.db
  //       .query("api::payment-log.payment-log")
  //       .findOne({
  //         where: {
  //           draftId,
  //           type: "priority-upload",
  //           status: "success",
  //           publish_distribute: {
  //             $notNull: true,
  //           },
  //         },
  //       });

  //     if (alreadyPublished?.publish_distribute) {
  //       return ctx.send({
  //         publishId: alreadyPublished.publish_distribute,
  //         message: "Already distributed",
  //       });
  //     }

  //     let paymentLog = await strapi.db
  //       .query("api::payment-log.payment-log")
  //       .findOne({
  //         where: {
  //           stripeSessionId: session.id,
  //         },
  //       });

  //     if (!paymentLog) {
  //       paymentLog = await savePriorityPaymentLog(session);
  //     }

  //     if (!paymentLog) {
  //       paymentLog = await strapi.db
  //         .query("api::payment-log.payment-log")
  //         .findOne({
  //           where: {
  //             stripeSessionId: session.id,
  //           },
  //         });
  //     }

  //     if (!paymentLog) {
  //       return ctx.badRequest("Payment log not found");
  //     }

  //     if (paymentLog.publish_distribute) {
  //       return ctx.send({
  //         publishId: paymentLog.publish_distribute,
  //         message: "Already distributed",
  //       });
  //     }

  //     if (paymentLog.processing) {
  //       return ctx.send({
  //         message: "Distribution already in progress",
  //       });
  //     }

  //     // ✅ Atomic lock: only one verify request can lock this payment log
  //     const lockResult = await strapi.db
  //       .query("api::payment-log.payment-log")
  //       .updateMany({
  //         where: {
  //           id: paymentLog.id,
  //           $or: [{ processing: false }, { processing: null }],
  //         },
  //         data: {
  //           processing: true,
  //         },
  //       });

  //     if (!lockResult || lockResult.count === 0) {
  //       return ctx.send({
  //         message: "Distribution already in progress",
  //       });
  //     }

  //     try {
  //       // ✅ Re-check after lock, extra safety
  //       const alreadyPublishedAfterLock = await strapi.db
  //         .query("api::payment-log.payment-log")
  //         .findOne({
  //           where: {
  //             draftId,
  //             type: "priority-upload",
  //             status: "success",
  //             publish_distribute: {
  //               $notNull: true,
  //             },
  //           },
  //         });

  //       if (alreadyPublishedAfterLock?.publish_distribute) {
  //         await strapi.entityService.update(
  //           "api::payment-log.payment-log",
  //           paymentLog.id,
  //           {
  //             data: {
  //               processing: false,
  //               publish_distribute:
  //                 alreadyPublishedAfterLock.publish_distribute,
  //             },
  //           }
  //         );

  //         return ctx.send({
  //           publishId: alreadyPublishedAfterLock.publish_distribute,
  //           message: "Already distributed",
  //         });
  //       }

  //       const publish = await fullDistribute(draftId);

  //       await strapi.entityService.update(
  //         "api::payment-log.payment-log",
  //         paymentLog.id,
  //         {
  //           data: {
  //             publish_distribute: publish.id,
  //             processing: false,
  //           },
  //         }
  //       );

  //       return ctx.send({
  //         publishId: publish.id,
  //         message: "Distribution created successfully",
  //       });
  //     } catch (err) {
  //       await strapi.entityService.update(
  //         "api::payment-log.payment-log",
  //         paymentLog.id,
  //         {
  //           data: {
  //             processing: false,
  //           },
  //         }
  //       );

  //       throw err;
  //     }
  //   } catch (err) {
  //     console.error("❌ ERROR Verifying:", err.message);
  //     return ctx.internalServerError("Failed to verify session");
  //   }
  // },

  async verifyPrioritySession(ctx) {
    try {
      const { session_id } = ctx.request.body;

      if (!session_id) {
        return ctx.badRequest("session_id is required");
      }

      const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

      const session = await stripe.checkout.sessions.retrieve(session_id);

      if (session.payment_status !== "paid") {
        return ctx.badRequest("Payment not completed");
      }

      const paymentLog = await strapi.db
        .query("api::payment-log.payment-log")
        .findOne({
          where: {
            stripeSessionId: session.id,
          },
          populate: ["publish_distribute"],
        });

      // webhook not finished yet
      if (!paymentLog) {
        return ctx.send({
          processing: true,
          message: "Payment received. Distribution starting...",
        });
      }

      // distribution processing
      if (paymentLog.processing) {
        return ctx.send({
          processing: true,
          message: "Distribution in progress...",
        });
      }

      // distribution completed
      if (paymentLog.publish_distribute) {
        return ctx.send({
          success: true,
          publishId: paymentLog.publish_distribute.id,
          message: "Distribution completed",
        });
      }

      // payment success but webhook still processing
      return ctx.send({
        processing: true,
        message: "Finalizing distribution...",
      });
    } catch (err) {
      console.error("❌ ERROR Verifying:", err.message);

      return ctx.internalServerError("Failed to verify session");
    }
  }
};
