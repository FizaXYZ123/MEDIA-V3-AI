'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/google-login',
      handler: 'google-auth.googleLogin',
      config: {
        auth: false,
      },
    },
  ],
};