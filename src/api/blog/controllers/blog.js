'use strict';

const { sort } = require('../../../../config/middlewares');

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::blog.blog', ({ strapi }) => ({

  async find(ctx) {
    const { search, category, page = 1, pageSize = 10 } = ctx.query;

    const filters = {};

    // 👉 Search by title
    if (search && search.trim() !== '') {
      filters.title = {
        $containsi: search.trim(),
      };
    }

    // 👉 Filter by category
    if (category) {
      filters.category = {
        $containsi: category,
      };
    }

    // 👉 If any filter applied
    if (search || category) {
      const entities = await strapi.db.query('api::blog.blog').findMany({
        where: filters,
        populate: ['cover_image'],
        sort: ['date:desc'],
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });

      const total = await strapi.db.query('api::blog.blog').count({
        where: filters,
      });

      const sanitizedEntities = await this.sanitizeOutput(entities, ctx);

      return this.transformResponse(sanitizedEntities, {
        pagination: {
          page: Number(page),
          pageSize: Number(pageSize),
          pageCount: Math.ceil(total / pageSize),
          total,
        },
      });
    }

      ctx.query = {
    ...ctx.query,
    sort: ['date:desc'],
  };

    return await super.find(ctx);
  },

  async findOne(ctx) {
    const { id } = ctx.params;

    const entity = await strapi.db.query('api::blog.blog').findOne({
      where: {
        slug: id, // 🔥 treat id as slug
      },
      populate: ['cover_image'],
    });

    if (!entity) {
      return ctx.notFound('Blog not found');
    }

    return this.transformResponse(entity);
  },


}));