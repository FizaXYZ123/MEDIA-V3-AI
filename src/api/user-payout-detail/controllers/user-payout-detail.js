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

                const entry = await strapi.entityService.create(
                    "api::user-payout-detail.user-payout-detail",
                    {
                        data: {
                            ...body,
                            userDetail: user.id,
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

    })
);