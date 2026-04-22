const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

/**
 * 🔥 CREATE STRIPE SESSION (PRIORITY UPLOAD)
 */
const createPriorityStripeSession = async ({ userId, draft }) => {
  if (!draft) throw new Error("Draft not found");

  if (draft.Priority !== "Priority") {
    throw new Error("Draft is not marked as Priority");
  }

  const trackCount = draft.TrackList?.length || 1;

  // 💰 FIXED PRICE: 12 CAD per track
  const amount = trackCount * 12;

  console.log(`💰 Tracks: ${trackCount}, Amount: ${amount} CAD`);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card", "upi"],

    line_items: [
      {
        price_data: {
          currency: "cad",
          product_data: {
            name: `Priority Upload (${trackCount} tracks)`,
          },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      },
    ],

    metadata: {
      userId: userId.toString(),
      draftId: draft.id.toString(), // 🔥 IMPORTANT
    },

    success_url: `${process.env.FRONTEND_BASE_URL}/payment-success`,
    cancel_url: `${process.env.FRONTEND_BASE_URL}/payment-cancel`,
  });

  return session;
};

/**
 * 🔥 SAVE PAYMENT LOG (PRIORITY UPLOAD)
 */
const savePriorityPaymentLog = async (session) => {
  try {
    const userId = session.metadata?.userId
      ? parseInt(session.metadata.userId)
      : null;

    const draftId = session.metadata?.draftId
      ? parseInt(session.metadata.draftId)
      : null;

    if (!userId || !draftId) {
      console.log("❌ Missing metadata for priority payment");
      return;
    }

    // ✅ Prevent duplicate
    const exists = await strapi.db
      .query("api::payment-log.payment-log")
      .findOne({
        where: { stripeSessionId: session.id },
      });

    if (exists) {
      console.log("⚠️ Priority payment already logged");
      return;
    }

    // ✅ CREATE LOG
    await strapi.entityService.create("api::payment-log.payment-log", {
      data: {
        users_permissions_user: userId,
        draftId: draftId,

        stripeSessionId: session.id,
        paymentIntentId: session.payment_intent || null,

        amount: Number((session.amount_total / 100).toFixed(2)),
        currency: session.currency.toUpperCase(),

        status: "success",
        paidAt: new Date(),

        type: "priority-upload",
      },
    });

    console.log("✅ Priority payment log created");

  } catch (err) {
    console.log("❌ Error saving priority payment:", err.message);
  }
};

module.exports = {
  createPriorityStripeSession,
  savePriorityPaymentLog,
};