const { createPriorityStripeSession } = require("../../../utils/priority-payment");

module.exports = {
  async createPrioritySession(ctx) {
    try {
      const userId = ctx.state.user?.id;
      const { draftId } = ctx.request.body;

      console.log("BODY:", ctx.request.body);

      if (!draftId) {
        return ctx.badRequest("draftId is required");
      }

      // ✅ FETCH DRAFT
      const draft = await strapi.entityService.findOne(
        "api::distribute-draft.distribute-draft",
        draftId,
        {
          populate: ["TrackList", "UserDetail"],
        }
      );

      console.log("DRAFT:", draft);

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
      });

      return ctx.send({
        url: session.url,
      });

    } catch (err) {
      console.error("❌ ERROR:", err.message);
      return ctx.internalServerError("Failed to create session");
    }
  },
};