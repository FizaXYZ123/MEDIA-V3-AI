"use strict";

module.exports = {

    async createTicket(ctx) {
        return await strapi
            .service("api::ticket-raise.ticket-raise")
            .createTicket(ctx);
    },

    async myTickets(ctx) {
        return await strapi
            .service("api::ticket-raise.ticket-raise")
            .myTickets(ctx);
    },

    async findOne(ctx) {
        return await strapi
            .service("api::ticket-raise.ticket-raise")
            .findOne(ctx);
    },

    async reply(ctx) {
        return await strapi
            .service("api::ticket-raise.ticket-raise")
            .reply(ctx);
    },

    async adminTickets(ctx) {
        return await strapi
            .service("api::ticket-raise.ticket-raise")
            .adminTickets(ctx);
    },

    async resolve(ctx) {
        return await strapi
            .service("api::ticket-raise.ticket-raise")
            .resolve(ctx);
    },

   async markMessagesRead(ctx) {
    try {
        const authUser = ctx.state.user;

        if (!authUser) {
            return ctx.unauthorized("Unauthorized.");
        }

        const { id } = ctx.params;

        const currentUser = await strapi.entityService.findOne(
            "plugin::users-permissions.user",
            authUser.id,
            {
                populate: {
                    role: true,
                },
            }
        );

        const SUPPORT_ROLES = ["Authenticated", "SubAdmin"];

        const ticket = await strapi.entityService.findOne(
            "api::ticket-raise.ticket-raise",
            id,
            {
                populate: {
                    user: true,
                    assignedTo: true,
                    messages: true,
                },
            }
        );

        if (!ticket) {
            return ctx.notFound("Ticket not found.");
        }

        let unreadMessages = [];

        // Existing user logic
        if (ticket.user.id === authUser.id) {
            unreadMessages = ticket.messages.filter(
                (message) =>
                    message.senderType === "admin" &&
                    !message.isRead
            );
        }
        // Admin logic
        else if (SUPPORT_ROLES.includes(currentUser.role?.name)) {
            // Ignore if this admin is not assigned to the ticket
            if (
                !ticket.assignedTo ||
                ticket.assignedTo.id !== authUser.id
            ) {
                return ctx.send({
                    success: true,
                });
            }

            unreadMessages = ticket.messages.filter(
                (message) =>
                    message.senderType === "user" &&
                    !message.isRead
            );
        } else {
            return ctx.forbidden();
        }

        await Promise.all(
            unreadMessages.map((message) =>
                strapi.entityService.update(
                    "api::ticket-message.ticket-message",
                    message.id,
                    {
                        data: {
                            isRead: true,
                        },
                    }
                )
            )
        );

        return ctx.send({
            success: true,
        });
    } catch (error) {
        strapi.log.error(error);

        return ctx.internalServerError();
    }
},

    async submitFeedback(ctx) {
        try {
            const authUser = ctx.state.user;

            if (!authUser) {
                return ctx.unauthorized("Unauthorized.");
            }

            const { id } = ctx.params;
            const { feedbackEmoji, feedbackComment } = ctx.request.body;
            const comment = feedbackComment?.trim();

            const allowedEmojis = ["bad", "okay", "good", "excellent"];

            if (!feedbackEmoji || !allowedEmojis.includes(feedbackEmoji)) {
                return ctx.badRequest(
                    "feedbackEmoji must be one of: bad, okay, good, excellent."
                );
            }

            const ticket = await strapi.entityService.findOne(
                "api::ticket-raise.ticket-raise",
                id,
                {
                    populate: {
                        user: true,
                    },
                }
            );

            if (!ticket) {
                return ctx.notFound("Ticket not found.");
            }

            // Only ticket owner can submit feedback
            if (ticket.user.id !== authUser.id) {
                return ctx.forbidden("You cannot submit feedback for this ticket.");
            }

            // Ticket must be resolved
            if (ticket.status !== "resolved") {
                return ctx.badRequest(
                    "Feedback can only be submitted for resolved tickets."
                );
            }

            // Prevent duplicate feedback
            if (ticket.feedbackSubmittedAt) {
                return ctx.badRequest(
                    "Feedback has already been submitted for this ticket."
                );
            }

            const updatedTicket = await strapi.entityService.update(
                "api::ticket-raise.ticket-raise",
                id,
                {
                    data: {
                        feedbackEmoji,
                      feedbackComment: comment || null,
                        feedbackSubmittedAt: new Date(),
                    },
                }
            );

            return ctx.send({
                message: "Feedback submitted successfully.",
                data: updatedTicket,
            });
        } catch (error) {
            strapi.log.error(error);

            return ctx.internalServerError("Something went wrong.");
        }
    },

};