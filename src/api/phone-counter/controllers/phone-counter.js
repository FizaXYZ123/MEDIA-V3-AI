"use strict";

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::phone-counter.phone-counter",
  ({ strapi }) => ({

    async create(ctx) {
      try {
        /* 1️⃣ TODAY RANGE */
        const start = new Date();
        start.setHours(0, 0, 0, 0);

        const end = new Date();
        end.setHours(23, 59, 59, 999);

        /* 2️⃣ FIND TODAY ENTRY */
        const existing = await strapi.db
          .query("api::phone-counter.phone-counter")
          .findOne({
            where: {
              date: {
                $between: [start, end],
              },
              publishedAt: { $notNull: true },
            },
          });

        let result;

        /* 3️⃣ IF EXISTS → INCREMENT */
        if (existing) {
          result = await strapi.db
            .query("api::phone-counter.phone-counter")
            .update({
              where: { id: existing.id },
              data: {
                count: Number(existing.count || 0) + 1,
                publishedAt: new Date(),
              },
            });
        }

        /* 4️⃣ ELSE → CREATE NEW */
        else {
          result = await strapi.db
            .query("api::phone-counter.phone-counter")
            .create({
              data: {
                date: new Date(),
                count: 1,
                publishedAt: new Date(),
              },
            });
        }

        /* 5️⃣ RESPONSE */
        return ctx.send({
          date: result.date,
          count: result.count,
        });

      } catch (error) {
        ctx.throw(500, error);
      }
    },

  })
);