module.exports = {
  routes: [
    {
      method: "POST",
      path: "/auth/send-otp",
      handler: "forget-password.sendOtp",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/auth/verify-otp",
      handler: "forget-password.verifyOtp",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/auth/reset-password",
      handler: "forget-password.resetPassword",
      config: { auth: false },
    },
    {
  method: "POST",
  path: "/auth/resend-otp",
  handler: "forget-password.resendOtp",
  config: {
    auth: false,
  },
}
  ],
};