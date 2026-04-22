const { createPriorityStripeSession } = require("../../../utils/priority-payment");

module.exports = {
  async createPrioritySession(ctx) {
    try {
      console.log("🔥 Priority payment API hit");

      const userId = ctx.state.user.id;
      const { draftId } = ctx.request.body;

      if (!draftId) {
        return ctx.badRequest("draftId is required");
      }

      // ✅ Fetch draft
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

      // ✅ Ownership check (VERY IMPORTANT)
      if (draft?.UserDetail?.id !== userId) {
        return ctx.unauthorized("Not your draft");
      }

      // ✅ Ensure priority upload
      if (draft.Priority !== "Priority") {
        return ctx.badRequest("This draft is not marked as Priority");
      }

      // ✅ Prevent duplicate payment 
      const alreadyPaid = await strapi.db
        .query("api::payment-log.payment-log")
        .findOne({
          where: {
            users_permissions_user: userId,
            draftId: Number(draftId),
            status: "success",
            type: "priority-upload",
          },
        });

      if (alreadyPaid) {
        console.log("⚠️ Already paid for this draft");

        return ctx.send({
          message: "Already paid for this draft",
          alreadyPaid: true, 
          draftId: Number(draftId),
        });
      }

      // ✅ Create Stripe session
      const session = await createPriorityStripeSession({
        userId,
        draft,
      });

      return ctx.send({
        url: session.url,
        draftId: Number(draftId), 
      });

    } catch (err) {
      console.error("❌ Priority Payment Error:", err.message);
      return ctx.internalServerError("Failed to create payment session");
    }
  },
};