'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/publish-distributes/export-sonosuite',
      handler: 'sonosuite-export.exportCSV',
      config: { auth: {} },
    },
  ],
};
