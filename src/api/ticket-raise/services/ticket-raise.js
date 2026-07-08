"use strict";
const axios = require("axios");
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
            description,
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

        if (!description || !description.trim()) {
            return ctx.badRequest("Description is required.");
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
                        description: description.trim(),
                        attachments: attachmentIds,
                        category,
                        status: "open",
                        user: authUser.id,
                        lastActivityAt: new Date(),
                        publishedAt: new Date(),
                    },
                }
            );

            // create user activity log
            await createUserActivityLog({
                userId: authUser.id,
                action: "ticket_raised",
                description: `Support ticket ${ticket.ticketNumber} raised successfully.`,
            });

            // ------------------------
            // Send confirmation email
            // ------------------------

            try {
                await axios.post(
                    "https://api.brevo.com/v3/smtp/email",
                    {
                        sender: {
                            name: "Amozart",
                            email: process.env.BREVO_FROM_EMAIL,
                        },
                        to: [
                            {
                                email: authUser.email,
                            },
                        ],
                        subject: `Support Ticket Created - ${ticket.ticketNumber}`,
                        htmlContent: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:20px;">
<tr>
<td align="center">

<table width="100%" cellpadding="0" cellspacing="0"
style="max-width:600px;background:#ffffff;border-radius:10px;overflow:hidden;">

<tr>
<td align="center" style="background:#6e36be;padding:18px;">
<img src="https://admin.amozart.com/assets/updateLogo-DoU658F0.png" style="max-width:120px;" />
<div style="color:#fff;font-size:18px;font-weight:bold;margin-top:10px;">
Support Ticket Created
</div>
</td>
</tr>

<tr>
<td style="padding:25px;">

<p>Hello <strong>${authUser.firstName || authUser.username}</strong>,</p>

<p>Your support ticket has been created successfully.</p>

<table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;border:1px solid #ddd;">

<tr>
<td><strong>Ticket Number</strong></td>
<td>${ticket.ticketNumber}</td>
</tr>

<tr>
<td><strong>Title</strong></td>
<td>${ticket.title}</td>
</tr>

<tr>
<td><strong>Category</strong></td>
<td>${ticket.category
    .split("_")
    .map(
        (word) =>
            word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(" ")}</td>
</tr>

<tr>
<td><strong>Status</strong></td>
<td>Open</td>
</tr>

</table>

<p style="margin-top:20px;">
Our support team will review your request and respond as soon as possible.
</p>

</td>
</tr>

<tr>
<td align="center"
style="padding:15px;background:#fafafa;font-size:12px;color:#888;">
© ${new Date().getFullYear()} Amozart
</td>
</tr>

</table>

</td>
</tr>
</table>

</body>
</html>
`,
                    },
                    {
                        headers: {
                            "api-key": process.env.BREVO_API_KEY,
                            "Content-Type": "application/json",
                        },
                    }
                );
            } catch (emailError) {
                strapi.log.error(
                    `Failed to send ticket creation email for ticket ${ticket.ticketNumber}:`,
                    emailError.response?.data || emailError.message
                );
            }
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

            const { search = "" } = ctx.query;

            const filters = {
                user: authUser.id,
            };

            if (search.trim()) {
                filters.$or = [
                    {
                        ticketNumber: {
                            $containsi: search.trim(),
                        },
                    },
                    {
                        title: {
                            $containsi: search.trim(),
                        },
                    },
                ];
            }

            const tickets = await strapi.entityService.findMany(
                "api::ticket-raise.ticket-raise",
                {
                    filters,

                    fields: [
                        "ticketNumber",
                        "title",
                        "category",
                        "status",
                        "createdAt",
                        "updatedAt",
                        "lastActivityAt",
                    ],

                    populate: {
                        messages: {
                            fields: [
                                "senderType",
                                "isRead",
                            ],
                        },
                    },

                    sort: {
                        lastActivityAt: "desc",
                    },
                }
            );

            const formattedTickets = tickets.map((ticket) => ({
                ...ticket,

                unreadCount: ticket.messages.filter(
                    (message) =>
                        message.senderType === "admin" &&
                        !message.isRead
                ).length,
            }));

            return ctx.send({
                success: true,
                message: "Tickets fetched successfully.",
                count: formattedTickets.length,
                data: formattedTickets,
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
                attachments: true,
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

            const SUPPORT_ROLES = ["Authenticated", "SubAdmin"];
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

                ticket = await strapi.entityService.findOne(
                    "api::ticket-raise.ticket-raise",
                    ticket.id,
                    {
                        populate: ticketPopulate,
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

            const SUPPORT_ROLES = ["Authenticated", "SubAdmin"];
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
                       isRead: false,
                        publishedAt: new Date()
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

            if (ticket.status !== "resolved") {
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

            const SUPPORT_ROLES = ["Authenticated", "SubAdmin"];

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

                        messages: {
                            fields: ["id"],
                            filters: {
                                senderType: "user",
                                isRead: false,
                            },
                        },


                    },
                }
            );

            const data = tickets.map((ticket) => ({
                ...ticket,
                unreadCount: ticket.messages?.length || 0,
                messages: undefined,
            }));

            return ctx.send({
                success: true,
                count: data.length,
                message: "Tickets fetched successfully.",
                data,
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

            const SUPPORT_ROLES = ["Authenticated", "SubAdmin"];

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

            try {
                await axios.post(
                    "https://api.brevo.com/v3/smtp/email",
                    {
                        sender: {
                            name: "Amozart",
                            email: process.env.BREVO_FROM_EMAIL,
                        },
                        to: [
                            {
                                email: updatedTicket.user.email,
                            },
                        ],
                        subject: `Support Ticket Resolved - ${updatedTicket.ticketNumber}`,
                        htmlContent: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:20px;">
<tr>
<td align="center">

<table width="100%" cellpadding="0" cellspacing="0"
style="max-width:600px;background:#ffffff;border-radius:10px;overflow:hidden;">

<tr>
<td align="center" style="background:#6e36be;padding:18px;">
<img src="https://admin.amozart.com/assets/updateLogo-DoU658F0.png" style="max-width:120px;" />
<div style="color:#fff;font-size:18px;font-weight:bold;margin-top:10px;">
Support Ticket Resolved
</div>
</td>
</tr>

<tr>
<td style="padding:25px;">

<p>Hello <strong>${updatedTicket.user.firstName || updatedTicket.user.username}</strong>,</p>

<p>Your support ticket has been marked as <strong>Resolved</strong>.</p>

<table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;border:1px solid #ddd;">

<tr>
<td><strong>Ticket Number</strong></td>
<td>${updatedTicket.ticketNumber}</td>
</tr>

<tr>
<td><strong>Title</strong></td>
<td>${updatedTicket.title}</td>
</tr>

<tr>
<td><strong>Category</strong></td>
<td>${updatedTicket.category
    .split("_")
    .map(
        (word) =>
            word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(" ")}</td>
</tr>

<tr>
<td><strong>Status</strong></td>
<td>Resolved</td>
</tr>

</table>

<p style="margin-top:20px;">
We're glad we could assist you. If your issue isn't fully resolved or you need further help, you can create a new support ticket anytime.
</p>

</td>
</tr>

<tr>
<td align="center"
style="padding:15px;background:#fafafa;font-size:12px;color:#888;">
© ${new Date().getFullYear()} Amozart
</td>
</tr>

</table>

</td>
</tr>
</table>

</body>
</html>
`,
                    },
                    {
                        headers: {
                            "api-key": process.env.BREVO_API_KEY,
                            "Content-Type": "application/json",
                        },
                    }
                );
            } catch (emailError) {
                strapi.log.error(
                    `Failed to send ticket resolved email for ticket ${updatedTicket.ticketNumber}:`,
                    emailError.response?.data || emailError.message
                );
            }

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