"use strict";

const generateTicketNumber = require("../../../utils/generateTicketNumber");
const createUserActivityLog = require("../../../utils/user-activity-log");
const createActivityLog = require("../../../utils/activity-log")

module.exports = () => ({

    async createTicket(ctx) {
        const authUser = ctx.state.user;

        if (!authUser) {
            return ctx.unauthorized("Unauthorized.");
        }

        const {
            title,
            category,
            message,
            attachments,
        } = ctx.request.body;

        const attachmentIds = Array.isArray(attachments)
            ? attachments
            : [];

        // ------------------------
        // Validation
        // ------------------------

        if (!title || !title.trim()) {
            return ctx.badRequest("Title is required.");
        }

        if (!category) {
            return ctx.badRequest("Category is required.");
        }

        if (
            (!message || !message.trim()) &&
            attachmentIds.length === 0
        ) {
            return ctx.badRequest(
                "Either a message or at least one attachment is required."
            );
        }

        // ------------------------
        // Create Ticket
        // ------------------------

        try {
            const ticketNumber = await generateTicketNumber(strapi);

            // ------------------------
            // Create Ticket
            // ------------------------

            const ticket = await strapi.entityService.create(
                "api::ticket-raise.ticket-raise",
                {
                    data: {
                        ticketNumber,
                        title: title.trim(),
                        category,
                        status: "open",
                        user: authUser.id,
                        lastActivityAt: new Date(),
                    },
                }
            );

            // ------------------------
            // Create First Message
            // ------------------------


            await strapi.entityService.create(
                "api::ticket-message.ticket-message",
                {
                    data: {
                        ticket: ticket.id,
                        sender: authUser.id,
                        senderType: "user",
                        message: message?.trim() || "",
                        attachments: attachmentIds,
                    },
                }
            );


            // create user activity log
            await createUserActivityLog({
                userId: authUser.id,
                action: "ticket_raised",
                description: `Support ticket ${ticket.ticketNumber} raised successfully.`,
            });

            // send email to user

            void strapi
                .plugin("email")
                .service("email")
                .send({
                    to: authUser.email,
                    subject: `Support Ticket Created - ${ticket.ticketNumber}`,
                    html: `
      <div style="font-family: Arial, sans-serif; line-height:1.6">
        <h2>Support Ticket Created Successfully</h2>

        <p>Hello <strong>${authUser.firstName || authUser.username}</strong>,</p>

        <p>
          Your support ticket has been created successfully.
          Our support team will review your request and get back to you as soon as possible.
        </p>

        <table style="border-collapse:collapse;margin:20px 0;">
          <tr>
            <td style="padding:8px;border:1px solid #ddd;"><strong>Ticket Number</strong></td>
            <td style="padding:8px;border:1px solid #ddd;">${ticket.ticketNumber}</td>
          </tr>

          <tr>
            <td style="padding:8px;border:1px solid #ddd;"><strong>Title</strong></td>
            <td style="padding:8px;border:1px solid #ddd;">${ticket.title}</td>
          </tr>

          <tr>
            <td style="padding:8px;border:1px solid #ddd;"><strong>Category</strong></td>
            <td style="padding:8px;border:1px solid #ddd;">${ticket.category}</td>
          </tr>
        </table>

        <p>We'll notify you once one of our support team members replies.</p>

        <br>

        <p>Regards,<br><strong>Support Team</strong></p>
      </div>
        `,
                })
                .catch((error) => {
                    strapi.log.error(
                        "Failed to send support ticket email:",
                        error
                    );
                });

            // ------------------------
            // Return Ticket
            // ------------------------

            const createdTicket = await strapi.entityService.findOne(
                "api::ticket-raise.ticket-raise",
                ticket.id,
                {
                    populate: {
                        user: {
                            fields: [
                                "id",
                                "username",
                                "email",
                                "firstName",
                                "lastName",
                            ],
                        },

                        assignedTo: {
                            fields: [
                                "id",
                                "username",
                                "email",
                                "firstName",
                                "lastName",
                            ],
                        },

                        resolvedBy: {
                            fields: [
                                "id",
                                "username",
                                "email",
                                "firstName",
                                "lastName",
                            ],
                        },

                        messages: {
                            populate: {
                                sender: {
                                    fields: [
                                        "id",
                                        "username",
                                        "email",
                                        "firstName",
                                        "lastName",
                                    ],
                                },
                                attachments: true,
                            },

                            sort: {
                                createdAt: "asc",
                            },
                        },
                    },
                }
            );

            return ctx.created({
                success: true,
                message: "Ticket created successfully.",
                data: createdTicket,
            });
        } catch (error) {
            strapi.log.error("Create Ticket Error:", error);

            return ctx.internalServerError("Unable to create ticket.");
        }
    },

    async myTickets(ctx) {
        try {
            const authUser = ctx.state.user;

            if (!authUser) {
                return ctx.unauthorized("Unauthorized.");
            }

            const tickets = await strapi.entityService.findMany(
                "api::ticket-raise.ticket-raise",
                {
                    filters: {
                        user: authUser.id,
                    },

                    populate: {
                        assignedTo: {
                            fields: [
                                "id",
                                "firstName",
                                "lastName",
                            ],
                        },

                        resolvedBy: {
                            fields: [
                                "id",
                                "firstName",
                                "lastName",
                            ],
                        },
                    },

                    sort: {
                        createdAt: "desc",
                    },
                }
            );

            return ctx.send({
                success: true,
                message: "Tickets fetched successfully.",
                count: tickets.length,
                data: tickets,
            });

        } catch (err) {
            strapi.log.error("Fetch My Tickets Error:", err);

            return ctx.internalServerError(
                "Unable to fetch tickets."
            );
        }
    },

    async findOne(ctx) {
        try {
            const authUser = ctx.state.user;

            if (!authUser) {
                return ctx.unauthorized("Unauthorized.");
            }

            const { id } = ctx.params;

            const ticketPopulate = {
                user: {
                    fields: [
                        "id",
                        "username",
                        "firstName",
                        "lastName",
                        "email",
                    ],
                },

                assignedTo: {
                    fields: [
                        "id",
                        "username",
                        "firstName",
                        "lastName",
                        "email",
                    ],
                },

                resolvedBy: {
                    fields: [
                        "id",
                        "username",
                        "firstName",
                        "lastName",
                        "email",
                    ],
                },

                messages: {
                    populate: {
                        sender: {
                            fields: [
                                "id",
                                "username",
                                "firstName",
                                "lastName",
                                "email",
                            ],
                        },
                        attachments: true,
                    },
                    sort: {
                        createdAt: "asc",
                    },
                },
            };

            // Get current user with role
            const currentUser = await strapi.entityService.findOne(
                "plugin::users-permissions.user",
                authUser.id,
                {
                    populate: {
                        role: true,
                    },
                }
            );

            const SUPPORT_ROLES = ["Admin", "SubAdmin"];
            const isSupportUser = SUPPORT_ROLES.includes(currentUser.role?.name);

            // Fetch ticket
            let ticket = await strapi.entityService.findOne(
                "api::ticket-raise.ticket-raise",
                id,
                {
                    populate: ticketPopulate
                }
            );

            if (!ticket) {
                return ctx.notFound("Ticket not found.");
            }

            // ----------------------------
            // Normal User
            // ----------------------------
            if (!isSupportUser) {
                if (ticket.user.id !== authUser.id) {
                    return ctx.forbidden("You are not allowed to view this ticket.");
                }

                return ctx.send({
                    success: true,
                    message: "Ticket fetched successfully.",
                    data: ticket,
                });
            }

            // ----------------------------
            // Admin / SubAdmin
            // Auto assign only once
            // ----------------------------
            if (
                !ticket.assignedTo?.id &&
                ticket.status === "open"
            ) {
                await strapi.entityService.update(
                    "api::ticket-raise.ticket-raise",
                    ticket.id,
                    {
                        data: {
                            assignedTo: authUser.id,
                            assignedAt: new Date(),
                            status: "in_progress",
                            lastActivityAt: new Date(),

                        },
                    }
                );

                // Reload updated ticket
                ticket = await strapi.entityService.findOne(
                    "api::ticket-raise.ticket-raise",
                    ticket.id,
                    {
                        populate: ticketPopulate
                    }
                );
            }

            return ctx.send({
                success: true,
                message: "Ticket fetched successfully.",
                data: ticket,
            });
        } catch (error) {
            strapi.log.error("Find Ticket Error:", error);

            return ctx.internalServerError("Unable to fetch ticket.");
        }
    },

    async reply(ctx) {
        try {
            const authUser = ctx.state.user;

            if (!authUser) {
                return ctx.unauthorized("Unauthorized.");
            }

            const { id } = ctx.params;
            const { message, attachments } = ctx.request.body;

            const attachmentIds = Array.isArray(attachments)
                ? attachments
                : [];

            // At least message or attachment is required
            if (
                (!message || !message.trim()) &&
                attachmentIds.length === 0
            ) {
                return ctx.badRequest(
                    "Either a message or at least one attachment is required."
                );
            }

            // Get current user with role
            const currentUser = await strapi.entityService.findOne(
                "plugin::users-permissions.user",
                authUser.id,
                {
                    populate: {
                        role: true,
                    },
                }
            );

            const SUPPORT_ROLES = ["Admin", "SubAdmin"];
            const isSupportUser = SUPPORT_ROLES.includes(currentUser.role?.name);

            // Fetch ticket
            const ticket = await strapi.entityService.findOne(
                "api::ticket-raise.ticket-raise",
                id,
                {
                    populate: {
                        user: true,
                        assignedTo: true,
                    },
                }
            );

            if (!ticket) {
                return ctx.notFound("Ticket not found.");
            }

            // Ticket already resolved
            if (ticket.status === "resolved") {
                return ctx.badRequest(
                    "This ticket has already been resolved."
                );
            }

            // -----------------------------
            // User
            // -----------------------------
            if (!isSupportUser) {
                if (ticket.user.id !== authUser.id) {
                    return ctx.forbidden(
                        "You are not allowed to reply to this ticket."
                    );
                }
            }

            // -----------------------------
            // Admin / SubAdmin
            // -----------------------------
            else {
                if (
                    !ticket.assignedTo ||
                    ticket.assignedTo.id !== authUser.id
                ) {
                    return ctx.forbidden(
                        "This ticket is assigned to another support member."
                    );
                }
            }

            // Create reply
            const reply = await strapi.entityService.create(
                "api::ticket-message.ticket-message",
                {
                    data: {
                        ticket: ticket.id,
                        sender: authUser.id,
                        senderType: isSupportUser ? "admin" : "user",
                        message: message?.trim() || "",
                        attachments: attachmentIds,
                    },
                    populate: {
                        sender: {
                            fields: [
                                "id",
                                "username",
                                "firstName",
                                "lastName",
                                "email"
                            ],
                        },
                        attachments: true,
                    },
                }
            );

            // Update ticket activity
            const ticketUpdate = {
                lastActivityAt: new Date(),
            };

            if (ticket.status === "open") {
                ticketUpdate.status = "in_progress";
            }

            await strapi.entityService.update(
                "api::ticket-raise.ticket-raise",
                ticket.id,
                {
                    data: ticketUpdate,
                }
            );

            // -----------------------------
            // Activity Log
            // -----------------------------

            if (isSupportUser) {
                await createActivityLog({
                    user: currentUser,
                    action: "ticket_reply",
                    module: "Support Ticket",
                    entityId: ticket.id,
                    entityName: ticket.ticketNumber,
                    description: `Replied to support ticket ${ticket.ticketNumber}.`,
                });
            } else {
                await createUserActivityLog({
                    userId: authUser.id,
                    action: "ticket_reply",
                    description: `Replied to support ticket ${ticket.ticketNumber}.`,
                });
            }

            return ctx.send({
                success: true,
                message: "Reply added successfully.",
                data: reply,
            });
        } catch (error) {
            strapi.log.error("Reply Ticket Error:", error);

            return ctx.internalServerError(
                "Unable to reply to ticket."
            );
        }
    },

    async adminTickets(ctx) {
        try {
            const authUser = ctx.state.user;

            if (!authUser) {
                return ctx.unauthorized("Unauthorized.");
            }

            const currentUser = await strapi.entityService.findOne(
                "plugin::users-permissions.user",
                authUser.id,
                {
                    populate: {
                        role: true,
                    },
                }
            );

            const SUPPORT_ROLES = ["Admin", "SubAdmin"];

            if (!SUPPORT_ROLES.includes(currentUser.role?.name)) {
                return ctx.forbidden(
                    "You are not authorized to access tickets."
                );
            }

            const {
                status,
                category,
                assignedTo,
                search,
            } = ctx.query;

            const filters = {};

            if (status) {
                filters.status = status;
            }

            if (category) {
                filters.category = category;
            }

            if (assignedTo) {
                filters.assignedTo =
                    assignedTo === "me"
                        ? authUser.id
                        : assignedTo;
            }

            if (search) {
                filters.$or = [
                    {
                        ticketNumber: {
                            $containsi: search,
                        },
                    },
                    {
                        title: {
                            $containsi: search,
                        },
                    },
                    {
                        user: {
                            username: {
                                $containsi: search,
                            },
                        },
                    },
                    {
                        user: {
                            email: {
                                $containsi: search,
                            },
                        },
                    },
                    {
                        user: {
                            firstName: {
                                $containsi: search,
                            },
                        },
                    },
                    {
                        user: {
                            lastName: {
                                $containsi: search,
                            },
                        },
                    },
                ];
            }

            const tickets = await strapi.entityService.findMany(
                "api::ticket-raise.ticket-raise",
                {
                    filters,

                    sort: {
                        lastActivityAt: "desc",
                    },

                    fields: [
                        "ticketNumber",
                        "title",
                        "status",
                        "category",
                        "createdAt",
                        "lastActivityAt",
                    ],

                    populate: {
                        user: {
                            fields: [
                                "id",
                                "username",
                                "firstName",
                                "lastName",
                                "email",
                            ],
                        },

                        assignedTo: {
                            fields: [
                                "id",
                                "username",
                                "firstName",
                                "lastName",
                                "email",
                            ],
                        },

                        resolvedBy: {
                            fields: [
                                "id",
                                "username",
                                "firstName",
                                "lastName",
                                "email",
                            ],
                        },
                    },
                }
            );

            return ctx.send({
                success: true,
                count: tickets.length,
                message: "Tickets fetched successfully.",
                data: tickets,
            });

        } catch (error) {
            strapi.log.error("Admin Tickets Error:", error);

            return ctx.internalServerError(
                "Unable to fetch tickets."
            );
        }
    },

    async resolve(ctx) {
        try {
            const authUser = ctx.state.user;

            if (!authUser) {
                return ctx.unauthorized("Unauthorized.");
            }

            const { id } = ctx.params;

            // Get current user with role
            const currentUser = await strapi.entityService.findOne(
                "plugin::users-permissions.user",
                authUser.id,
                {
                    populate: {
                        role: true,
                    },
                }
            );

            const SUPPORT_ROLES = ["Admin", "SubAdmin"];

            if (!SUPPORT_ROLES.includes(currentUser.role?.name)) {
                return ctx.forbidden("You are not authorized to resolve tickets.");
            }

            // Fetch ticket
            const ticket = await strapi.entityService.findOne(
                "api::ticket-raise.ticket-raise",
                id,
                {
                    populate: {
                        assignedTo: true,
                    },
                }
            );

            if (!ticket) {
                return ctx.notFound("Ticket not found.");
            }

            if (ticket.status === "resolved") {
                return ctx.badRequest("Ticket is already resolved.");
            }

            if (!ticket.assignedTo) {
                return ctx.badRequest("Ticket has not been assigned yet.");
            }

            if (ticket.assignedTo.id !== authUser.id) {
                return ctx.forbidden(
                    "Only the assigned support member can resolve this ticket."
                );
            }

            const updatedTicket = await strapi.entityService.update(
                "api::ticket-raise.ticket-raise",
                ticket.id,
                {
                    data: {
                        status: "resolved",
                        resolvedBy: authUser.id,
                        resolvedAt: new Date(),
                        lastActivityAt: new Date(),
                    },
                    populate: {
                        user: {
                            fields: [
                                "id",
                                "username",
                                "firstName",
                                "lastName",
                                "email",
                            ],
                        },
                        assignedTo: {
                            fields: [
                                "id",
                                "username",
                                "firstName",
                                "lastName",
                                "email",
                            ],
                        },
                        resolvedBy: {
                            fields: [
                                "id",
                                "username",
                                "firstName",
                                "lastName",
                                "email",
                            ],
                        },
                        messages: {
                            populate: {
                                sender: {
                                    fields: [
                                        "id",
                                        "username",
                                        "firstName",
                                        "lastName",
                                        "email"
                                    ],
                                },
                                attachments: true,
                            },
                            sort: {
                                createdAt: "asc",
                            },
                        },
                    },
                }
            );

            await createActivityLog({
                user: currentUser,
                action: "ticket_resolved",
                module: "Support Ticket",
                entityId: ticket.id,
                entityName: ticket.ticketNumber,
                description: `Resolved support ticket ${ticket.ticketNumber}.`,
            });

            void strapi
                .plugin("email")
                .service("email")
                .send({
                    to: updatedTicket.user.email,
                    subject: `Support Ticket Resolved - ${updatedTicket.ticketNumber}`,
                    html: `
        <div style="font-family: Arial, sans-serif; line-height:1.6">
            <h2>Your Support Ticket Has Been Resolved</h2>

            <p>Hello <strong>${updatedTicket.user.firstName || updatedTicket.user.username}</strong>,</p>

            <p>
                Your support request has been marked as <strong>Resolved</strong>.
            </p>

            <table style="border-collapse:collapse;margin:20px 0;">
                <tr>
                    <td style="padding:8px;border:1px solid #ddd;"><strong>Ticket Number</strong></td>
                    <td style="padding:8px;border:1px solid #ddd;">${updatedTicket.ticketNumber}</td>
                </tr>

                <tr>
                    <td style="padding:8px;border:1px solid #ddd;"><strong>Title</strong></td>
                    <td style="padding:8px;border:1px solid #ddd;">${updatedTicket.title}</td>
                </tr>
            </table>

            <p>If your issue is not fully resolved, you can contact our support team again by creating a new ticket.</p>

            <p>Regards,<br><strong>Support Team</strong></p>
        </div>
        `,
                })
                .catch((error) => {
                    strapi.log.error("Failed to send ticket resolved email:", error);
                });

            return ctx.send({
                success: true,
                message: "Ticket resolved successfully.",
                data: updatedTicket,
            });
        } catch (error) {
            strapi.log.error("Resolve Ticket Error:", error);

            return ctx.internalServerError("Unable to resolve ticket.");
        }
    }

});