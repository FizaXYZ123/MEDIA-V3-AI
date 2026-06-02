module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/users/me',
      handler: 'auth.me',
      config: {
        auth: true,
      },
    }
  ],
};
