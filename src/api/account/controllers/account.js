const { sort } = require("../../../../config/middlewares");
const distributeDraft = require("../../distribute-draft/controllers/distribute-draft");

const { ApplicationError } = require("@strapi/utils").errors;

module.exports = {
  // GET /api/email-exists?email=someone@example.com
  async checkEmailExists(ctx) {
    try {
      const raw = ctx.request.query?.email;
      if (!raw || typeof raw !== "string") {
        return ctx.badRequest('Query param "email" is required');
      }

      const email = raw.trim().toLowerCase();

      // optional format check
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!isEmail.test(email)) {
        return ctx.badRequest("Invalid email");
      }

      const users = await strapi.entityService.findMany(
        "plugin::users-permissions.user",
        { filters: { email }, fields: ["id"], limit: 1 }
      );

      ctx.body = { exists: users.length > 0 };
    } catch (err) {
      strapi.log.error("checkEmailExists error:", err);
      ctx.internalServerError("Internal error");
    }
  },
  /// Count published tracks + artist count + upcoming releases by userId
  async countByUser(ctx) {
    try {
      const { userId } = ctx.params;
      if (!userId) {
        return ctx.badRequest("User ID is required");
      }

      // 1. Published tracks count
      const trackCount = await strapi.db
        .query("api::distribute-track.distribute-track")
        .count({
          where: {
            publishedAt: { $notNull: true },
            $or: [
              { DraftRelease: { UserDetail: userId } },
              { PublishedRelease: { UserDetail: userId } },
            ],
          },
        });

      // 2. Artist count
      const artistCount = await strapi.db
        .query("api::artist-detail.artist-detail")
        .count({
          where: { owner: userId },
        });

      // 3. Upcoming releases (only today and future)
      const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format

      const upcomingReleases = await strapi.entityService.findMany(
        "api::publish-distribute.publish-distribute",
        {
          filters: {
            UserDetail: userId,
            releaseDate: { $gte: today }, // only today and future dates
          },
          populate: { TrackList: true },
        }
      );

      const upcomingCount = upcomingReleases.length;

      // 4. Lifetime earnings from invoices
      const invoices = await strapi.entityService.findMany(
        "api::invoice.invoice",
        {
          filters: {
            users_permissions_user: userId,
          },
          fields: ["finalAmountPayable"],
          limit: -1,
        }
      );

      const totalEarnings = invoices.reduce((sum, inv) => {
        return sum + Number(inv.finalAmountPayable || 0);
      }, 0);

      return {
        trackCount,
        artistCount,
        upcomingCount,
        totalEarnings: Number(totalEarnings.toFixed(2)),
      };
    } catch (err) {
      ctx.throw(500, err);
    }
  },

  // Count for logged-in user
  async countMe(ctx) {
    try {
      const user = ctx.state.user;
      if (!user) return ctx.unauthorized("You must be logged in");

      // 1. Published tracks count
      const trackCount = await strapi.db
        .query("api::distribute-track.distribute-track")
        .count({
          where: {
            publishedAt: { $notNull: true },
            $or: [
              { DraftRelease: { UserDetail: user.id } },
              { PublishedRelease: { UserDetail: user.id } },
            ],
          },
        });

      // 2. Artist count
      const artistCount = await strapi.db
        .query("api::artist-detail.artist-detail")
        .count({
          where: { owner: user.id },
        });

      // 3. Upcoming releases (only today and future)
      const today = new Date().toISOString().split("T")[0];

      const upcomingReleases = await strapi.entityService.findMany(
        "api::publish-distribute.publish-distribute",
        {
          filters: {
            UserDetail: user.id,
            releaseDate: { $gte: today },
          },
          populate: { TrackList: true },
        }
      );

      const upcomingCount = upcomingReleases.length;

      return { trackCount, artistCount, upcomingCount };
    } catch (err) {
      ctx.throw(500, err);
    }
  },

  // POST /api/email-exists  { email: "someone@example.com" }
  async checkEmailExistsPost(ctx) {
    try {
      const raw = ctx.request.body?.email;
      if (!raw || typeof raw !== "string") {
        return ctx.badRequest('Body field "email" is required');
      }

      const email = raw.trim().toLowerCase();

      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!isEmail.test(email)) {
        return ctx.badRequest("Invalid email");
      }

      const users = await strapi.entityService.findMany(
        "plugin::users-permissions.user",
        { filters: { email }, fields: ["id"], limit: 1 }
      );

      ctx.body = { exists: users.length > 0 };
    } catch (err) {
      strapi.log.error("checkEmailExistsPost error:", err);
      ctx.internalServerError("Internal error");
    }
  },

  async getAllWithCounts(ctx) {
    try {
      const { search } = ctx.query;

      // ✅ Base filter (Client users)
      const filters = {
        role: {
          name: "Client",
        },
      };

      // ✅ Search filter (ONLY if provided)
      if (search && search.trim() !== "") {
        filters.$or = [
          { firstName: { $containsi: search.trim() } },
          { lastName: { $containsi: search.trim() } },
          { email: { $containsi: search.trim() } },
        ];
      }

      // ✅ Fetch users with ALL schema relations
      const users = await strapi.db
        .query("plugin::users-permissions.user")
        .findMany({
          where: filters,
          select: [
            "id",
            "firstName",
            "lastName",
            "email",
            "blocked",
            "createdAt",
          ],
          populate: {
            Profile_image: true,
            role: {
              select: ["id", "name", "description", "type"],
            },
          },
          orderBy: {
            id: "desc",
          },
        });

      // ✅ Add counts (no structure change)
      const result = await Promise.all(
        users.map(async (user) => {
          const [
            artistDetailsCount,
            distributeDraftsCount,
            latestSubscription,
          ] = await Promise.all([
            strapi.db.query("api::artist-detail.artist-detail").count({
              where: { owner: user.id },
            }),
            strapi.db
              .query("api::publish-distribute.publish-distribute")
              .count({
                where: { UserDetail: user.id },
              }),
            strapi.db
              .query("api::user-subscription.user-subscription")
              .findOne({
                where: {
                  users_permissions_user: user.id,
                },
                populate: {
                  plan: true,
                },
                orderBy: {
                  createdAt: "desc",
                },
              }),
          ]);

          return {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            blocked: user.blocked,
            createdAt: user.createdAt,
            Profile_image: user.Profile_image,
            role: user.role,
            artist_details_count: artistDetailsCount,
            distribute_drafts_count: distributeDraftsCount,
            latest_subscription: latestSubscription,
          };
        })
      );
      result.sort((a, b) => b.id - a.id);
      ctx.send(result);
    } catch (err) {
      ctx.throw(500, err);
    }
  },

  async getOneWithCounts(ctx) {
    try {
      const { id } = ctx.params; // Get user ID from URL params

      // Fetch the user with role = Client and populate profile image
      const user = await strapi.db
        .query("plugin::users-permissions.user")
        .findOne({
          where: {
            id: id,
            role: {
              name: "Client",
            },
          },
          populate: {
            Profile_image: true,
          },
        });

      if (!user) {
        return ctx.notFound("User not found or not a Client");
      }

      // Get counts for related records
      const artistDetailsCount = await strapi.db
        .query("api::artist-detail.artist-detail")
        .count({
          where: { owner: user.id },
        });

      const distributeDraftsCount = await strapi.db
        .query("api::publish-distribute.publish-distribute")
        .count({
          where: { UserDetail: user.id },
        });

      const result = {
        ...user,
        artist_details_count: artistDetailsCount,
        distribute_drafts_count: distributeDraftsCount,
      };

      ctx.send(result);
    } catch (err) {
      ctx.throw(500, err);
    }
  },
  async findByUser(ctx) {
    try {
      // Get user ID from params or logged-in user
      const userId = ctx.params.userId || ctx.state.user?.id;

      if (!userId) {
        return ctx.badRequest("User ID is required");
      }

      // Fetch publish_distributes for this user
      const entries = await strapi.entityService.findMany(
        "api::publish-distribute.publish-distribute",
        {
          filters: { UserDetail: userId },
          populate: {
            TrackList: true, // populate TrackList relation
            CoverArt: true, // populate CoverArt media
          },
          sort: { createdAt: "desc" },
        }
      );

      return ctx.send({ data: entries });
    } catch (err) {
      strapi.log.error("findByUser error:", err);
      return ctx.internalServerError("Failed to fetch publish distributes");
    }
  },
  async findMy(ctx) {
    try {
      const user = ctx.state.user; // currently logged-in user
      if (!user) {
        return ctx.unauthorized("Authentication required");
      }

      const entries = await strapi.entityService.findMany(
        "api::publish-distribute.publish-distribute",
        {
          filters: { UserDetail: user.id },
          populate: {
            TrackList: true,
            CoverArt: true,
          },
          sort: { createdAt: "desc" }, // ✅ latest first
        }
      );

      // Add a safe TrackList count on each entry
      const transformed = entries.map((entry) => {
        let trackList = entry.TrackList;
        if (!Array.isArray(trackList) && trackList?.data) {
          trackList = trackList.data;
        }
        const trackCount = Array.isArray(trackList) ? trackList.length : 0;

        return {
          ...entry,
          trackCount,
        };
      });

      return ctx.send({ data: transformed });
    } catch (err) {
      strapi.log.error("findMy error:", err);
      return ctx.internalServerError(
        "Failed to fetch your publish distributes"
      );
    }
  },
  async getPublishedTrackCount(ctx) {
    try {
      const [
        publishedTrackCount,
        clientCount,
        publishedReleaseCount,
        importedReports,
      ] = await Promise.all([
        // ✅ Published tracks
        strapi.db.query("api::distribute-track.distribute-track").count({
          where: {
            PublishedRelease: {
              id: { $notNull: true },
            },
          },
        }),

        // ✅ Clients
        strapi.db.query("plugin::users-permissions.user").count({
          where: {
            role: {
              name: "Client",
            },
          },
        }),

        // ✅ Published releases
        strapi.db.query("api::publish-distribute.publish-distribute").count({
          publicationState: "live",
        }),

        // ✅ Imported reports (use totalNet)
        strapi.db.query("api::imported-report.imported-report").findMany({
          select: ["totalNet"],
        }),
      ]);

      // ✅ Calculate total earnings
      const totalEarnings = importedReports.reduce((sum, item) => {
        return sum + (Number(item.totalNet) || 0);
      }, 0);

      ctx.send({
        publishedTrackCount,
        clientCount,
        publishedReleaseCount,
        totalEarnings,
      });
    } catch (err) {
      ctx.throw(500, err);
    }
  },
  async getOnlyPriority(ctx) {
    try {
      const results = await strapi.db
        .query("api::publish-distribute.publish-distribute")
        .findMany({
          where: { Priority: "Priority" },
          select: [
            "ReleaseTitle",
            "ReleaseType",
            "DigitalReleaseDate",
            "ReleaseTime",
            "Status",
            "AddLabel", // ✅ AddLabel field
          ],
          populate: {
            UserDetail: {
              // or artist if you have a separate artist relation
              select: ["username", "email"], // adjust as needed
            },
            CoverArt: {
              fields: ["url", "alternativeText", "caption"], // ✅ populate image
            },
          },
        });

      ctx.body = results;
    } catch (error) {
      ctx.throw(500, error);
    }
  },

  async getOnlyStandard(ctx) {
    try {
      const results = await strapi.db
        .query("api::publish-distribute.publish-distribute")
        .findMany({
          where: { Priority: "Standard" },
          select: [
            "ReleaseTitle",
            "ReleaseType",
            "DigitalReleaseDate",
            "ReleaseTime",
            "Status",
            "AddLabel", // ✅ AddLabel field
          ],
          populate: {
            UserDetail: {
              // or artist if you have a separate artist relation
              select: ["username", "email"], // adjust as needed
            },
            CoverArt: {
              fields: ["url", "alternativeText", "caption"], // ✅ populate image
            },
          },
        });

      ctx.body = results;
    } catch (error) {
      ctx.throw(500, error);
    }
  },

  async updateMe(ctx) {
    const { id } = ctx.state.user || {};
    if (!id) return ctx.unauthorized("You must be logged in");

    try {
      const data = ctx.request.body;

      // Update with entityService (supports relations like Profile_image)
      await strapi.entityService.update("plugin::users-permissions.user", id, {
        data: {
          ...(data.currency && { currency: data.currency }),
          ...(data.dob && { dob: data.dob }),
          ...(data.firstName && { firstName: data.firstName }),
          ...(data.lastName && { lastName: data.lastName }),
          ...(data.phoneNumber && { phoneNumber: data.phoneNumber }),
          ...(data.Profile_image && { Profile_image: data.Profile_image }), // link existing media
        },
      });

      // Fetch again with populate
      const updatedUser = await strapi.entityService.findOne(
        "plugin::users-permissions.user",
        id,
        {
          populate: ["Profile_image"],
        }
      );

      return {
        message: "Profile updated successfully",
        user: updatedUser,
      };
    } catch (error) {
      throw new ApplicationError("Error updating profile", { error });
    }
  },
  // path: src/api/distribute-draft/controllers/distribute-draft.j
  async publishDraft(ctx) {
    try {
      const { id } = ctx.params;
      if (!id) return ctx.badRequest("Draft ID is required");

      // 1. Fetch draft with relations
      const draft = await strapi.db
        .query("api::distribute-draft.distribute-draft")
        .findOne({
          where: { id },
          populate: {
            CoverArt: true,
            UserDetail: true,
            TrackList: {
              populate: {
                artistDetails: true, // adjust if your relation key is different
              },
            },
          },
        });

      if (!draft) return ctx.notFound("Draft not found");

      // 2. Create new PublishDistribute from draft
      const publishData = { ...draft };
      delete publishData.id; // remove draft ID
      delete publishData.createdAt;
      delete publishData.updatedAt;
      delete publishData.publishedAt;

      const newPublish = await strapi.db
        .query("api::publish-distribute.publish-distribute")
        .create({
          data: {
            ...publishData,
            publishedAt: new Date(),
            UserDetail: draft.UserDetail?.id,
          },
        });

      // 3. Handle TrackList
      for (const track of draft.TrackList || []) {
        // publish track & link to new PublishDistribute
        await strapi.db.query("api::distribute-track.distribute-track").update({
          where: { id: track.id },
          data: {
            publishedAt: new Date(),
            PublishedRelease: newPublish.id, // re-link track
          },
        });

        // publish artistDetails
        if (Array.isArray(track.artistDetails)) {
          for (const artist of track.artistDetails) {
            await strapi.db.query("api::artist-detail.artist-detail").update({
              where: { id: artist.id },
              data: { publishedAt: new Date() },
            });
          }
        } else if (track.artistDetails) {
          await strapi.db.query("api::artist-detail.artist-detail").update({
            where: { id: track.artistDetails.id },
            data: { publishedAt: new Date() },
          });
        }
      }

      // 4. Delete original draft after successful publish
      await strapi.db.query("api::distribute-draft.distribute-draft").delete({
        where: { id },
      });

      return ctx.send({
        success: true,
        message:
          "Draft moved to PublishDistribute successfully and original draft deleted",
        publishId: newPublish.id,
      });
    } catch (err) {
      strapi.log.error("Error publishing draft:", err);
      return ctx.internalServerError("Failed to publish draft");
    }
  },
  async findMyCal(ctx) {
    try {
      const user = ctx.state.user; // currently logged-in user
      if (!user) {
        return ctx.unauthorized("Authentication required");
      }

      const entries = await strapi.entityService.findMany(
        "api::publish-distribute.publish-distribute",
        {
          filters: { UserDetail: user.id },
          populate: {
            TrackList: true, // populate tracks
          },
          sort: { createdAt: "desc" },
        }
      );

      // Transform data to only include required fields
      const transformed = entries.map((entry) => {
        let trackList = entry.TrackList;

        // Handle relation shapes (array or { data: [] })
        if (!Array.isArray(trackList) && trackList?.data) {
          trackList = trackList.data;
        }

        // Extract track names using correct field
        const trackNames = Array.isArray(trackList)
          ? trackList.map((track) => track.TrackName) // Correct field
          : [];

        let start = null;
        let end = null;

        if (entry.OriginalReleaseDate && entry.ReleaseTime) {
          start = new Date(`${entry.OriginalReleaseDate}T${entry.ReleaseTime}`);
          end = new Date(start.getTime() + 30 * 60000); // add 30 minutes
        }

        return {
          start,
          end,
          ReleaseDate: entry.OriginalReleaseDate,
          ReleaseTime: entry.ReleaseTime,
          Status: entry.Status,
          ReleaseType: entry.ReleaseType,
          ReleaseTitle: entry.ReleaseTitle,
          Tracks: trackNames,
        };
      });

      return ctx.send({ data: transformed });
    } catch (err) {
      strapi.log.error("findMyCal error:", err);
      return ctx.internalServerError(
        "Failed to fetch your publish distributes"
      );
    }
  },
};
