'use strict';

const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID
);

module.exports = {

  async googleLogin(ctx) {

    try {

      const { idToken } =
        ctx.request.body;

      if (!idToken) {
        return ctx.badRequest(
          'Missing idToken'
        );
      }

      /* ================= VERIFY GOOGLE TOKEN ================= */

      const ticket =
        await client.verifyIdToken({
          idToken,
          audience:
            process.env
              .GOOGLE_CLIENT_ID,
        });

      const payload =
        ticket.getPayload();

      if (!payload?.email) {
        return ctx.badRequest(
          'Invalid Google token'
        );
      }

      /* ================= USER DATA ================= */

      const email =
        payload.email.toLowerCase();

      const firstName =
        payload.given_name || '';

      const lastName =
        payload.family_name || '';

      const fullName =
        payload.name ||
        `${firstName} ${lastName}`.trim();

      // Google usually does not provide phone number
      const phoneNumber =
        payload.phone_number || '';

      /* ================= USERNAME ================= */

      const base =
        (
          firstName || 'user'
        )
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '');

      let username;
      let exists = true;

      while (exists) {

        const randomNumber =
          Math.floor(
            1000 +
              Math.random() * 9000
          );

        username =
          `${base}${randomNumber}`;

        const check =
          await strapi.db
            .query(
              'plugin::users-permissions.user'
            )
            .findOne({
              where: {
                username,
              },
            });

        if (!check) {
          exists = false;
        }
      }

      /* ================= ROLE ================= */

      const userRole =
        await strapi.db
          .query(
            'plugin::users-permissions.role'
          )
          .findOne({
            where: {
              name: 'Client',
            },
          });

      if (!userRole) {
        return ctx.internalServerError(
          'Client role not found'
        );
      }

      /* ================= FIND USER ================= */

      let user =
        await strapi.db
          .query(
            'plugin::users-permissions.user'
          )
          .findOne({
            where: { email },
          });

      /* ================= TOKEN ================= */

      const confirmationToken =
        crypto
          .randomBytes(32)
          .toString('hex');

      /* ================= RANDOM PASSWORD ================= */

      const generatedPassword =
        crypto
          .randomBytes(12)
          .toString('hex');

      /* ================= CREATE USER ================= */

      if (!user) {

        user =
          await strapi.entityService.create(
            'plugin::users-permissions.user',
            {
              data: {

                firstName,

                lastName,

                FulllName:
                  fullName,

                username,

                email,

                phoneNumber,

                provider:
                  'google',

                confirmed: true,

                confirmationToken,

                role:
                  userRole.id,

                password:
                  generatedPassword,
              },
            }
          );
      } else {

        await strapi.db
          .query(
            'plugin::users-permissions.user'
          )
          .update({
            where: {
              id: user.id,
            },

            data: {
              confirmationToken,

              confirmed: true,
            },
          });
      }

      /* ================= JWT ================= */

      const jwt =
        strapi.plugins[
          'users-permissions'
        ].services.jwt.issue({
          id: user.id,
        });

      /* ================= USER DETAILS ================= */

      const latestUser =
        await strapi.entityService.findOne(
          'plugin::users-permissions.user',
          user.id,
          {
            populate: [
              'role',
              'Profile_image',
            ],
          }
        );

      /* ================= RESPONSE ================= */

      return ctx.send({
        jwt,

        user: {
          ...latestUser,

          profileImage:
            latestUser.Profile_image
              ? {
                  id:
                    latestUser
                      .Profile_image.id,

                  url:
                    latestUser
                      .Profile_image.url,

                  name:
                    latestUser
                      .Profile_image.name,

                  mime:
                    latestUser
                      .Profile_image.mime,
                }
              : null,
        },
      });

    } catch (err) {

      console.error(
        'GOOGLE LOGIN ERROR:',
        err
      );

      return ctx.internalServerError(
        'Google Login Failed'
      );
    }
  },
};