const applyPlanFees = require("./apply-plan-fees");


module.exports = async (session) => {

  const amountPaid = session.amount_total / 100;
  const currency = session.currency.toUpperCase();

  // ✅ SAFE EXTRACTION
  const userId = session.metadata?.userId
    ? parseInt(session.metadata.userId)
    : null;

  const planId = session.metadata?.planId
    ? parseInt(session.metadata.planId)
    : null;

  console.log("SESSION METADATA:", session.metadata);
  console.log("PARSED:", { userId, planId });

  if (!userId || !planId) {
    console.log("❌ Missing userId or planId");
    return;
  }

  const exists = await strapi.db
    .query("api::payment-log.payment-log")
    .findOne({
      where: { stripeSessionId: session.id },
    });

  if (exists) {
    console.log("⚠️ Payment already logged");
    return;
  }

  // ✅ FETCH PLAN
  const plan = await strapi.entityService.findOne(
    "api::plan.plan",
    planId
  );

  if (!plan) {
    console.log("❌ Plan not found");
    return;
  }


  // ✅ EXPIRE OLD SUBSCRIPTION (IMPORTANT)
  const existing = await strapi.db
    .query("api::user-subscription.user-subscription")
    .findOne({
      where: {
        users_permissions_user: userId,
        status: "active",
      },
    });

  if (existing) {
    await strapi.entityService.update(
      "api::user-subscription.user-subscription",
      existing.id,
      {
        data: {
          status: "expired",
          endDate: new Date(),
        },
      }
    );

    console.log("♻️ Old subscription expired");
  }


  // ✅ CREATE NEW SUBSCRIPTION
  const startDate = new Date();
  const endDate = new Date(startDate);

  endDate.setFullYear(endDate.getFullYear() + 1);

  const subscription = await strapi.entityService.create(
    "api::user-subscription.user-subscription",
    {
      data: {
        users_permissions_user: userId,
        plan: planId,
        status: "active",
        startDate,
        endDate,
        publishedAt: new Date(),
      },
    }
  );

  console.log("✅ Subscription created:", subscription.id);

  // ✅ APPLY FEES
  await applyPlanFees({
    userId,
    plan,
    subscriptionId: subscription.id,
  });

  // ✅ UPDATE USER 
  await strapi.entityService.update(
    "plugin::users-permissions.user",
    userId,
    {
      data: {
        plan: planId,
      },
    }
  );

 await strapi.entityService.create("api::payment-log.payment-log", {
  data: {
    users_permissions_user: userId,
    plan: planId,

    stripeSessionId: session.id,
    paymentIntentId: session.payment_intent,

    amount: amountPaid,
    currency: currency,

    status: "success",
    paidAt: new Date(),
  },
});

  console.log("🎉 Subscription + Fees + User Updated + Payment log created");

};