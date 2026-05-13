'use strict';

const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

module.exports = {

  async facebookLogin(ctx) {

    try {

      const { accessToken } =
        ctx.request.body;

      if (!accessToken) {
        return ctx.badRequest(
          'Missing accessToken'
        );
      }

      /* ================= VERIFY FACEBOOK TOKEN ================= */

      const fbResponse =
        await axios.get(
          'https://graph.facebook.com/me',
          {
            params: {
              fields:
                'id,name,email,picture',

              access_token:
                accessToken,
            },
          }
        );

      const payload =
        fbResponse.data;

      if (!payload?.email) {
        return ctx.badRequest(
          'Invalid Facebook token'
        );
      }

      /* ================= USER DATA ================= */

      const email =
        payload.email.toLowerCase();

      const fullName =
        payload.name || '';

      const nameParts =
        fullName.split(' ');

      const firstName =
        nameParts[0] || '';

      const lastName =
        nameParts
          .slice(1)
          .join(' ');

      const phoneNumber = '';

      const picture =
        payload.picture?.data?.url || '';

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

      let uploadedFileId = null;

      /* =========================
         UPLOAD FACEBOOK IMAGE
      ========================= */

      if (picture) {

        try {

          const response =
            await axios({
              url: picture,
              method: 'GET',
              responseType: 'arraybuffer',
            });

          const buffer =
            Buffer.from(response.data);

          const tempFilePath =
            path.join(
              os.tmpdir(),
              `facebook-${Date.now()}.jpg`
            );

          fs.writeFileSync(
            tempFilePath,
            buffer
          );

          const uploadedFiles =
            await strapi
              .plugin('upload')
              .service('upload')
              .upload({
                data: {},

                files: {
                  path: tempFilePath,
                  name:
                    `facebook-${Date.now()}.jpg`,
                  type: 'image/jpeg',
                  size: buffer.length,
                },
              });

          if (
            uploadedFiles &&
            uploadedFiles.length > 0
          ) {
            uploadedFileId =
              uploadedFiles[0].id;
          }

          fs.unlinkSync(tempFilePath);

        } catch (uploadError) {

          console.log(
            'FACEBOOK IMAGE UPLOAD ERROR:',
            uploadError
          );
        }
      }


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
                  'facebook',

                confirmed: true,

                confirmationToken,

                role:
                  userRole.id,

                password:
                  generatedPassword,

                Profile_image:
                  uploadedFileId,
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

      /* ================= SUBSCRIPTION ================= */

      const subscription = await strapi.db
        .query("api::user-subscription.user-subscription")
        .findMany({
          where: {
            users_permissions_user: user.id,
          },
          orderBy: { createdAt: "desc" },
          limit: 1,
          populate: ["plan"],
        });

      const latest_subscription =
        subscription[0] || null;

      /* ================= RESPONSE ================= */

      
const {
  Profile_image,
  ...restUser
} = latestUser;

return ctx.send({
  jwt,

  user: {

    ...restUser,

    profileImage:
      Profile_image
        ? {
            id:
              Profile_image.id,

            url:
              Profile_image.url,

            name:
              Profile_image.name,

            mime:
              Profile_image.mime,
          }
        : null,

    latest_subscription,
  },
});

    } catch (err) {

      console.error(
        'FACEBOOK LOGIN ERROR:',
        err.response?.data || err
      );

      return ctx.internalServerError(
        'Facebook Login Failed'
      );
    }
  },
};