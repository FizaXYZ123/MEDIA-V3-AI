// const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// module.exports = {
//   async createSession(ctx) {
//     console.log("🔥 Creating Stripe session NOW");
//     const userId = ctx.state.user.id;
//     const { planName } = ctx.request.body;

//     const plan = await strapi.db.query("api::plan.plan").findOne({
//       where: { name: planName }
//     });

//     if (!plan || !plan.isActive) {
//       return ctx.badRequest("Invalid plan");
//     }

//     const user = await strapi.entityService.findOne(
//       "plugin::users-permissions.user",
//       userId
//     );

//     // ✅ FREE PLAN 
//     if (Number(plan.price) === 0) {
//       const handleSuccess = require("../../../utils/handle-success");

//       await handleSuccess({
//         metadata: {
//           userId: userId.toString(),
//           planId: plan.id.toString(),
//         },
//       });

//       return {
//         message: "Free plan activated successfully",
//       };
//     }

//     const session = await stripe.checkout.sessions.create({
//       mode: "payment",
//       customer_email: user.email,

//       payment_method_types: ["card", "upi"],

//       line_items: [
//         {
//           price_data: {
//             currency: "usd",
//             product_data: { name: plan.name },
//             unit_amount: Math.round(plan.price * 100)
//           },
//           quantity: 1
//         }
//       ],

//        allow_promotion_codes: true,

//       metadata: {
//         userId: userId.toString(),
//         planId: plan.id.toString(),
//       },

//       success_url: `${process.env.FRONTEND_BASE_URL}/payment-success`,
//       cancel_url: `${process.env.FRONTEND_BASE_URL}/payment-cancel`,
//     });

//     return { url: session.url };
//   }
// };

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const axios = require("axios");

const getCountryFromIP = async (ip) => {
  try {
    const res = await axios.get(`https://ipapi.co/${ip}/json/`);
    return res.data.country;
  } catch (err) {
    console.log("❌ GeoIP API failed:", err.message);
    return null;
  }
};

module.exports = {
  async createSession(ctx) {
    console.log("🔥 Creating Stripe session NOW");

    const userId = ctx.state.user.id;
    const { planName } = ctx.request.body;

    const plan = await strapi.db.query("api::plan.plan").findOne({
      where: { name: planName, isActive: true },
    });

    if (!plan) {
      return ctx.badRequest("Invalid plan");
    }

    const user = await strapi.entityService.findOne(
      "plugin::users-permissions.user",
      userId
    );

    const ip =
      ctx.request.headers["client-ip"] ||
      ctx.request.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      ctx.request.ip ||
      ctx.req.socket.remoteAddress;

    console.log("🌐 RAW IP:", ip);

    let country = await getCountryFromIP(ip);

    if (!country) {
      console.log("⚠️ Falling back to INDIA");
      country = "CA";
    }

    console.log("🌍 Country:", country);

    // =========================
    // 💰 PRICE LOGIC
    // =========================
    let amount;
    let currency;

    // 🇮🇳 INDIA
    if (country === "IN") {
      amount = plan.price_inr;
      currency = "INR";
    }

    // 🇨🇦 CANADA
    else if (country === "CA") {
      amount = plan.price_cad;
      currency = "CAD";
    }

    // 🌍 OTHER COUNTRIES
    else {
      try {
        const countryToCurrency = {
          US: "USD",
          GB: "GBP",
          AU: "AUD",
          AE: "AED",
          SG: "SGD",
          EU: "EUR",
        };

        const targetCurrency = countryToCurrency[country] || "USD";

        const res = await axios.get(
          "https://api.exchangerate-api.com/v4/latest/CAD"
        );

        const rate = res.data.rates[targetCurrency];

        if (!rate) throw new Error("Rate not found");

        amount = plan.price_cad * rate;
        currency = targetCurrency;

      } catch (err) {
        console.log("⚠️ Conversion failed → fallback CAD");

        amount = plan.price_cad;
        currency = "CAD";
      }
    }

    // safety fallback
    if (!amount || amount <= 0) {
      amount = plan.price_cad;
      currency = "CAD";
    }

    console.log("💰 Final:", amount, currency);

    // =========================
    // ✅ FREE PLAN 
    // =========================
    if (plan.name.toLowerCase() === "pro label") {
      console.log("🆓 Free plan selected");

      const activeSubs = await strapi.db
        .query("api::user-subscription.user-subscription")
        .findMany({
          where: {
            users_permissions_user: userId,
            status: "active",
          },
        });

      for (const sub of activeSubs) {
        await strapi.entityService.update(
          "api::user-subscription.user-subscription",
          sub.id,
          {
            data: {
              status: "expired",
              endDate: new Date(),
            },
          }
        );
      }

      console.log("♻️ Old subscriptions expired");

      // ✅ Create new subscription
      const startDate = new Date();
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1);

      const subscription = await strapi.entityService.create(
        "api::user-subscription.user-subscription",
        {
          data: {
            users_permissions_user: userId,
            plan: plan.id,
            status: "active",
            startDate,
            endDate,
            publishedAt: new Date(),
          },
        }
      );

      // ✅ Update user_type → enterprise
      await strapi.entityService.update(
        "plugin::users-permissions.user",
        userId,
        {
          data: {
            user_type: "enterprise",
            plan: plan.id,
          },
        }
      );

      return ctx.send({
        message: "Free plan activated successfully",
        subscription,
      });
      return;
    }

    // =========================
    // 💳 STRIPE SESSION
    // =========================
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email,

      payment_method_types: ["card"],

      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: { name: plan.name },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],

      allow_promotion_codes: true,

      metadata: {
        userId: userId.toString(),
        planId: plan.id.toString(),
        country,
      },

      success_url: `${process.env.FRONTEND_BASE_URL}/payment-success`,
      cancel_url: `${process.env.FRONTEND_BASE_URL}/payment-cancel`,
    });

    return { url: session.url };
  },
};