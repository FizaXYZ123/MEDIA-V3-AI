'use strict';

module.exports = {
  // PATCH /api/users/me
  async patchMe(ctx) {
    const authUser = ctx.state.user;
    if (!authUser) return ctx.unauthorized('You must be logged in.');

    const incoming = { ...(ctx.request.body || {}) };

    const forbidden = [
      'id',
      'role',
      'provider',
      'confirmed',
      'blocked',
      'resetPasswordToken',
      'confirmationToken',
      'password',
    ];
    forbidden.forEach((f) => {
      if (Object.prototype.hasOwnProperty.call(incoming, f)) delete incoming[f];
    });

    // trim strings
    Object.keys(incoming).forEach((k) => {
      if (typeof incoming[k] === 'string') incoming[k] = incoming[k].trim();
    });

    try {
      const updated = await strapi.entityService.update(
        'plugin::users-permissions.user',
        authUser.id,
        { data: incoming }
      );

      const userWithRole = await strapi.entityService.findOne(
        'plugin::users-permissions.user',
        updated.id,
        { populate: ['role', 'Profile_image'] }
      );

      if (userWithRole && userWithRole.password) delete userWithRole.password;

      // sanitize and return — if sanitize helper not available, just return the object
      if (typeof strapi.controllers === 'object' && strapi.controllers['api::users-me.users-me']) {
        // not needed, defensive: use raw object
      }

      ctx.body = userWithRole;
      ctx.status = 200;
      return ctx;
    } catch (err) {
      ctx.throw(400, err);
    }
  },
};
