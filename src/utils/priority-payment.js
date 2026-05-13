const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const createPriorityStripeSession = async ({ userId, draft, amount,
  currency, }) => {
  if (!draft) throw new Error("Draft not found");

  if (draft.Priority !== "Priority") {
    throw new Error("Draft is not marked as Priority");
  }

  if (!amount || amount <= 0) {
  throw new Error("Invalid amount");
}

if (!currency) {
  throw new Error("Currency is required");
}

  const user = await strapi.entityService.findOne(
    "plugin::users-permissions.user",
    userId
  );

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: user.email,
    payment_method_types: ["card"],

   line_items: [
  {
    price_data: {
      currency: currency.toLowerCase(),
      product_data: {
        name: `Priority Upload`,
      },
      unit_amount: Math.round(amount * 100),
    },
    quantity: 1,
  },
],

    metadata: {
      type: "priority-upload",
      userId: userId.toString(),
      draftId: draft.id.toString(),
    },

    success_url: `${process.env.FRONTEND_BASE_URL}/catalogue/my-release?session_id={CHECKOUT_SESSION_ID}&draft_id=${draft.id}`,
    cancel_url: `${process.env.FRONTEND_BASE_URL}/catalogue/draft`,
  });

  return session;
};

const savePriorityPaymentLog = async (session) => {
  try {
    const userId = session.metadata?.userId
      ? parseInt(session.metadata.userId)
      : null;

    const draftId = session.metadata?.draftId
      ? parseInt(session.metadata.draftId)
      : null;

    if (!userId || !draftId) return null;

    const exists = await strapi.db
      .query("api::payment-log.payment-log")
      .findOne({
        where: { stripeSessionId: session.id },
      });

    if (exists) return null;

    const createdLog = await strapi.entityService.create(
      "api::payment-log.payment-log",
      {
        data: {
          users_permissions_user: userId,
          draftId,
          stripeSessionId: session.id,
          paymentIntentId: session.payment_intent || null,
          amount: Number((session.amount_total / 100).toFixed(2)),
          currency: session.currency.toUpperCase(),
          status: "success",
          paidAt: new Date(),
          type: "priority-upload",
        },
      }
    );

    return createdLog;

  } catch (err) {
    console.log("❌ Error saving priority payment:", err.message);
    return null;
  }
};

module.exports = {
  createPriorityStripeSession,
  savePriorityPaymentLog,
};