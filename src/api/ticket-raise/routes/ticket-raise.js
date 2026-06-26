module.exports = {
  routes: [
    {
      method: "POST",
      path: "/tickets",
      handler: "ticket-raise.createTicket",
      config: {
        auth: {},
      },
    },
    {
      method: "GET",
      path: "/tickets/my",
      handler: "ticket-raise.myTickets",
      config: {
        auth: {},
      },
    },
    {
      method: "GET",
      path: "/tickets/:id",
      handler: "ticket-raise.findOne",
      config: {
        auth: {},
      },
    },
    {
      method: "POST",
      path: "/tickets/:id/reply",
      handler: "ticket-raise.reply",
      config: {
        auth: {},
      },
    },
    {
      method: "GET",
      path: "/admin/tickets",
      handler: "ticket-raise.adminTickets",
      config: {
        auth: {},
      },
    },
    {
      method: "POST",
      path: "/tickets/:id/resolve",
      handler: "ticket-raise.resolve",
      config: {
        auth: {},
      },
    }

  ]
}