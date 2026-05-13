const { createPriorityStripeSession } = require("../../../utils/priority-payment");

module.exports = {
  async createPrioritySession(ctx) {
    try {
      const userId = ctx.state.user?.id;
      const { draftId, amount, currency } = ctx.request.body;

      if (!draftId) {
        return ctx.badRequest("draftId is required");
      }

      if (!amount || amount <= 0) {
        return ctx.badRequest("Valid amount is required");
      }

      if (!currency) {
        return ctx.badRequest("currency is required");
      }

      // ✅ FETCH DRAFT
      const draft = await strapi.entityService.findOne(
        "api::distribute-draft.distribute-draft",
        draftId,
        {
          populate: ["TrackList", "UserDetail"],
        }
      );

      if (!draft) {
        return ctx.badRequest("Draft not found");
      }

      // ✅ USER OWNERSHIP CHECK
      if (draft?.UserDetail?.id !== userId) {
        return ctx.unauthorized("Not your draft");
      }

      // ✅ PRIORITY CHECK
      if (draft.Priority !== "Priority") {
        return ctx.badRequest("Draft is not marked as Priority");
      }

      // ✅ CREATE STRIPE SESSION
      const session = await createPriorityStripeSession({
        userId,
        draft,
        amount,
        currency
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

      // Check if webhook already processed it
      const existingLog = await strapi.db.query("api::payment-log.payment-log").findOne({
        where: { stripeSessionId: session.id },
      });

      if (existingLog && existingLog.publish_distribute) {
        return ctx.send({ publishId: existingLog.publish_distribute });
      }

      const { savePriorityPaymentLog } = require("../../../utils/priority-payment");
      const { fullDistribute } = require("../../../utils/distribute-after-payment");

      let paymentLog = existingLog || await savePriorityPaymentLog(session);

      if (!paymentLog) {
        paymentLog = await strapi.db.query("api::payment-log.payment-log").findOne({
          where: { stripeSessionId: session.id },
        });
      }

      if (!paymentLog) {
        return ctx.badRequest("Payment log not found");
      }

      // ✅ already distributed
      if (paymentLog.publish_distribute) {
        return ctx.send({
          publishId: paymentLog.publish_distribute,
        });
      }

      // ✅ already processing
      if (paymentLog.processing) {
        return ctx.send({
          message: "Distribution already in progress",
        });
      }

      // ✅ LOCK
      await strapi.entityService.update(
        "api::payment-log.payment-log",
        paymentLog.id,
        {
          data: {
            processing: true,
          },
        }
      );

      try {

        const publish = await fullDistribute(Number(paymentLog.draftId));

        await strapi.entityService.update(
          "api::payment-log.payment-log",
          paymentLog.id,
          {
            data: {
              publish_distribute: publish.id,
              processing: false,
            },
          }
        );

        return ctx.send({
          publishId: publish.id,
        });

      } catch (err) {

        await strapi.entityService.update(
          "api::payment-log.payment-log",
          paymentLog.id,
          {
            data: {
              processing: false,
            },
          }
        );

        throw err;
      }

    } catch (err) {
      console.error("❌ ERROR Verifying:", err.message);
      return ctx.internalServerError("Failed to verify session");
    }
  },
};