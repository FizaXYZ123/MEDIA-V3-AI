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
