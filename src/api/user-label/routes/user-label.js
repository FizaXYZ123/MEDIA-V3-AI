'use strict';

module.exports = {
  routes: [
    // List my labels (optionally search by ?q=)
    { method: 'GET',  path: '/me/labels',              handler: 'user-label.findMy' },
    // Upsert: create if not exists for this user, else return existing
    { method: 'POST', path: '/me/labels/ensure',       handler: 'user-label.ensure' },
    // Delete my label
    { method: 'DELETE', path: '/me/labels/:id',        handler: 'user-label.deleteMy' }
  ],
};
