"use strict";

const { createCoreController } = require("@strapi/strapi").factories;
const createUserActivityLog = require("../../../utils/user-activity-log");

const POPULATE = {
  CoverArt: true,
  TrackList: { populate: { TrackUpload: true, RoleCredits: true } },
  UserDetail: true,
};

module.exports = createCoreController(
  "api::publish-distribute.publish-distribute",
  ({ strapi }) => ({
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

    // async find(ctx) {
    //   const { q, priority } = ctx.query;

    //   const filters = {};

    //   if (q && q.trim() !== "") {
    //     filters.ReleaseTitle = { $containsi: q };
    //   }

    //   if (priority) {
    //     filters.Priority = priority;
    //   }

    //   ctx.query.filters = {
    //     ...(ctx.query.filters || {}),
    //     ...filters,
    //   };

    //   ctx.query.populate = POPULATE;
    //   ctx.query.sort = ctx.query.sort || ["id:desc"];

    //   // ✅ Get all data without pagination
    //   ctx.query.pagination = undefined;
    //   ctx.query.limit = -1;
    //   ctx.query.start = 0;

    //   const { data } = await super.find(ctx);
    //   return {
    //     data,
    //     message: "Data fetched successfully",
    //     success: true,
    //     totalItems: data.length,
    //   };
    // },
    async find(ctx) {
      const { q, priority } = ctx.query;

      const filters = {};

      if (q?.trim()) {
        filters.ReleaseTitle = {
          $containsi: q,
        };
      }

      if (priority) {
        filters.Priority = priority;
      }

      const data = await strapi.entityService.findMany(
        "api::publish-distribute.publish-distribute",
        {
          filters,
          populate: POPULATE,
          sort: { id: "DESC" },
          limit: -1, // all records
        }
      );

      return {
        data,
        success: true,
        message: "Data fetched successfully",
        totalItems: data.length,
      };
    },

    async findOne(ctx) {
      try {
        const { id } = ctx.params;

        // Logged in user from JWT token
        const user = ctx.state.user;

        if (!user) {
          return ctx.unauthorized("Authentication required");
        }

        const entity = await strapi.entityService.findOne(
          "api::publish-distribute.publish-distribute",
          id,
          {
            populate: {
              TrackList: {
                populate: {
                  PublishedRelease: true,
                  TrackUpload: true,
                },
              },
              UserDetail: true,
              CoverArt: true,
            },
            publicationState: "preview",
          }
        );

        if (!entity) {
          return ctx.notFound("Published release not found");
        }

        // Authenticated role can access all releases
        const userWithRole = await strapi.entityService.findOne(
          "plugin::users-permissions.user",
          user.id,
          {
            populate: {
              role: true,
            },
          }
        );

        const roleName = userWithRole?.role?.name;

        // Only Client users are restricted to their own releases
        if (
          roleName === "Client" &&
          (!entity.UserDetail || entity.UserDetail.id !== user.id)
        ) {
          return ctx.send({
            data: {
              message: "You are not allowed to access this release",
              success: false,
            },
            status: "error",
            statusCode: 403,
          });
        }

        return {
          data: entity,
        };
      } catch (error) {
        console.error("FindOne Error:", error);
        return ctx.internalServerError("Something went wrong");
      }
    },

    async getOnlyPriority(ctx) {
      try {
        const results = await strapi.db
          .query("api::publish-distribute.publish-distribute")
          .findMany({
            where: { Priority: "Priority" },
            select: ["id", "ReleaseTitle", "Priority"], // return only useful fields
          });

        ctx.body = results;
      } catch (error) {
        ctx.throw(500, error);
      }
    },

    async create(ctx) {
      const res = await super.create(ctx);
      return await this.findOne({ params: { id: res.data.id } });
    },

    async update(ctx) {
      const res = await super.update(ctx);
      return await this.findOne({ params: { id: res.data.id } });
    },

    async delete(ctx) {
      const { id } = ctx.params;
      if (!id) return ctx.badRequest("id is required");
      const deleted = await strapi.entityService.delete(
        "api::publish-distribute.publish-distribute",
        id
      );
      ctx.body = { data: deleted };
    },

    /**
     * ONE-CLICK: create published release from a draft, reusing media & tracks without duplication.
     * Steps:
     * 1) Read draft with TrackList (DraftRelease)
     * 2) Create publish entity copying draft fields (no file duplication)
     * 3) Move tracks: set PublishedRelease = new publish id; set DraftRelease = null
     * 4) Optionally: archive the draft (unpublish or delete)
     */

    async publishFromDraft(ctx) {
      try {
        const draftId = ctx.params.id || ctx.request.query.id;
        if (!draftId) {
          return ctx.badRequest("Draft ID is required");
        }

        const userId = ctx.state.user?.id;
        const draftIdNum = Number(draftId);

        const draft = await strapi.entityService.findOne(
          "api::distribute-draft.distribute-draft",
          draftId,
          {
            populate: [
              "CoverArt",
              "TrackList",
              "TrackList.PrimaryArtist",
              "UserDetail",
            ],
          }
        );

        if (!draft) return ctx.notFound("Draft not found");

        // ✅ 1. OWNERSHIP CHECK
        if (draft?.UserDetail?.id !== userId) {
          return ctx.unauthorized("Not your draft");
        }

        // ✅ 2. PAYMENT CHECK (ONLY FOR PRIORITY)
        let payment = null;

        if (draft.Priority === "Priority") {
          payment = await strapi.db
            .query("api::payment-log.payment-log")
            .findOne({
              where: {
                users_permissions_user: userId,
                draftId: draftIdNum,
                type: "priority-upload",
                status: "success",
              },
            });

          if (!payment) {
            return ctx.badRequest("Please complete priority payment first");
          }
        }

        const {
          id,
          createdAt,
          updatedAt,
          publishedAt,
          CoverArt,
          TrackList,
          UserDetail,
          ...draftData
        } = draft;

        const trackIds = TrackList?.map((t) => t.id) || [];

        const artistIds =
          TrackList?.map((t) => t.PrimaryArtist?.id).filter(Boolean) || [];

        const publishData = {
          ...draftData,
          draftId: draftIdNum,
          UserDetail: userId,
          CoverArt: CoverArt ? CoverArt.id : null,
          TrackList: trackIds,
          ArtistDetails: artistIds,
          priorityUpload: draft.Priority === "Priority",
          publishedAt: new Date(),
        };

        // ✅ DUPLICATE CHECK
        const existingAgain = await strapi.db
          .query("api::publish-distribute.publish-distribute")
          .findOne({
            where: {
              draftId: draftIdNum,
            },
          });

        if (existingAgain) {
          return ctx.send({ data: existingAgain });
        }

        // ✅ CREATE PUBLISH ENTRY
        let publishEntry;

        try {
          publishEntry = await strapi.entityService.create(
            "api::publish-distribute.publish-distribute",
            { data: publishData }
          );
        } catch (err) {
          const existing = await strapi.db
            .query("api::publish-distribute.publish-distribute")
            .findOne({
              where: {
                draftId: draftIdNum,
              },
            });

          if (existing) {
            return ctx.send({ data: existing });
          }

          throw err;
        }

        // ✅ UPDATE PAYMENT LOG (ONLY IF EXISTS)
        if (payment && !payment.publish_distribute) {
          await strapi.entityService.update(
            "api::payment-log.payment-log",
            payment.id,
            {
              data: {
                publish_distribute: publishEntry.id,
              },
            }
          );
        }

        return ctx.send({ data: publishEntry });
      } catch (err) {
        strapi.log.error(err);
        return ctx.internalServerError("Failed to publish draft");
      }
    },

    async updateRelease(ctx) {
      try {
        const { id } = ctx.params;
        const userId = ctx.state.user && ctx.state.user.id;
        const payload =
          (ctx.request.body && (ctx.request.body.data || ctx.request.body)) ||
          {};

        if (!id) return ctx.badRequest("Publish ID required");

        // ================================
        // 1️⃣ FETCH OLD DATA
        // ================================
        const existing = await strapi.entityService.findOne(
          "api::publish-distribute.publish-distribute",
          id,
          { populate: ["TrackList"] }
        );

        if (!existing) return ctx.notFound("Release not found");

        const releaseType = existing.ReleaseType
          ? existing.ReleaseType.toLowerCase()
          : null;

        const isGenreChanged =
          payload.PrimaryGenre !== undefined ||
          payload.SecondaryGenre !== undefined;

        const changes = {};

        // ================================
        // 2️⃣ UPDATE RELEASE FIELDS
        // ================================
        const fields = [
          "CopyrightholderName",
          "DigitalReleaseDate",
          "ReleaseTime",
          "PhonogramRightsHolderName",
          "MusicStores",
          "OriginalReleaseDate",
          "AddLabel",
          "PrimaryGenre",
          "SecondaryGenre",
          "PhonogramRightsHolderYear",
          "CopyrightYear",
          "Countries",
          "ReleaseTitle",
        ];

        const updateData = {};

        fields.forEach((field) => {
          if (payload[field] !== undefined) {
            updateData[field] = payload[field];

            if (
              JSON.stringify(existing[field]) !== JSON.stringify(payload[field])
            ) {
              changes[field] = {
                old: existing[field],
                new: payload[field],
              };
            }
          }
        });

        await strapi.entityService.update(
          "api::publish-distribute.publish-distribute",
          id,
          { data: updateData }
        );

        // ================================
        // 🔥 AUTO SYNC (SINGLE)
        // ================================
        if (releaseType === "single" && isGenreChanged) {
          const allTracks = existing.TrackList || [];

          for (const t of allTracks) {
            await strapi.entityService.update(
              "api::distribute-track.distribute-track",
              t.id,
              {
                data: {
                  PrimaryGenre:
                    updateData.PrimaryGenre !== undefined
                      ? updateData.PrimaryGenre
                      : existing.PrimaryGenre,

                  SecondaryGenre:
                    updateData.SecondaryGenre !== undefined
                      ? updateData.SecondaryGenre
                      : existing.SecondaryGenre,
                },
              }
            );
          }
        }

        // ================================
        // 3️⃣ UPDATE TRACKS
        // ================================
        if (Array.isArray(payload.tracks)) {
          for (const track of payload.tracks) {
            const existingTrack = await strapi.entityService.findOne(
              "api::distribute-track.distribute-track",
              track.id,
              { populate: ["artistDetails"] }
            );

            if (!existingTrack) continue;

            // ---------- ROLE MERGE ----------
            let mergedCredits = existingTrack.RoleCredits || [];

            if (Array.isArray(track.RoleCredits) && track.RoleCredits.length) {
              const creditMap = new Map();

              mergedCredits.forEach((c) => {
                if (c && c.roleName) creditMap.set(c.roleName, c);
              });

              track.RoleCredits.forEach((c) => {
                if (c && c.roleName) creditMap.set(c.roleName, c);
              });

              mergedCredits = Array.from(creditMap.values());
            }

            // ---------- ARTIST HANDLING ----------
            let artistIds = [];

            for (let credit of mergedCredits) {
              let roleName = credit && credit.roleName;
              let artistName = credit && credit.artistName;

              if (!artistName) continue;

              artistName = artistName.trim().toLowerCase();

              const existingArtist = await strapi.entityService.findMany(
                "api::artist-detail.artist-detail",
                {
                  filters: {
                    artistName,
                    owner: userId,
                  },
                  limit: 1,
                }
              );

              let artist;

              if (existingArtist.length) {
                artist = existingArtist[0];
              } else {
                artist = await strapi.entityService.create(
                  "api::artist-detail.artist-detail",
                  {
                    data: {
                      artistName,
                      roleName: roleName || null,
                      searchRole: roleName
                        ? roleName + "_detail"
                        : "artist_detail",
                      owner: userId,
                      publishedAt: new Date(),
                    },
                  }
                );
              }

              if (artist && artist.id) artistIds.push(artist.id);
            }

            artistIds = Array.from(new Set(artistIds));

            // ---------- TRACK NAME ----------
            const newTrackName = track.TrackName || existingTrack.TrackName;

            if (existingTrack.TrackName !== newTrackName) {
              changes["Track_" + track.id + "_name"] = {
                old: existingTrack.TrackName,
                new: newTrackName,
              };
            }

            if (
              JSON.stringify(existingTrack.RoleCredits) !==
              JSON.stringify(mergedCredits)
            ) {
              changes["Track_" + track.id + "_roles"] = {
                old: existingTrack.RoleCredits,
                new: mergedCredits,
              };
            }

            // ---------- GENRE ----------
            let primaryGenre = existingTrack.PrimaryGenre;
            let secondaryGenre = existingTrack.SecondaryGenre;

            if (releaseType !== "single") {
              if (track.PrimaryGenre !== undefined) {
                primaryGenre = track.PrimaryGenre;

                if (existingTrack.PrimaryGenre !== primaryGenre) {
                  changes["Track_" + track.id + "_primaryGenre"] = {
                    old: existingTrack.PrimaryGenre,
                    new: primaryGenre,
                  };
                }
              }

              if (track.SecondaryGenre !== undefined) {
                secondaryGenre = track.SecondaryGenre;

                if (existingTrack.SecondaryGenre !== secondaryGenre) {
                  changes["Track_" + track.id + "_secondaryGenre"] = {
                    old: existingTrack.SecondaryGenre,
                    new: secondaryGenre,
                  };
                }
              }
            } else {
              primaryGenre =
                updateData.PrimaryGenre !== undefined
                  ? updateData.PrimaryGenre
                  : existing.PrimaryGenre;

              secondaryGenre =
                updateData.SecondaryGenre !== undefined
                  ? updateData.SecondaryGenre
                  : existing.SecondaryGenre;
            }

            // ---------- UPDATE TRACK ----------
            await strapi.entityService.update(
              "api::distribute-track.distribute-track",
              track.id,
              {
                data: {
                  TrackName: newTrackName,
                  RoleCredits: mergedCredits,
                  artistDetails: artistIds,
                  PrimaryGenre: primaryGenre,
                  SecondaryGenre: secondaryGenre,
                },
              }
            );
          }
        }

        // ================================
        // 4️⃣ SAVE CHANGE LOG
        // ================================
        if (Object.keys(changes).length) {
          await strapi.entityService.create(
            "api::published-track-update-log.published-track-update-log",
            {
              data: {
                publish_distribute: id,
                users_permissions_user: userId,
                changes,
              },
            }
          );

          await createUserActivityLog({
            userId,
            action: "Release Updated",
            description: `${existing.ReleaseTitle} updated. Changed fields: ${Object.keys(
              changes
            ).join(", ")}`,
          });

        }





        // ================================
        // 5️⃣ FINAL DATA
        // ================================
        const finalData = await strapi.entityService.findOne(
          "api::publish-distribute.publish-distribute",
          id,
          {
            populate: {
              TrackList: {
                populate: ["artistDetails"],
              },
            },
          }
        );

        return ctx.send({
          message: "Updated successfully",
          data: finalData,
        });
      } catch (err) {
        strapi.log.error(err);
        return ctx.internalServerError("Update failed");
      }
    },
  })
);
