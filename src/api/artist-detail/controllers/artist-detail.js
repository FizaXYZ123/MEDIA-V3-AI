'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::artist-detail.artist-detail', ({ strapi }) => ({

  // GET /artist-details/my
  async findMy(ctx) {
    const user = ctx.state.user; // JWT user
    if (!user) return ctx.unauthorized('Authentication required');

    const q = (ctx.query.q || '').toString().trim().toLowerCase();

    // Base filters: only this user's artists
    const filters = { owner: user.id };

    if (ctx.query.roleName) {

      const roles = ctx.query.roleName
        .split(",")
        .map(role => role.trim().toLowerCase())
        .filter(Boolean);

      filters.$or = roles.map(role => ({
        roleName: {
          $eqi: role,
        },
      }));
    }

    if (q) {
      filters.artistName = { $containsi: q };
    }

    // Fetch artist details
    const data = await strapi.entityService.findMany('api::artist-detail.artist-detail', {
      filters,
      sort: { updatedAt: 'desc' },
      fields: [
        'id',
        'artistName',
        'roleName',
        'appleMusicId',
        'spotifyId',
        'youtubeUsername',
        'soundcloudPage',
        'facebookPage',
        'twitterUsername',
        'websiteUrl',
        'biography',
        'itsVerified',
        'requiredVerification',
        'updatedAt',
        'createdAt',
      ],
      populate: {
        tracks: true,
        Profile_image: true,
      },
      limit: 50,
    });

    // If no query, map and return
    let result = data.map(artist => ({
      ...artist,
      trackCount: artist.tracks ? artist.tracks.length : 0,
      tracks: undefined,
    }));

    // If query exists, apply scoring
    if (q) {
      const scored = result.map(artist => {
        const name = (artist.artistName || '').toString().toLowerCase();
        let score = 0;

        if (name.startsWith(q)) score += 100;
        if (name.includes(q)) score += 10;
        if (name === q) score += 200;

        const updatedAtMs = artist.updatedAt ? Date.parse(artist.updatedAt) : 0;

        return { artist, score, updatedAtMs };
      });

      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.updatedAtMs - a.updatedAtMs;
      });

      result = scored.map(({ artist }) => artist);
    }

    // Return as array under "requiredVerification"
    ctx.body = result;
  },
  // Optional: Auto-assign owner on create
  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const { data } = ctx.request.body;

    if (!data?.artistName) {
      return ctx.badRequest('artistName must be defined.');
    }

    // override owner with logged-in user id
    const newData = {
      ...data,
      owner: user.id,
    };

    const entity = await strapi.entityService.create('api::artist-detail.artist-detail', {
      data: newData,
      populate: ['owner'], // include owner in response
    });

    return entity;
  },
  async find(ctx) {
    try {
      const { q } = ctx.request.query; // search query

      // Build search filter
      const where = q
        ? {
          artistName: {
            $containsi: q, // case-insensitive search
          },
        }
        : {};

      // Get artists without pagination
      const entities = await strapi.db.query('api::artist-detail.artist-detail').findMany({
        where,
        populate: ['Profile_image', 'owner'],
        orderBy: { id: 'desc' },
      });

      // Add track count for each artist
      const results = await Promise.all(
        entities.map(async (entity) => {
          const trackCount = await strapi.db
            .query('api::distribute-track.distribute-track')
            .count({
              where: { artistDetails: entity.id },
            });

          return {
            ...entity,
            trackCount,
            tracks: undefined, // explicitly exclude tracks
          };
        })
      );

      return results; // return as array, no pagination object
    } catch (err) {
      ctx.throw(400, err);
    }
  },
  async findOne(ctx) {
    try {
      const { id } = ctx.params;

      const entity = await strapi.service('api::artist-detail.artist-detail').findOne(id, {
        populate: ['Profile_image', 'owner'], // no tracks
      });

      if (!entity) return ctx.notFound('Artist not found');

      // Count related tracks
      const trackCount = await strapi.db.query('api::distribute-track.distribute-track').count({
        where: { artistDetails: id },
      });

      const result = {
        ...entity,
        trackCount,
        tracks: undefined,
      };
      delete result.owner;

      return result;
    } catch (err) {
      ctx.throw(404, 'Artist not found');
    }
  },

  // Update by ID
  async update(ctx) {
    try {
      const { id } = ctx.params;
      const { body } = ctx.request;
      const entity = await strapi.service('api::artist-detail.artist-detail').update(id, { data: body });
      return entity;
    } catch (err) {
      ctx.throw(400, err);
    }
  },

  // Delete by ID
  async delete(ctx) {
    try {
      const { id } = ctx.params;
      const entity = await strapi.service('api::artist-detail.artist-detail').delete(id);
      return entity;
    } catch (err) {
      ctx.throw(400, err);
    }
  },

}));
