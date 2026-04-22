const { savePriorityPaymentLog } = require("./priority-payment");
const applyPlanFees = require("./apply-plan-fees");

module.exports = async (session) => {

  const amountPaid = Number((session.amount_total / 100).toFixed(2));
  const currency = session.currency.toUpperCase();
  // ✅ SAFE EXTRACTION
  const userId = session.metadata?.userId
    ? parseInt(session.metadata.userId)
    : null;

  const planId = session.metadata?.planId
    ? parseInt(session.metadata.planId)
    : null;

  
  console.log("PARSED:", { userId, planId });

   const isPriority = session.metadata?.draftId !== undefined;

  if (isPriority) {
    console.log("🔥 Handling PRIORITY payment");

    await savePriorityPaymentLog(session);
    return;
  }

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


  // ✅ EXPIRE OLD SUBSCRIPTION 
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
        user_type: "subscribed",
      },
    }
  );

  await strapi.entityService.create("api::payment-log.payment-log", {
    data: {
      users_permissions_user: userId,
      plan: planId,

      stripeSessionId: session.id,
      paymentIntentId: session.payment_intent || null,

      amount: amountPaid,
      currency: currency,
      type: "subscription",
      status: "success",
      paidAt: new Date(),
    },
  });

  console.log("🎉 Subscription + Fees + User Updated + Payment log created");

};