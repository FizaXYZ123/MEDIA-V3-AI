
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

    // console.log("🔥 Creating Stripe session NOW");
    const userId = ctx.state.user.id;

    const {
      planName,
      platform = "web",
    } = ctx.request.body;

    const isApp = platform === "app";

    const successUrl = isApp
      ? `exp://192.168.1.3:8081/--/payment-success`
      : `${process.env.FRONTEND_BASE_URL}/payment-success`;

    const cancelUrl = isApp
      ? `exp://192.168.1.3:8081/--/payment-cancel`
      : `${process.env.FRONTEND_BASE_URL}/payment-cancel`;

    const plan = await strapi.db.query("api::plan.plan").findOne({
      where: { name: planName, isActive: true },
    });

    if (!plan) {
      return ctx.badRequest("Invalid plan");
    }

    // console.log("✅ PLAN FOUND:", {
    //   id: plan.id,
    //   name: plan.name,
    // });

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

      // console.log("⚠️ Country not detected");

      // localhost/dev fallback
      if (
        ip === "127.0.0.1" ||
        ip === "::1" ||
        ip.includes("192.168")
      ) {

        // console.log("🛠️ LOCALHOST DETECTED → USING INR");

        country = "IN";

      } else {

        // console.log("🌍 PRODUCTION FALLBACK → USING USD");

        country = "US";
      }
    }

    // // console.log("🌍 Country:", country);

    // =========================
    // 💰 PRICE LOGIC
    // =========================
    let amount;
    let currency;

    // 🇮🇳 INDIA
    if (country === "IN") {
      // console.log("INDIA USER DETECTED → APPLYING INR PRICE");
      amount = plan.price_inr;
      currency = "INR";
    }

    // 🇨🇦 CANADA
    else if (country === "CA") {
      // console.log("CANADA USER DETECTED → APPLYING CAD PRICE");
      amount = plan.price_cad;
      currency = "CAD";
    }

    else {
      amount = plan.price_usd;
      // // console.log("USA/OTHER COUNTRY DETECTED → APPLYING USD PRICE");
      currency = "USD";
    }

    // safety fallback
    if (!amount || amount <= 0) {
      amount =
        plan.price_usd ||
        plan.price_cad ||
        plan.price_inr;

      currency = "USD";
      // console.log("⚠️ FALLBACK PRICE USED:", {
      //   amount,
      //   currency,
      // });
    }


    // console.log("✅ FINAL PRICE APPLIED:", {
    //   country,
    //   amount,
    //   currency,
    // });

    // =========================
    // ✅ FREE PLAN 
    // =========================
    if (plan.name.toLowerCase() === "pro label") {
      // console.log("🆓 Free plan selected");

      const alreadySubscribed = await strapi.db
        .query("api::user-subscription.user-subscription")
        .findOne({
          where: {
            users_permissions_user: userId,
            plan: plan.id,
            status: "active",
          },
        });

      if (alreadySubscribed) {
        // console.log("⚠️ Already subscribed to this plan");

        return ctx.send({
          message: "Already subscribed",
        });
      }

      const activeSubs = await strapi.db
        .query("api::user-subscription.user-subscription")
        .findMany({
          where: {
            users_permissions_user: userId,
            status: "active",
          },
        });

      if (activeSubs.length > 0) {

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

        // console.log("♻️ Old subscriptions expired");

      } else {

        // console.log("ℹ️ No existing active subscription");

      }


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
            subscriptionType:
              "subscription",
            artistsAllowed:
              plan.maxPrimaryArtists || "1",
            publishedAt: new Date().toISOString(),
          },
        }

      );

      // console.log("✅ ENTERPRISE SUBSCRIPTION CREATED:", subscription.id);

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

      // ✅ ENTERPRISE COMMISSION ENTRY
      const enterpriseCommission =
        await strapi.entityService.create(
          "api::enterprise-commission.enterprise-commission",
          {
            data: {
              commission_percentage:
                plan.defaultCommission || 0,
              effective_from: new Date(),
              users_permissions_user: userId,
              publishedAt: new Date().toISOString(),
            },
          }
        );

      // console.log(
      //   "✅ Enterprise commission created:",
      //   enterpriseCommission.id
      // );

      console.log("✅ enterprise plan activated successfully");

      return ctx.send({
        message: "enterprise plan activated successfully",
        subscription,
      });
    }


    // =========================
    // 💳 STRIPE SESSION
    // =========================
    console.log("🔥 Creating Stripe Checkout Session...");
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email,

      payment_method_types: ["card", "upi"],

      line_items: [
        {
          price_data: {
            currency: currency,
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
        platform
      },

      success_url: successUrl,
      cancel_url: cancelUrl

    });

    // console.log("✅ STRIPE SESSION CREATED:", {
    //   sessionId: session.id,
    //   amount,
    //   currency,
    //   country,
    //   userId,
    // });
    return ctx.send({ url: session.url });
  },
};