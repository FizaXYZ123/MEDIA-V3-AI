'use strict';

const utils = require('@strapi/utils');
const { getService } = require('@strapi/plugin-users-permissions/server/utils');
const { ApplicationError, ValidationError } = utils.errors;

module.exports = {
  async callback(ctx) {
    const { identifier, password } = ctx.request.body;

    if (!identifier || !password) {
      throw new ValidationError('Please provide both identifier and password');
    }

    const user = await strapi.query('plugin::users-permissions.user').findOne({
      where: {
        $or: [
          { email: identifier.toLowerCase() },
          { username: identifier },
        ],
      },
      populate: ['role'], // ✅ populate role
    });

    if (!user) {
      throw new ApplicationError('Invalid identifier or password');
    }

    const validPassword = await strapi
      .service('plugin::users-permissions.user')
      .validatePassword(password, user.password);

    if (!validPassword) {
      throw new ApplicationError('Invalid identifier or password');
    }

    const token = strapi
      .service('plugin::users-permissions.jwt')
      .issue({ id: user.id });

    ctx.body = {
      jwt: token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role ? {
          id: user.role.id,
          name: user.role.name,
          type: user.role.type,
        } : null,
      },
    };
  },


  async register(ctx) {
    const pluginStore = await strapi.store({
      type: 'plugin',
      name: 'users-permissions',
    });

    const settings = await pluginStore.get({ key: 'advanced' });
    const { email, username, password } = ctx.request.body;

    if (!email || !username || !password) {
      throw new ValidationError('Please provide email, username, and password');
    }

    const userService = getService('user');
    const roleService = getService('role');

    const defaultRole = await roleService.getDefaultRole();

    const user = await userService.add({
      email: email.toLowerCase(),
      username,
      password,
      role: defaultRole.id,
      confirmed: !settings.email_confirmation,
    });

    const userWithRole = await strapi.query('plugin::users-permissions.user').findOne({
      where: { id: user.id },
      populate: ['role'],
    });

    const jwt = strapi
      .service('plugin::users-permissions.jwt')
      .issue({ id: user.id });

    ctx.body = {
      jwt,
      user: {
        id: userWithRole.id,
        username: userWithRole.username,
        email: userWithRole.email,
        role: userWithRole.role ? {
          id: userWithRole.role.id,
          name: userWithRole.role.name,
          type: userWithRole.role.type,
        } : null,
      },
    };
  },

  // ✅ Add "me" endpoint
  async me(ctx) {
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized("You're not logged in");
    }

    const userWithRole = await strapi.entityService.findOne(
      'plugin::users-permissions.user',
      user.id,
      {
        populate: { role: true },
      }
    );

    return ctx.send({
      id: userWithRole.id,
      username: userWithRole.username,
      email: userWithRole.email,
      role: userWithRole.role ? {
        id: userWithRole.role.id,
        name: userWithRole.role.name,
        type: userWithRole.role.type,
      } : null,
    });
  },

};
