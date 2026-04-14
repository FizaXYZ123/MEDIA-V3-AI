module.exports = {
  routes: [
    {
      "method": "PATCH",
      "path": "/users/me",
      "handler": "users-me.patchMe",
      "config": {
        "policies": [],
        "auth": true
      }
    }
  ]
}
