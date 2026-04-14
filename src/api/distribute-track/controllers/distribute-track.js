'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

const TRACK_POPULATE = {
  DraftRelease: true,
  PublishedRelease: true,
  TrackUpload: true,
  RoleCredits: true,
  PrimaryArtist: true, // add artist relation
};

// helper: ensure artist belongs to logged-in user, or create if string/name provided
async function ensureArtistForUser(ctx, primaryArtist) {
  const user = ctx.state.user;
  if (!primaryArtist) return null;

  // If array: handle first element (or map if you want multiple)
  if (Array.isArray(primaryArtist) && primaryArtist.length) {
    // for now pick first element; change to return array of ids if your field allows many
    return ensureArtistForUser(ctx, primaryArtist[0]);
  }

  // number or numeric-string -> validate ownership
  if (
    typeof primaryArtist === 'number' ||
    (typeof primaryArtist === 'string' && /^[0-9]+$/.test(primaryArtist))
  ) {
    const id = Number(primaryArtist);
    const artist = await strapi.entityService.findOne(
      'api::artist-detail.artist-detail',
      id,
      { populate: ['owner'] }
    );

    if (!artist) ctx.throw(404, 'Artist not found');
    if (!artist.owner || artist.owner.id !== user.id) {
      ctx.throw(403, 'You do not own this artist');
    }
    return artist.id;
  }

  // object with id
  if (typeof primaryArtist === 'object' && primaryArtist !== null) {
    if (primaryArtist.id) {
      return ensureArtistForUser(ctx, primaryArtist.id);
    }
    // object with artistName field
    if (primaryArtist.artistName && primaryArtist.artistName.trim().length) {
      const name = primaryArtist.artistName.trim();
      // try find existing artist by name + owner
      const found = await strapi.entityService.findMany('api::artist-detail.artist-detail', {
        filters: { artistName: name, owner: user.id },
        limit: 1,
      });
      if (found && found.length) return found[0].id;

      const created = await strapi.entityService.create('api::artist-detail.artist-detail', {
        data: {
          artistName: name,
          owner: user.id,
          // copy any other small fields from the object if provided (optional)
          roleName: primaryArtist.roleName || null,
          searchRole: primaryArtist.searchRole || null,
        },
      });
      return created.id;
    }
  }

  // string name -> create or reuse existing
  if (typeof primaryArtist === 'string' && primaryArtist.trim().length) {
    const name = primaryArtist.trim();

    // check existing (owner-specific)
    const found = await strapi.entityService.findMany('api::artist-detail.artist-detail', {
      filters: { artistName: name, owner: ctx.state.user.id },
      limit: 1,
    });
    if (found && found.length) return found[0].id;

    const artist = await strapi.entityService.create('api::artist-detail.artist-detail', {
      data: {
        artistName: name,
        owner: ctx.state.user.id,
      },
    });
    return artist.id;
  }

  return null;
}

module.exports = createCoreController('api::distribute-track.distribute-track', ({ strapi }) => ({
  
  async find(ctx) {
    ctx.query = { ...ctx.query, populate: TRACK_POPULATE, sort: ctx.query.sort || 'id:desc',};
    const { data, meta } = await super.find(ctx);
    return { data, meta };
  },

  async findOne(ctx) {
    const { id } = ctx.params;
    const entity = await strapi.entityService.findOne(
      'api::distribute-track.distribute-track',
      id,
      { populate: TRACK_POPULATE }
    );
    if (!entity) return ctx.notFound('Track not found');
    return { data: entity };
  },

  async create(ctx) {
    const { data } = ctx.request.body || {};

    if (data && data.PrimaryArtist) {
      data.PrimaryArtist = await ensureArtistForUser(ctx, data.PrimaryArtist);
      // write back modified data into ctx.request.body so super.create uses it
      ctx.request.body.data = data;
    }

    const res = await super.create(ctx);
    // return fully populated entity
    return await this.findOne({ params: { id: res.data.id }, state: ctx.state, request: ctx.request });
  },
  async update(ctx) {
    // 1) perform normal Strapi update (this updates other track fields as usual)
    const res = await super.update(ctx);

    // 2) ensure we have track id
    const trackId = res.data?.id;
    if (!trackId) {
      strapi.log.warn('update: no id returned from super.update');
      return res;
    }

    // 3) fetch the latest track including RoleCredits (if the client saved RoleCredits in the update)
    const track = await strapi.entityService.findOne('api::distribute-track.distribute-track', trackId, {
      populate: ['RoleCredits', 'artistDetails'],
    });

    if (!track) {
      strapi.log.error(`update: could not fetch track id=${trackId}`);
      return res;
    }

    try {
      // Use RoleCredits from the saved track; fallback to empty array
      const credits = Array.isArray(track.RoleCredits) ? track.RoleCredits : [];

      // Build normalized unique artistName list (trim + lowercase for matching)
      const desiredNames = [
        ...new Set(
          credits
            .map((c) => (c && c.artistName ? String(c.artistName).trim() : ''))
            .filter(Boolean)
            .map((n) => n)
        ),
      ];

      // If no artist names present, clear relation and return (optional behavior)
      if (!desiredNames.length) {
        // Decide: here we remove all artistDetails if RoleCredits empty
        await strapi.entityService.update('api::distribute-track.distribute-track', trackId, {
          data: { artistDetails: [] },
        });
        strapi.log.info(`Cleared artistDetails for track id=${trackId} (no RoleCredits)`);
        return await this.findOne({ params: { id: trackId }, state: ctx.state, request: ctx.request });
      }

      // Fetch existing artist-details that have any of the desired names
      // We fetch broadly and then match case-insensitively in JS
      const existingArtists = await strapi.entityService.findMany('api::artist-detail.artist-detail', {
        filters: { artistName: { $in: desiredNames } },
        fields: ['id', 'artistName', 'roleName'],
      });

      // Map normalized name -> existing record
      const existingByNormalized = new Map();
      for (const a of existingArtists) {
        if (!a || !a.artistName) continue;
        existingByNormalized.set(String(a.artistName).trim().toLowerCase(), a);
      }

      // For each desired name: reuse existing if present, otherwise create new
      const resultingIds = [];
      for (const rawName of desiredNames) {
        const nameTrim = String(rawName).trim();
        const normalized = nameTrim.toLowerCase();

        const matched = existingByNormalized.get(normalized);
        if (matched) {
          resultingIds.push(matched.id);
          continue;
        }

        // create new artist-detail
        const created = await strapi.entityService.create('api::artist-detail.artist-detail', {
          data: {
            artistName: nameTrim,
            roleName: null, // we're not enforcing roleName here; store null
            searchRole: 'artist_detail',
            owner: ctx.state.user?.id || null,
          },
        });

        resultingIds.push(created.id);
        // add to map to avoid duplicate creates for same name in this loop
        existingByNormalized.set(normalized, { id: created.id, artistName: nameTrim, roleName: null });
        strapi.log.info(`Created artist-detail id=${created.id} (${nameTrim})`);
      }

      // Now update the track's artistDetails relation to exactly these ids (preserves order from desiredNames)
      await strapi.entityService.update('api::distribute-track.distribute-track', trackId, {
        data: { artistDetails: resultingIds },
      });

      strapi.log.info(`Synced artistDetails for track id=${trackId} -> [${resultingIds.join(',')}]`);
    } catch (err) {
      strapi.log.error('Failed to sync artistDetails (track update): ' + (err?.message || err));
    }

    // 🔥 Force Publish Release Status Refresh
    if (track.PublishedRelease?.id) {
      await strapi
        .service('api::distribute-track.distribute-track')
        .checkAndUpdatePublish(track.PublishedRelease.id);
    }


    // 4) Return the fully populated track
    return await this.findOne({
      params: { id: trackId },
      state: ctx.state,
      request: ctx.request,
    });
  }, // end update

  async delete(ctx) {
    const { id } = ctx.params;
    if (!id) return ctx.badRequest('Track id is required.');
    const deleted = await strapi.entityService.delete(
      'api::distribute-track.distribute-track',
      id
    );
    ctx.body = { data: deleted };
  },

  /* ------- helpers: list by draft / published ------- */
  async findByDraft(ctx) {
    const { draftId } = ctx.params;
    if (!draftId) return ctx.badRequest('draftId is required');
    const results = await strapi.entityService.findMany('api::distribute-track.distribute-track', {
      filters: { DraftRelease: { id: draftId } },
      populate: TRACK_POPULATE,
      sort: { id: 'asc' },
    });
    ctx.body = { data: results };
  },

  async findByPublished(ctx) {
    const { pubId } = ctx.params;
    if (!pubId) return ctx.badRequest('pubId is required');
    const results = await strapi.entityService.findMany('api::distribute-track.distribute-track', {
      filters: { PublishedRelease: { id: pubId } },
      populate: TRACK_POPULATE,
      sort: { id: 'asc' },
    });
    ctx.body = { data: results };
  },

}));
