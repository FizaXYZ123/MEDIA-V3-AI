module.exports = async ({ userId, plan, subscriptionId }) => {
  const now = new Date();

  console.log("📊 Applying fees for:", plan.name);

  // ✅ ADMIN FEE ENTRY
  const adminFee = await strapi.entityService.create(
    "api::admin-fee-history.admin-fee-history",
    {
      data: {
        feePercentage: plan.default_admin_fee || 0,
        effective_from: now,
        users_permissions_user: userId,
        user_subscription: subscriptionId,
         publishedAt: now,
      },
    }
  );

  console.log("✅ Admin fee created:", adminFee.id);

  // ✅ LABEL FEE ENTRY
  const labelFee = await strapi.entityService.create(
    "api::label-fee-history.label-fee-history",
    {
      data: {
        feePercentage: plan.default_label_fee || 0,
        effective_from: now,
        users_permissions_user: userId,
        user_subscription: subscriptionId,
         publishedAt: now,
      },
    }
  );

  console.log("✅ Label fee created:", labelFee.id);
};