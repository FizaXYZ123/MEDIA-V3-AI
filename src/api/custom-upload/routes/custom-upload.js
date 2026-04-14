'use strict';

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/custom-upload",
      handler: "custom-upload.upload",
      config: {
        auth: false, 
      },
    },
  ],
};