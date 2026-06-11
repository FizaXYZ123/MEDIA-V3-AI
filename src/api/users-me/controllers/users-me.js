'use strict';
const createActivityLog = require("../../../utils/activity-log");

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

      const loggedInUser = await strapi.entityService.findOne(
        "plugin::users-permissions.user",
        ctx.state.user.id,
        {
          populate: ["role"],
        }
      );

      const targetUser = await strapi.entityService.findOne(
        "plugin::users-permissions.user",
        id
      );

      /*
       * USER UPDATE
       */

      let existingUser = null;

      if (user) {
        existingUser = await strapi.entityService.findOne(
          "plugin::users-permissions.user",
          id
        );

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

        const changes = [];

        if (existingUser.firstName !== user.firstName) {
          changes.push("First Name");
        }

        if (existingUser.lastName !== user.lastName) {
          changes.push("Last Name");
        }

        if (
          (existingUser.phoneNumber ?? "") !==
          (user.phoneNumber ?? "")
        ) {
          changes.push("Phone Number");
        }

        if (
          (existingUser.currency ?? "") !==
          (user.currency ?? "")
        ) {
          changes.push("Currency");
        }

        const oldDob = existingUser.dob
          ? new Date(existingUser.dob).toISOString().split("T")[0]
          : "";

        const newDob = user.dob
          ? new Date(user.dob).toISOString().split("T")[0]
          : "";

        if (oldDob !== newDob) {
          changes.push("DOB");
        }

        if (user.Profile_image) {
          changes.push("Profile Image");
        }

        if (changes.length > 0) {
          await createActivityLog({
            user: loggedInUser,
            action: "Update",
            module: "User",
            entityId: id,
            entityName: `${targetUser.firstName} ${targetUser.lastName}`,
            description: `Updated user ${targetUser.firstName} ${targetUser.lastName}. Updated fields: ${changes.join(", ")}`,
          });
        }
      }

      /*
       * SUBSCRIPTION UPDATE
       */

      if (subscription?.id) {
        const existingSubscription = await strapi.entityService.findOne(
          "api::user-subscription.user-subscription",
          subscription.id,
          {
            populate: ["plan"],
          }
        );

        const subscriptionChanged =
          Number(existingSubscription.artistsAllowed) !==
          Number(subscription.artistsAllowed) ||
          existingSubscription.plan?.id !== Number(subscription.plan);

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

        const changes = [];

        if (
          Number(existingSubscription.artistsAllowed) !==
          Number(subscription.artistsAllowed)
        ) {
          changes.push("Artists Allowed");
        }

        if (
          existingSubscription.plan?.id !== Number(subscription.plan)
        ) {
          changes.push("Subscription Plan");
        }

        if (changes.length > 0) {
          await createActivityLog({
            user: loggedInUser,
            action: "Update",
            module: "Subscription",
            entityId: id,
            entityName: `${targetUser.firstName} ${targetUser.lastName}`,
            description: `Updated subscription for ${targetUser.firstName} ${targetUser.lastName}. Updated fields: ${changes.join(", ")}`,
          });
        }
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
                publishedAt: new Date(),
              },
            }
          );

          await createActivityLog({
            user: loggedInUser,
            action: "Update",
            module: "AdminFee",
            entityId: id,
            entityName: `${targetUser.firstName} ${targetUser.lastName}`,
            description: `Changed admin fee for ${targetUser.firstName} ${targetUser.lastName} from ${latestAdminFee?.feePercentage || 0
              }% to ${adminFee}%`,
          });
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
                publishedAt: new Date(),
              },
            }
          );

          await createActivityLog({
            user: loggedInUser,
            action: "Update",
            module: "LabelFee",
            entityId: id,
            entityName: `${targetUser.firstName} ${targetUser.lastName}`,
            description: `Changed label fee for ${targetUser.firstName} ${targetUser.lastName} from ${latestLabelFee?.feePercentage || 0
              }% to ${labelFee}%`,
          });
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

          await createActivityLog({
            user: loggedInUser,
            action: "Update",
            module: "EnterpriseCommission",
            entityId: id,
            entityName: `${targetUser.firstName} ${targetUser.lastName}`,
            description: `Changed enterprise commission for ${targetUser.firstName} ${targetUser.lastName} from ${latestCommission?.commission_percentage || 0
              }% to ${enterpriseCommission}%`,
          });
        }
      }

      /*
       * ARTISTS UPDATE
       */

      if (Array.isArray(artists)) {
        for (const artist of artists) {
          const existingArtist = await strapi.entityService.findOne(
            "api::artist-detail.artist-detail",
            artist.id,
            {
              populate: {
                Profile_image: true,
              },
            }
          );

          const changes = [];

          if (existingArtist.artistName !== artist.artistName) {
            changes.push(
              `Artist Name: "${existingArtist.artistName}" → "${artist.artistName}"`
            );
          }

          if (existingArtist.roleName !== artist.roleName) {
            changes.push(
              `Role: "${existingArtist.roleName}" → "${artist.roleName}"`
            );
          }

          if (existingArtist.spotifyId !== artist.spotifyId) {
            changes.push(
              `Spotify ID: "${existingArtist.spotifyId || "-"}" → "${artist.spotifyId || "-"}"`
            );
          }

          if (existingArtist.appleMusicId !== artist.appleMusicId) {
            changes.push(
              `Apple Music ID: "${existingArtist.appleMusicId || "-"}" → "${artist.appleMusicId || "-"}"`
            );
          }

          if (existingArtist.youtubeUsername !== artist.youtubeUsername) {
            changes.push(
              `YouTube Username: "${existingArtist.youtubeUsername || "-"}" → "${artist.youtubeUsername || "-"}"`
            );
          }

          if (existingArtist.biography !== artist.biography) {
            changes.push(`Biography updated`);
          }

          const existingImageId = existingArtist.Profile_image?.id || null;
          const newImageId =
            typeof artist.Profile_image === "object"
              ? artist.Profile_image?.id
              : artist.Profile_image || null;

          if (existingImageId !== newImageId) {
            changes.push("Profile Image");
          }

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
              },
            }
          );

          if (changes.length > 0) {
            await createActivityLog({
              user: loggedInUser,
              action: "Update",
              module: "Artist",
              entityId: artist.id,
              entityName: artist.artistName,
              description: `Updated artist "${artist.artistName}" for user ${targetUser.firstName} ${targetUser.lastName}. Changes: ${changes.join(", ")}`,
            });
          }
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
