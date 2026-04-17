'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const OWNER_FIELD = 'UserDetail';

function parseUserRef(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const m = v.match(/(?:plugin::users-permissions\.user\/|users-permissions\.user\/)?(\d+)$/);
    if (m) return Number(m[1]);
    if (/^\d+$/.test(v)) return Number(v);
  }
  return null;
}

const DEFAULT_POPULATE = {
  UserDetail: { fields: ['id', 'username', 'email'] },
  CoverArt: true,
  TrackList: { populate: { TrackUpload: true, RoleCredits: true } }, // mappedBy: DraftRelease
};

// change CompletedSteps helper
const autoUpdateCompletedSteps = async (id) => {
  const uid = 'api::distribute-draft.distribute-draft';

  const draft = await strapi.entityService.findOne(uid, id, {
    populate: ['TrackList', 'CoverArt'],
  });

  let step = null;

  if (draft.publishedAt) {
    step = 'done';
  } else if (draft.DigitalReleaseDate || draft.Countries || draft.MusicStores) {
    step = 'step_4';
  } else if (draft.TrackList && draft.TrackList.length > 0) {
    step = 'step_3';
  } else if (draft.CoverArt) {
    step = 'step_2';
  } else if (draft.ReleaseType && draft.ReleaseTitle) {
    step = 'step_1';
  }

  await strapi.entityService.update(uid, id, {
    data: {
      CompletedSteps: step,
    },
  });
};



// helper to find artist allowed according to latest subscription
const checkPrimaryArtistLimit = async (userId, incomingTracks = []) => {

  // 1. Get latest active subscription
  const subscription = await strapi.db
    .query("api::user-subscription.user-subscription")
    .findOne({
      where: {
        users_permissions_user: userId,
        status: "active",
      },
      orderBy: { startDate: "desc" },
      populate: ["plan"],
    });

  if (!subscription || !subscription.plan) {
    throw new Error("No active subscription found");
  }

  // 2. Get plan limit (STRING)
  const rawLimit = subscription.plan.maxPrimaryArtists?.trim().toLowerCase();

  // ✅ UNLIMITED → skip
  if (!rawLimit || rawLimit === "unlimited") {
    return;
  }

  const allowedLimit = Number(rawLimit);

  if (isNaN(allowedLimit)) {
    throw new Error("Invalid maxPrimaryArtists value in plan");
  }

  // 3. Get existing UNIQUE primary artists
  const existingArtists = await strapi.db
    .query("api::artist-detail.artist-detail")
    .findMany({
      where: {
        owner: userId,
        roleName: "Primary Artist",
      },
      select: ["artistName"],
    });

  const existingSet = new Set(
    existingArtists.map(a => a.artistName.toLowerCase())
  );

  // 4. Extract NEW artists from request
  const newSet = new Set();

  incomingTracks.forEach(track => {
    track?.RoleCredits?.forEach(credit => {
      if (
        credit?.roleName === "Primary Artist" &&
        credit?.artistName
      ) {
        newSet.add(credit.artistName.toLowerCase());
      }
    });
  });

  let newUniqueCount = 0;

  newSet.forEach(name => {
    if (!existingSet.has(name)) {
      newUniqueCount++;
    }
  });

  const totalAfterUpload = existingSet.size + newUniqueCount;

  // 5. Final check
  if (totalAfterUpload > allowedLimit) {
    const message =
  allowedLimit === 1
    ? `Your plan allows only 1 primary artist. Please upgrade your subscription.`
    : `According to your subscription only ${allowedLimit} primary artists are allowed. Please upgrade your subscription.`;

const error = new Error(message);
error.status = 400;
throw error;
  }
};

module.exports = createCoreController('api::distribute-draft.distribute-draft', ({ strapi }) => ({

  /* ----------------------- CRUD ----------------------- */
  async find(ctx) {
    ctx.query = { ...ctx.query, populate: DEFAULT_POPULATE, sort: ctx.query.sort || ['id:desc'], };
    const { data, meta } = await super.find(ctx);
    return { data, meta };
  },


  async findDrafts(ctx) {
    const q = ctx.query || {};

    if (!ctx.state?.user?.id) {
      return ctx.unauthorized('Authentication required');
    }

    const userId = ctx.state.user.id;

    const filters = {
      ...(q.filters || {}),
      publishedAt: { $null: true },       // drafts only
      userDetail: { $eq: userId },        // ✅ correct relation filter
    };

    ctx.query = {
      ...q,
      publicationState: 'preview',
      filters,
      populate: q.populate ?? DEFAULT_POPULATE,
    };

    const { data, meta } = await super.find(ctx);
    ctx.body = { data, meta };
  },
  async getStartedDraftsByUser(ctx) {
    try {
      const { userId } = ctx.params;

      if (!userId) {
        return ctx.badRequest("Missing userId param");
      }

      const drafts = await strapi.db
        .query("api::distribute-draft.distribute-draft")
        .findMany({
          where: {
            UserDetail: userId,
            publishedAt: null, // not published yet (draft)
          },
          populate: ["CoverArt", "TrackList"],
          orderBy: { createdAt: "desc" }, // ✅ latest first
        });

      return ctx.send({ data: drafts });
    } catch (err) {
      strapi.log.error("getStartedDraftsByUser error", err);
      return ctx.internalServerError("Something went wrong");
    }
  },

  async findDraftsByUserId(ctx) {
    const userId = Number(ctx.params.userId);
    if (!Number.isFinite(userId)) return ctx.badRequest('Invalid userId');

    const q = ctx.query || {};
    const filters = {
      ...(q.filters || {}),
      publishedAt: { $null: true },
      [OWNER_FIELD]: { id: { $eq: userId } },
    };

    ctx.query = {
      ...q,
      publicationState: 'preview',
      filters,
      populate: q.populate ?? DEFAULT_POPULATE,
    };

    const { data, meta } = await super.find(ctx);
    ctx.body = { data, meta };
  },

  /* ------------------ Step 1 Update ------------------ */
  async updateStep1(ctx) {
    if (!ctx.state?.user) return ctx.unauthorized('Authentication required');
    const { id } = ctx.params;
    const input = ctx.request.body?.data ?? ctx.request.body ?? {};

    const allow = new Set([
      'ReleaseType', 'ReleaseTitle', 'Version', 'LanguageOfTheTitles',
      'PrimaryGenre', 'SecondaryGenre', 'AddLabel',
      'CopyrightYear', 'CopyrightholderName',
      'PhonogramRightsHolderName', 'PhonogramRightsHolderYear',
      'RequestANewReferenceNumber',
    ]);

    const s = v => (v == null ? null : String(v).trim() || null);
    const toInt = v => (v == null || String(v).trim() === '' ? null : (Number.isFinite(Number(v)) ? Number(v) : null));

    const data = {};
    for (const k of allow) if (k in input) data[k] = input[k];

    ['ReleaseType', 'ReleaseTitle', 'Version', 'LanguageOfTheTitles', 'PrimaryGenre', 'SecondaryGenre', 'AddLabel', 'CopyrightholderName', 'PhonogramRightsHolderName']
      .forEach(k => { if (data[k] != null) data[k] = s(data[k]); });

    ['CopyrightYear', 'PhonogramRightsHolderYear']
      .forEach(k => { if (data[k] != null) data[k] = toInt(data[k]); });

    if (data.RequestANewReferenceNumber != null) data.RequestANewReferenceNumber = !!data.RequestANewReferenceNumber;

    const uid = 'api::distribute-draft.distribute-draft';
    const finalData = await enforceOwner(ctx, id, data);

    const updated = await strapi.entityService.update(uid, id, { data: finalData });
    const full = await strapi.entityService.findOne(uid, updated.id, { populate: ctx.query?.populate ?? DEFAULT_POPULATE });
    return this.transformResponse(full);
  },

  async findOne(ctx) {
    const { id } = ctx.params;
    const entity = await strapi.entityService.findOne('api::distribute-draft.distribute-draft', id, {
      populate: DEFAULT_POPULATE,
    });
    if (!entity) return ctx.notFound('Release not found');
    return { data: entity };
  },

  async create(ctx) {
    const body = ctx.request.body?.data || ctx.request.body || {};

    if (body?.AddLabel && ctx.state?.user) {
      try { await ensureUserLabel(strapi, ctx.state.user.id, body.AddLabel); }
      catch (e) { strapi.log.warn('ensureUserLabel (create) failed: ' + e.message); }
    }

    let data = {
      ...body,
      WizardStep: body.WizardStep || 'STEP_1',
      CompletedSteps: Array.isArray(body.CompletedSteps) ? body.CompletedSteps : [],
      publishedAt: null,
    };

    data = await enforceOwner(ctx, null, data);

    ctx.request.body = { data };
    const res = await super.create(ctx);
    return await this.findOne({ params: { id: res.data.id } });
  },

  async update(ctx) {
    const body = ctx.request.body?.data || ctx.request.body || {};

    // 1) Ensure user label exists
    if (body?.AddLabel && ctx.state?.user) {
      try {
        await ensureUserLabel(strapi, ctx.state.user.id, body.AddLabel);
      } catch (e) {
        strapi.log.warn('ensureUserLabel (update) failed: ' + e.message);
      }
    }

    // 2) Perform the update
    const res = await super.update(ctx);

    // 3) Auto-create artist_details for specific roles
    try {
      const rolesToAutoSave = ["Primary Artist", "Lyricist", "Vocals", "Composer"];

      // Check if update payload includes tracks
      if (Array.isArray(body.tracks)) {
        for (const track of body.tracks) {
          if (!track.RoleCredits || !Array.isArray(track.RoleCredits)) continue;

          for (const credit of track.RoleCredits) {
            const { roleName, artistName } = credit;
            if (!rolesToAutoSave.includes(roleName)) continue;

            // Avoid duplicates
            const existing = await strapi.entityService.findMany("api::artist-detail.artist-detail", {
              filters: { artistName, roleName },
            });

            if (!existing.length) {
              await strapi.entityService.create("api::artist-detail.artist-detail", {
                data: {
                  artistName,
                  roleName,
                  searchRole: `${roleName}_detail`,
                  owner: ctx.state.user?.id || null,
                },
              });
            }
          }
        }
      }
    } catch (e) {
      strapi.log.error("Auto-create artist_details (update) failed: " + e.message);
    }

    // 4) Return fresh entity
    return await this.findOne({ params: { id: res.data.id } });
  },

  async delete(ctx) {
    const { id } = ctx.params;
    if (!id) return ctx.badRequest('Draft id is required.');
    const deleted = await strapi.entityService.delete('api::distribute-draft.distribute-draft', id);
    ctx.body = { data: deleted };
  },

  async bulkDelete(ctx) {
    const body = ctx.request.body?.data || ctx.request.body || {};
    const ids = Array.isArray(body.ids) ? body.ids : [];
    if (!ids.length) return ctx.badRequest('Provide "ids": [ ... ] to delete.');

    const trx = await strapi.db.connection.transaction();
    try {
      const results = [];
      for (const id of ids) {
        const res = await strapi.query('api::distribute-draft.distribute-draft').delete({ where: { id }, transacting: trx });
        results.push(res);
      }
      await trx.commit();
      ctx.body = { data: results, count: results.length };
    } catch (err) {
      await trx.rollback();
      strapi.log.error('bulkDelete failed', err);
      return ctx.internalServerError('Bulk delete failed.');
    }
  },



  /* ------------------- WIZARD STEPS ------------------- */
  async step1(ctx) {
    if (!ctx.state?.user) return ctx.unauthorized('Authentication required');
    const payload = ctx.request.body?.data || ctx.request.body || {};
    const { id, ...raw } = payload;

    const s = v => (v == null ? null : String(v).trim() || null);
    const toInt = v => (v == null || String(v).trim() === '' ? null : (Number.isFinite(Number(v)) ? Number(v) : null));

    let data = {
      ReleaseType: s(raw.ReleaseType),
      ReleaseTitle: s(raw.ReleaseTitle),
      Version: s(raw.Version),
      LanguageOfTheTitles: s(raw.LanguageOfTheTitles),
      PrimaryGenre: s(raw.PrimaryGenre),
      SecondaryGenre: s(raw.SecondaryGenre),
      AddLabel: s(raw.AddLabel),
      CopyrightYear: toInt(raw.CopyrightYear),
      CopyrightholderName: s(raw.CopyrightholderName),
      PhonogramRightsHolderName: s(raw.PhonogramRightsHolderName),
      PhonogramRightsHolderYear: toInt(raw.PhonogramRightsHolderYear),
      RequestANewReferenceNumber: !!raw.RequestANewReferenceNumber,
    };

    if (!data.ReleaseType || !data.ReleaseTitle) return ctx.badRequest('ReleaseType and ReleaseTitle are required.');

    const uid = 'api::distribute-draft.distribute-draft';
    const populate = ctx.query?.populate ?? DEFAULT_POPULATE;

    data = await enforceOwner(ctx, id, data);

    const draft = id
      ? await strapi.entityService.update(uid, id, { data })
      : await strapi.entityService.create(uid, { data });

    await autoUpdateCompletedSteps(draft.id);

    const updatedFull = await strapi.entityService.findOne(uid, draft.id, { populate });

    return this.transformResponse(updatedFull);
  },

  async step2(ctx) {
    const { id } = ctx.params;
    if (!id) return ctx.badRequest('Draft id is required.');
    const payload = ctx.request.body?.data || ctx.request.body || {};
    const dataToSet = {};
    if (payload.CoverArt) dataToSet.CoverArt = payload.CoverArt;

    const draft = await strapi.entityService.update('api::distribute-draft.distribute-draft', id, { data: dataToSet, populate: DEFAULT_POPULATE });
    await autoUpdateCompletedSteps(id);

    const updated = await strapi.entityService.findOne(
      'api::distribute-draft.distribute-draft',
      id,
      { populate: DEFAULT_POPULATE }
    );

    ctx.body = { data: updated };
  },

  async step3(ctx) {
    const { id } = ctx.params;
    if (!id) return ctx.badRequest('Draft id is required.');
    const payload = ctx.request.body?.data || ctx.request.body || {};

    const userId = ctx.state.user.id;

    const incomingTracks = [
      ...(payload.tracks || []),
      ...(payload.trackObjects || [])
    ];

    // ✅ CHECK LIMIT BEFORE ANY CREATION
    await checkPrimaryArtistLimit(userId, incomingTracks);

    // Roles we want to auto-create as artist-detail
    const rolesToAutoSave = ["Primary Artist", "Lyricist", "Vocals", "Composer"];

    // 1) Link existing tracks by id to the DraftRelease
    if (Array.isArray(payload.trackIds) && payload.trackIds.length) {
      await Promise.all(
        payload.trackIds.map(trackId =>
          strapi.entityService.update('api::distribute-track.distribute-track', trackId, { data: { DraftRelease: id } })
        )
      );
    }

    // 2) Create new tracks (and attach to DraftRelease)
    let createdTracks = [];
    if (Array.isArray(payload.tracks) && payload.tracks.length) {
      createdTracks = await Promise.all(
        payload.tracks.map(track =>
          strapi.entityService.create('api::distribute-track.distribute-track', { data: { ...track, DraftRelease: id } })
        )
      );
    }

    // 3) Also handle case where payload includes full track objects in payload.trackObjects (optional)
    //    This lets you process RoleCredits for existing tracks if the client sends them.
    const providedTrackObjects = Array.isArray(payload.trackObjects) ? payload.trackObjects : [];

    // Combine newly created tracks + any provided track objects (only process ones that contain RoleCredits)
    const allTracksToProcess = [...createdTracks, ...providedTrackObjects];

    const existingList = await strapi.entityService.findMany(
      'api::artist-detail.artist-detail',
      {
        filters: { owner: ctx.state.user.id },
        fields: ['id', 'artistName'],
      }
    );

    for (const track of allTracksToProcess) {
      if (!track || !track.RoleCredits || !Array.isArray(track.RoleCredits)) continue;

      // collect artist-detail ids to add for this track
      const artistIdsToAdd = [];

      for (const credit of track.RoleCredits) {
        const { roleName, artistName } = credit || {};
        if (!artistName || !roleName) continue;
        if (!rolesToAutoSave.includes(roleName)) continue;

        // *** CHANGE: find existing artist-detail by artistName ONLY (ignore roleName) ***
        const normalizedName = artistName.trim().toLowerCase();

        // case-insensitive match
        const existing = existingList.find(
          a => a.artistName?.trim().toLowerCase() === normalizedName
        );

        let artistRecord;

        if (existing) {
          artistRecord = existing;
        } else {
          artistRecord = await strapi.entityService.create(
            'api::artist-detail.artist-detail',
            {
              data: {
                artistName,
                roleName: roleName || null,
                searchRole: roleName ? `${roleName}_detail` : 'artist_detail',
                owner: ctx.state.user?.id || null,
              },
            }
          );

          existingList.push({
            id: artistRecord.id,
            artistName: artistName,
          });

        }

        if (artistRecord?.id) {
            artistIdsToAdd.push(artistRecord.id);
          }
      }

      // If we got artist ids and track has an id, append them to the track relation (merge with existing)
      if (artistIdsToAdd.length && track.id) {
        // get existing relation ids for the track
        const existingTrack = await strapi.entityService.findOne('api::distribute-track.distribute-track', track.id, {
          populate: ['artistDetails']
        });

        const existingIds = Array.isArray(existingTrack?.artistDetails) ?
          existingTrack.artistDetails.map(a => (typeof a === 'object' ? a.id : a)) :
          [];

        const merged = Array.from(new Set([...existingIds, ...artistIdsToAdd]));

        await strapi.entityService.update('api::distribute-track.distribute-track', track.id, {
          data: {
            artistDetails: merged
          }
        });
      }
    }

    // 4) Return draft with full populate
    const draft = await strapi.entityService.findOne(
      'api::distribute-draft.distribute-draft',
      id,
      { populate: DEFAULT_POPULATE }
    );
    await autoUpdateCompletedSteps(id);

    const updated = await strapi.entityService.findOne(
      'api::distribute-draft.distribute-draft',
      id,
      { populate: DEFAULT_POPULATE }
    );

    ctx.body = { data: updated };
  },
  async step4(ctx) {
    const { id } = ctx.params;
    if (!id) return ctx.badRequest('Draft id is required.');
    const payload = ctx.request.body?.data || ctx.request.body || {};
    const {
      Priority = 'Standard',
      TimeZoneOfReference, OriginalReleaseDate, Countries, MusicStores,
      PriceCategory, DigitalReleaseDate, ReleaseTime,
    } = payload;

    const draft = await strapi.entityService.update('api::distribute-draft.distribute-draft', id, {
      data: { Priority, TimeZoneOfReference, OriginalReleaseDate, Countries, MusicStores, PriceCategory, DigitalReleaseDate, ReleaseTime },
      populate: DEFAULT_POPULATE,
    });
    await autoUpdateCompletedSteps(id);

    const updated = await strapi.entityService.findOne(
      'api::distribute-draft.distribute-draft',
      id,
      { populate: DEFAULT_POPULATE }
    );

    ctx.body = { data: updated };
  },

  async finish(ctx) {
    const { id } = ctx.params;
    if (!id) return ctx.badRequest('Draft id is required.');

    // ✅ 1. Fetch draft with tracks
    const draftData = await strapi.entityService.findOne(
      'api::distribute-draft.distribute-draft',
      id,
      { populate: { TrackList: true } }
    );

    let generatedISRCs = [];

    // ✅ 2. Process ISRC logic
    if (Array.isArray(draftData?.TrackList)) {
      for (const track of draftData.TrackList) {

        // 👉 CASE 1: USER PROVIDED ISRC → USE IT
        if (track.ISRC) {
          console.log(`⏭️ Track ${track.id} → Using user ISRC: ${track.ISRC}`);
          generatedISRCs.push(track.ISRC);
          continue;
        }

        // 👉 CASE 2: USER REQUESTED NEW (FIXED ✅)
        if (track.RequestANewISRC || draftData.RequestANewReferenceNumber) {
          const isrc = await generateISRC(strapi);

          await strapi.entityService.update(
            'api::distribute-track.distribute-track',
            track.id,
            {
              data: { ISRC: isrc },
            }
          );

          generatedISRCs.push(isrc);

          console.log(`🎵 Track ${track.id} → Generated ISRC: ${isrc}`);
          continue;
        }

        // 👉 CASE 3: NOTHING PROVIDED
        console.log(`⚠️ Track ${track.id} → No ISRC provided and not requested`);
      }
    }

    // ✅ 3. Publish (unchanged + ISRC storage)
    const draft = await strapi.entityService.update(
      'api::distribute-draft.distribute-draft',
      id,
      {
        data: {
          publishedAt: new Date(),
          CompletedSteps: 'done',
          ...(generatedISRCs.length && { ISRC_CODES: generatedISRCs }),
        },
        populate: DEFAULT_POPULATE,
      }
    );

    console.log("🚀 Draft published");

    ctx.body = { data: draft };
  },
  async createFromTracks(ctx) {
    const payload = ctx.request.body?.data || ctx.request.body || {};
    const {
      ReleaseType, ReleaseTitle, Version, LanguageOfTheTitles,
      PrimaryGenre, SecondaryGenre, AddLabel,
      CopyrightYear, CopyrightholderName,
      PhonogramRightsHolderName, PhonogramRightsHolderYear,
      RequestANewReferenceNumber,
      trackIds, tracks,
    } = payload;

    if (!ReleaseType || !ReleaseTitle)
      return ctx.badRequest('ReleaseType and ReleaseTitle are required.');

    if (AddLabel && ctx.state?.user) {
      try {
        await ensureUserLabel(strapi, ctx.state.user.id, AddLabel);
      } catch (e) {
        strapi.log.warn('ensureUserLabel (createFromTracks) failed: ' + e.message);
      }
    }

    let data = {
      ReleaseType,
      ReleaseTitle,
      Version,
      LanguageOfTheTitles,
      PrimaryGenre,
      SecondaryGenre,
      AddLabel,
      CopyrightYear,
      CopyrightholderName,
      PhonogramRightsHolderName,
      PhonogramRightsHolderYear,
      RequestANewReferenceNumber: RequestANewReferenceNumber ?? false,
      publishedAt: null,
    };

    data = await enforceOwner(ctx, null, data);

    // ✅ Create draft
    const draft = await strapi.entityService.create(
      'api::distribute-draft.distribute-draft',
      { data, populate: DEFAULT_POPULATE }
    );

    const draftId = draft.id;

    // ✅ Link existing tracks
    if (Array.isArray(trackIds) && trackIds.length) {
      await Promise.all(
        trackIds.map((tid) =>
          strapi.entityService.update(
            'api::distribute-track.distribute-track',
            tid,
            { data: { DraftRelease: draftId } }
          )
        )
      );
    }

    // ✅ Create new tracks
    if (Array.isArray(tracks) && tracks.length) {
      await Promise.all(
        tracks.map((track) =>
          strapi.entityService.create(
            'api::distribute-track.distribute-track',
            { data: { ...track, DraftRelease: draftId } }
          )
        )
      );
    }

    // ✅ FINAL STEP UPDATE (correct position)
    await autoUpdateCompletedSteps(draftId);

    const refreshed = await strapi.entityService.findOne(
      'api::distribute-draft.distribute-draft',
      draftId,
      { populate: DEFAULT_POPULATE }
    );

    ctx.body = { data: refreshed };
  }

}));

/* --------------------- Helpers --------------------- */
async function enforceOwner(ctx, draftId, data = {}) {
  const meId = Number(ctx.state.user.id);
  const uid = 'api::distribute-draft.distribute-draft';

  if (draftId) {
    const existing = await strapi.entityService.findOne(uid, draftId, { populate: { UserDetail: true } });
    if (!existing) ctx.notFound('Draft not found');
    const ownerId = existing?.UserDetail?.id ?? null;
    if (ownerId && ownerId !== meId) ctx.forbidden('Not allowed');
    if (!ownerId) data.UserDetail = meId;
  } else {
    data.UserDetail = meId;
    data.publishedAt = null;
  }
  return data;
}

async function ensureUserLabel(strapi, userId, rawLabel) {
  if (!userId || !rawLabel) return null;
  const label = String(rawLabel).trim();
  if (!label) return null;
  const labelLower = label.toLowerCase();

  const existing = await strapi.entityService.findMany('api::user-label.user-label', {
    filters: { owner: userId, labelLower },
    fields: ['id', 'label'],
    limit: 1,
  });
  if (existing.length) return existing[0];

  return await strapi.entityService.create('api::user-label.user-label', {
    data: { label, labelLower, owner: userId },
  });
}

async function generateISRC(strapi) {
  const prefix = "CB-H6V";
  const year = new Date().getFullYear().toString().slice(-2);

  // 🔍 get last ISRC from tracks
  const lastTrack = await strapi.entityService.findMany(
    'api::distribute-track.distribute-track',
    {
      filters: {
        ISRC: { $startsWith: `${prefix}-${year}-` }
      },
      sort: { createdAt: 'desc' },
      limit: 1,
    }
  );

  let serial = 1;

  if (lastTrack.length && lastTrack[0].ISRC) {
    const lastISRC = lastTrack[0].ISRC;

    const lastNumber = parseInt(lastISRC.split('-').pop(), 10);

    if (!isNaN(lastNumber)) {
      serial = lastNumber + 1;
    }
  }

  const serialStr = String(serial).padStart(5, "0");

  const newISRC = `${prefix}-${year}-${serialStr}`;

  console.log(`🎯 Generated ISRC: ${newISRC}`);

  return newISRC;
}
