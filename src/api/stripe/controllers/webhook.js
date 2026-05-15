const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const handleSuccess = require("../../../utils/handle-success");

module.exports = {
  async webhook(ctx) {

    // 🔥 1. FIRST LOG → CHECK IF WEBHOOK HITS
    console.log("🔥 WEBHOOK HIT");

    const sig = ctx.request.headers["stripe-signature"];

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        ctx.request.body[Symbol.for("unparsedBody")],
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );

      // 🔥 2. EVENT TYPE LOG
      console.log("✅ EVENT RECEIVED:", event.type);

    } catch (err) {
      console.log("❌ WEBHOOK ERROR:", err.message);
      return ctx.badRequest(`Webhook error: ${err.message}`);
    }

    // 🔥 3. CHECK CONDITION
    if (event.type === "checkout.session.completed") {
      console.log("💰 PAYMENT SUCCESS EVENT");

      console.log("💳 SESSION ID:", event.data.object.id);

      console.log("💳 SESSION METADATA:", event.data.object.metadata);

      try {
        await handleSuccess(event.data.object);

        console.log("🎉 handleSuccess EXECUTED");
      } catch (err) {
        console.log("❌ handleSuccess ERROR:", err);
      }
    }

    ctx.send({ received: true });
  }
};