module.exports={
    routes:[
         {
      method: "GET",
      path: "/user/transaction-history",
      handler: "transaction-history.history",
      config: {
        auth: {},
      },
    },
    ]

}