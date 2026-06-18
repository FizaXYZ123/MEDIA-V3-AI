const { fullDistribute } = require("./distribute-after-payment");
const applyPlanFees = require("./apply-plan-fees");
const { savePriorityPaymentLog } = require("./priority-payment");

module.exports = async (session) => {
  console.log("🔥 MY HANDLE SUCCESS FILE LOADED");

  const amountPaid = Number((session.amount_total / 100).toFixed(2));
  // console.log(session)
  // console.log(session.currency?.toUpperCase())
  const currency = session.currency?.toUpperCase();

  // ✅ SAFE EXTRACTION
  const userId = session.metadata?.userId
    ? parseInt(session.metadata.userId)
    : null;

  const planId = session.metadata?.planId
    ? parseInt(session.metadata.planId)
    : null;


  // console.log("PARSED:", { userId, planId });

  const isPriority = session.metadata?.type === "priority-upload";

  if (isPriority) {
    console.log("🔥 Handling PRIORITY payment");

    let paymentLog = await savePriorityPaymentLog(session);

    if (!paymentLog) {
      // console.log("⚠️ Payment log already exists, fetching...");

      paymentLog = await strapi.db
        .query("api::payment-log.payment-log")
        .findOne({
          where: { stripeSessionId: session.id },
        });
    }

    if (!paymentLog) {
      console.log("❌ Payment log not found");
      return;
    }

    // ✅ prevent duplicate distribution


    if (paymentLog.publish_distribute) {
      console.log("⚠️ Already distributed");
      return;
    }

    const lockResult = await strapi.db
      .query("api::payment-log.payment-log")
      .updateMany({
        where: {
          id: paymentLog.id,
          $or: [
            { processing: false },
            { processing: null },
          ],
        },
        data: {
          processing: true,
        },
      });

    if (!lockResult || lockResult.count === 0) {
      console.log("⚠️ Already processing");
      return;
    }

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

      console.log("❌ DISTRIBUTE ERROR:", err.message);
    }

    return;
  }

  if (!userId || !planId) {
    console.log("❌ Missing userId or planId");
    return;
  }

  // const exists = await strapi.db
  //   .query("api::payment-log.payment-log")
  //   .findOne({
  //     where: { stripeSessionId: session.id },
  //   });

  // if (exists) {
  //   console.log("⚠️ Payment already logged");
  //   return;
  // }

  let paymentLog = await strapi.db
    .query("api::payment-log.payment-log")
    .findOne({
      where: { stripeSessionId: session.id },
    });

  if (paymentLog?.status === "success") {
    console.log("⚠️ Payment already processed");
    return;
  }

  if (!paymentLog) {
    paymentLog = await strapi.entityService.create(
      "api::payment-log.payment-log",
      {
        data: {
          stripeSessionId: session.id,
          paymentIntentId: session.payment_intent || null,
          status: "processing",
          type: "subscription",
          paidAt: new Date(),
        },
      }
    );
  }

  const lockResult = await strapi.db
    .query("api::payment-log.payment-log")
    .updateMany({
      where: {
        id: paymentLog.id,
        status: "processing",
      },
      data: {
        status: "locked",
      },
    });

  if (!lockResult || lockResult.count === 0) {
    console.log("⚠️ Already processing");
    return;
  }

  try {
    // ✅ FETCH PLAN
    const plan = await strapi.entityService.findOne(
      "api::plan.plan",
      planId
    );

    if (!plan) {
      console.log("❌ Plan not found");
      return;
    }

    // console.log("✅ PLAN FOUND:", {
    //   id: plan.id,
    //   name: plan.name,
    // });

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

      // console.log("♻️ Old subscription expired");
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
          artistsAllowed:
            plan.maxPrimaryArtists || "1",
          subscriptionType: "subscription",
          publishedAt: new Date().toISOString(),
        },
      }
    );

    // console.log("✅ Subscription created:", subscription.id);
    // console.log("✅ USER SUBSCRIPTION CREATED SUCCESSFULLY");

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

    console.log("subscription",subscription.id)

    await strapi.entityService.update(
      "api::payment-log.payment-log",
      paymentLog.id,
      {
        data: {
          users_permissions_user: userId,
          plan: planId,
          user_subscription: subscription.id,
          amount: amountPaid,
          currency: currency,
          status: "success",
          paidAt: new Date(),
        },
      }
    );

    console.log("🎉 Subscription + Fees + User Updated + Payment log created");
  } catch (err) {

    console.log("❌ SUBSCRIPTION FLOW ERROR:", err);

    await strapi.entityService.update(
      "api::payment-log.payment-log",
      paymentLog.id,
      {
        data: {
          status: "failed",
        },
      }
    );

    throw err;
  }

};