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

  async getUser(ctx) {
    try {

      const authUser = ctx.state.user;

      if (!authUser) {
        return ctx.unauthorized("Authentication required");
      }

      const fullUser = await strapi.entityService.findOne(
        "plugin::users-permissions.user",
        authUser.id,
        {
          populate: {
            role: true,
          },
        }
      );

      if (!fullUser || fullUser.role?.name !== "Authenticated") {
        return ctx.forbidden("Access denied");
      }
      const { id } = ctx.params;

      const user = await strapi.entityService.findOne(
        "plugin::users-permissions.user",
        id,
        {
          populate: {
            Profile_image: true,

            user_subscriptions: {
              populate: {
                plan: true,
              },
            },

            artist_details: {
              populate: {
                Profile_image: true,
              },
            },
          },
        }
      );
      const plans = await strapi.entityService.findMany(
        "api::plan.plan",
        {
          sort: { id: "asc" },
        }
      );

      const latestAdminFee = await strapi.entityService.findMany(
        "api::admin-fee-history.admin-fee-history",
        {
          filters: {
            users_permissions_user: id,
          },
          sort: ["createdAt:desc"],
          limit: 1,
        }
      );

      const latestLabelFee = await strapi.entityService.findMany(
        "api::label-fee-history.label-fee-history",
        {
          filters: {
            users_permissions_user: id,
          },
          sort: ["createdAt:desc"],
          limit: 1,
        }
      );

      const latestEnterpriseCommission = await strapi.entityService.findMany(
        "api::enterprise-commission.enterprise-commission",
        {
          filters: {
            users_permissions_user: id,
          },
          sort: ["createdAt:desc"],
          limit: 1,
        }
      );

      if (!user) {
        return ctx.notFound("User not found");
      }

      return {
        success: true,
        data: {
          user,
          availablePlans: plans,
          latestAdminFee: latestAdminFee?.[0] || null,
          latestLabelFee: latestLabelFee?.[0] || null,
          latestEnterpriseCommission:
            latestEnterpriseCommission?.[0] || null,
        },
      };
    } catch (error) {
      console.error(error);
      return ctx.badRequest(error.message);
    }
  },

  async editUser(ctx) {
    try {
      const { id } = ctx.params;

      const {
        user,
        subscription,
        artists,
        adminFee,
        labelFee,
        enterpriseCommission,
      } = ctx.request.body;

      /*
       * USER UPDATE
       */

      if (user) {
        await strapi.entityService.update(
          "plugin::users-permissions.user",
          id,
          {
            data: {
              firstName: user.firstName,
              lastName: user.lastName,
              phoneNumber: user.phoneNumber,
              currency: user.currency,
              dob: user.dob,

              ...(user.Profile_image && {
                Profile_image: user.Profile_image,
              }),
            },
          }
        );
      }

      /*
       * SUBSCRIPTION UPDATE
       */

      if (subscription?.id) {
        await strapi.entityService.update(
          "api::user-subscription.user-subscription",
          subscription.id,
          {
            data: {
              artistsAllowed: subscription.artistsAllowed,

              ...(subscription.plan && {
                plan: subscription.plan,
              }),
            },
          }
        );
      }

      /*
 * ADMIN FEE HISTORY
 */

      if (
        adminFee !== undefined &&
        adminFee !== null &&
        adminFee !== ""
      ) {
        const latestAdminFee = await strapi.db
          .query("api::admin-fee-history.admin-fee-history")
          .findOne({
            where: {
              users_permissions_user: id,
            },
            orderBy: {
              createdAt: "desc",
            },
          });

        if (
          !latestAdminFee ||
          Number(latestAdminFee.feePercentage) !== Number(adminFee)
        ) {
          await strapi.entityService.create(
            "api::admin-fee-history.admin-fee-history",
            {
              data: {
                feePercentage: Number(adminFee),
                users_permissions_user: id,
                effective_from: new Date(),
                publishedAt: new Date()
              },
            }
          );
        }
      }

      /*
       * LABEL FEE HISTORY
       */

      if (
        labelFee !== undefined &&
        labelFee !== null &&
        labelFee !== ""
      ) {
        const latestLabelFee = await strapi.db
          .query("api::label-fee-history.label-fee-history")
          .findOne({
            where: {
              users_permissions_user: id,
            },
            orderBy: {
              createdAt: "desc",
            },
          });

        if (
          !latestLabelFee ||
          Number(latestLabelFee.feePercentage) !== Number(labelFee)
        ) {
          await strapi.entityService.create(
            "api::label-fee-history.label-fee-history",
            {
              data: {
                feePercentage: Number(labelFee),
                users_permissions_user: id,
                effective_from: new Date(),
                publishedAt:new Date()
              },
            }
          );
        }
      }

      /*
       * ENTERPRISE COMMISSION HISTORY
       */

      if (
        enterpriseCommission !== undefined &&
        enterpriseCommission !== null &&
        enterpriseCommission !== ""
      ) {
        const latestCommission = await strapi.db
          .query(
            "api::enterprise-commission.enterprise-commission"
          )
          .findOne({
            where: {
              users_permissions_user: id,
            },
            orderBy: {
              createdAt: "desc",
            },
          });

        if (
          !latestCommission ||
          Number(latestCommission.commission_percentage) !==
          Number(enterpriseCommission)
        ) {
          await strapi.entityService.create(
            "api::enterprise-commission.enterprise-commission",
            {
              data: {
                commission_percentage: Number(enterpriseCommission),
                users_permissions_user: id,
                effective_from: new Date(),
                publishedAt: new Date(),
              },
            }
          );
        }
      }

      /*
       * ARTISTS UPDATE
       */

      if (Array.isArray(artists)) {
        for (const artist of artists) {
          await strapi.entityService.update(
            "api::artist-detail.artist-detail",
            artist.id,
            {
              data: {
                artistName: artist.artistName,
                roleName: artist.roleName,
                appleMusicId: artist.appleMusicId,
                spotifyId: artist.spotifyId,
                youtubeUsername: artist.youtubeUsername,
                soundcloudPage: artist.soundcloudPage,
                facebookPage: artist.facebookPage,
                twitterUsername: artist.twitterUsername,
                websiteUrl: artist.websiteUrl,
                biography: artist.biography,

                ...(artist.Profile_image && {
                  Profile_image: artist.Profile_image,
                }),

                // intentionally excluded:
                // owner
                // itsVerified
                // requiredVerification
              },
            }
          );
        }
      }

      const updatedUser = await strapi.entityService.findOne(
        "plugin::users-permissions.user",
        id,
        {
          populate: {
            Profile_image: true,

            user_subscriptions: {
              populate: {
                plan: true,
              },
            },

            artist_details: {
              populate: {
                Profile_image: true,
              },
            },
          },
        }
      );

      return {
        success: true,
        message: "User updated successfully",
        data: updatedUser,
      };
    } catch (error) {
      console.error(error);
      return ctx.badRequest(error.message);
    }
  },

};
