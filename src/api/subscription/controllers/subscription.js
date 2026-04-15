const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

module.exports = {
  async createSession(ctx) {
    console.log("🔥 Creating Stripe session NOW");
    const userId = ctx.state.user.id;
    const { planName } = ctx.request.body;

    const plan = await strapi.db.query("api::plan.plan").findOne({
      where: { name: planName }
    });

    if (!plan || !plan.isActive) {
      return ctx.badRequest("Invalid plan");
    }

    const user = await strapi.entityService.findOne(
      "plugin::users-permissions.user",
      userId
    );

    // ✅ FREE PLAN 
    if (Number(plan.price) === 0) {
      const handleSuccess = require("../../../utils/handle-success");

      await handleSuccess({
        metadata: {
          userId: userId.toString(),
          planId: plan.id.toString(),
        },
      });

      return {
        message: "Free plan activated successfully",
      };
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email,

      payment_method_types: ["card", "upi"],

      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: plan.name },
            unit_amount: Math.round(plan.price * 100)
          },
          quantity: 1
        }
      ],

      metadata: {
        userId: userId.toString(),
        planId: plan.id.toString(),
      },

      success_url: "http://localhost:5173/payment-success",
      cancel_url: "http://localhost:5173/payment-cancel",
    });

    return { url: session.url };
  }
};