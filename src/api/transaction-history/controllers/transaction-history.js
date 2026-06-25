module.exports = {
    async history(ctx) {
        try {
            const authUser = ctx.state.user;

            if (!authUser) {
                return ctx.unauthorized("Authentication required.");
            }

            const userId = authUser.id;

            // Payment Logs
            const payments = await strapi.entityService.findMany(
                "api::payment-log.payment-log",
                {
                    filters: {
                        users_permissions_user: userId,
                    },
                    sort: { createdAt: "desc" },
                }
            );

            // Withdrawals
            const withdrawals = await strapi.entityService.findMany(
                "api::payout-request.payout-request",
                {
                    filters: {
                        user: userId,
                        status: {
                            $ne: "rejected",
                        },
                    },
                    sort: { createdAt: "desc" },
                }
            );

            const paymentHistory = payments.map((item) => ({
                id: item.id,
                transactionType: "payment",
                title:
                    item.type === "subscription"
                        ? "Subscription Payment"
                        : item.type === "priority-upload"
                            ? "Priority Upload"
                            : item.type === "upgrade"
                                ? "Plan Upgrade"
                                : "Artist Add-on",

                amount: Number(item.amount),
                currency: item.currency,
                status: item.status,
                createdAt: item.paidAt || item.createdAt,
            }));

            const withdrawalHistory = withdrawals.map((item) => ({
                id: item.id,
                transactionType: "withdrawal",
                title:
                    item.status === "completed"
                        ? "Withdrawal Completed"
                        : item.status === "processing"
                            ? "Withdrawal Processing"
                            : item.status === "rejected"
                                ? "Withdrawal Rejected"
                                : "Withdrawal Request",

                amount: Number(item.amount),
                currency: item.currency,
                status: item.status,
                createdAt: item.completedAt || item.createdAt,
            }));

            const history = [...paymentHistory, ...withdrawalHistory].sort(
                (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
            );

            return ctx.send({
                data: history,
            });
        } catch (err) {
            console.error(err);
            return ctx.internalServerError("Failed to fetch transaction history.");
        }
    },
};