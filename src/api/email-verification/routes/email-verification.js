// src/api/email-verification/routes/email-verification.js

module.exports = {
    routes: [
      {
        method: 'POST',
        path: '/email/send-verification',
        handler: 'email-verification.sendVerification',
        config: {
          policies: [],
          middlewares: [],
        },
      },
      {
        method: 'POST',
        path: '/email/verify',
        handler: 'email-verification.verifyOtp',
        config: {
          policies: [],
          middlewares: [],
        },
      },
      {
        method: 'GET',
        path: '/email/check-status',
        handler: 'email-verification.checkVerificationStatus',
        config: {
          policies: [],
          middlewares: [],
        },
      },
    ],
  };
  