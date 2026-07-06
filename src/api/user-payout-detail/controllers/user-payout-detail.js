"use strict";
const createUserActivityLog = require("../../../utils/user-activity-log");

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
    "api::user-payout-detail.user-payout-detail",
    ({ strapi }) => ({

        async create(ctx) {
            try {
                const user = ctx.state.user;

                if (!user) {
                    return ctx.unauthorized("You must be logged in");
                }

                const body = ctx.request.body.data;

                // Check if the user already has any bank accounts
                const existingBanks = await strapi.entityService.findMany(
                    "api::user-payout-detail.user-payout-detail",
                    {
                        filters: {
                            userDetail: user.id,
                        },
                        fields: ["id"],
                        publicationState: "preview",
                        limit: 1,
                    }
                );

                const isFirstBank = existingBanks.length === 0;

                const entry = await strapi.entityService.create(
                    "api::user-payout-detail.user-payout-detail",
                    {
                        data: {
                            ...body,
                            userDetail: user.id,
                            setDefault: isFirstBank,
                            publishedAt: new Date(),
                        },
                    }
                );

                await createUserActivityLog({
                    userId: user.id,
                    action: "Bank Account Added",
                    description: `New bank added for payouts`,
                });

                return ctx.send(entry);
            } catch (err) {
                console.error(err);
                return ctx.internalServerError(err.message);
            }
        },

        async find(ctx) {
            const user = ctx.state.user;

            if (!user) {
                return ctx.unauthorized("Authentication required");
            }

            // Get full user with role
            const fullUser = await strapi
                .query("plugin::users-permissions.user")
                .findOne({
                    where: { id: user.id },
                    populate: ["role"],
                });

            const roleName = fullUser?.role?.name;

            let filters = {};

            // Client → only own entries
            if (roleName === "Client") {
                filters.userDetail = {
                    id: user.id,
                };
            }

            // Authenticated → no filter (all records)
            const entries = await strapi.entityService.findMany(
                "api::user-payout-detail.user-payout-detail",
                {
                    filters,
                    populate: {
                        userDetail: true,
                    },
                    sort: {
                        createdAt: "DESC",
                    },
                }
            );

            return {
                data: entries,
            };
        },

        async findOne(ctx) {
            const { id } = ctx.params;

            const user = ctx.state.user;

            if (!user) {
                return ctx.unauthorized("Authentication required");
            }

            // Get user role
            const fullUser = await strapi
                .query("plugin::users-permissions.user")
                .findOne({
                    where: { id: user.id },
                    populate: ["role"],
                });

            const roleName = fullUser?.role?.name;

            const entry = await strapi.entityService.findOne(
                "api::user-payout-detail.user-payout-detail",
                id,
                {
                    populate: {
                        userDetail: true,
                    },
                }
            );

            if (!entry) {
                return ctx.notFound("Record not found");
            }

            // Client can only access their own record
            if (
                roleName === "Client" &&
                entry.userDetail?.id !== user.id
            ) {
                return ctx.forbidden("You can only access your own payout details");
            }

            return {
                data: entry,
            };
        },

        async setDefaultBank(ctx) {
            try {
                const authUser = ctx.state.user;

                if (!authUser) {
                    return ctx.unauthorized("Unauthorized.");
                }

                const { id } = ctx.params;

                const bankAccount = await strapi.entityService.findOne(
                    "api::user-payout-detail.user-payout-detail",
                    id,
                    {
                        populate: {
                            userDetail: true,
                        },
                    }
                );

                if (!bankAccount) {
                    return ctx.notFound("Bank account not found.");
                }

                if (bankAccount.userDetail?.id !== authUser.id) {
                    return ctx.forbidden(
                        "You are not allowed to modify this bank account."
                    );
                }

                // Already default
                if (bankAccount.setDefault) {
                    return ctx.send({
                        message: "This bank account is already the default.",
                        data: bankAccount,
                    });
                }

                // Get all bank accounts of the user
                const userBanks = await strapi.entityService.findMany(
                    "api::user-payout-detail.user-payout-detail",
                    {
                        filters: {
                            userDetail: authUser.id,
                        },
                        fields: ["id"],
                        publicationState: "preview",
                        limit: -1,
                    }
                );

                // Remove default from all bank accounts
                await Promise.all(
                    userBanks.map((bank) =>
                        strapi.entityService.update(
                            "api::user-payout-detail.user-payout-detail",
                            bank.id,
                            {
                                data: {
                                    setDefault: false,
                                },
                            }
                        )
                    )
                );
                // Set selected bank as default
                const updatedBank = await strapi.entityService.update(
                    "api::user-payout-detail.user-payout-detail",
                    id,
                    {
                        data: {
                            setDefault: true,
                        },
                        populate: {
                            userDetail: true,
                        },
                    }
                );

                await createUserActivityLog({
                    userId: authUser.id,
                    action: "Default Bank Account Updated",
                    description: `Changed default payout bank to ${updatedBank.bank_name}`,
                });

                return ctx.send({
                    message: "Default bank account updated successfully.",
                    data: updatedBank,
                });
            } catch (error) {
                console.error(error);
                return ctx.internalServerError("Something went wrong.");
            }
        }

    })
);