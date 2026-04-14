"use strict";

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::royalty-report.royalty-report",
  ({ strapi }) => ({

    /* =========================================
       1️⃣ COUNTRY EARNINGS
    ========================================= */
    async getCountryEarnings(ctx) {
      try {
        const data = await strapi.db
          .query("api::royalty-report.royalty-report")
          .findMany({
            select: ["Country", "NetTotal"],
          });

        const countryMap = {};
        let totalEarnings = 0;

        for (const item of data) {
          const country = item.Country || "Unknown";
          const earning = Number(item.NetTotal || 0);

          totalEarnings += earning;

          if (!countryMap[country]) {
            countryMap[country] = {
              country,
              total: 0,
            };
          }

          countryMap[country].total += earning;
        }

        const countries = Object.values(countryMap).sort(
          (a, b) => b.total - a.total
        );

        return ctx.send({
          totalEarnings,
          countries,
        });

      } catch (err) {
        ctx.throw(500, err);
      }
    },

    /* =========================================
       2️⃣ EARNINGS SUMMARY (MONTH BASED)
    ========================================= */
    async getEarningsSummary(ctx) {
      try {
        const reports = await strapi.db
          .query("api::imported-report.imported-report")
          .findMany({
            select: [
              "totalNet",
              "skippedNet",
              "startDate",
              "endDate",
              "createdAt",
            ],
            orderBy: { createdAt: "desc" },
          });

        if (!reports.length) {
          return ctx.send({
            totalEarnings: 0,
            skippedEarnings: 0,
            monthsCount: 0,
            lastMonth: null,
          });
        }

        let total = 0;
        let skipped = 0;

        for (const r of reports) {
          total += Number(r.totalNet || 0);
          skipped += Number(r.skippedNet || 0);
        }

        const last = reports[0];

        return ctx.send({
          totalEarnings: total,
          skippedEarnings: skipped,
          monthsCount: reports.length,
          lastMonth: {
            period: `${last.startDate} to ${last.endDate}`,
            totalEarnings: Number(last.totalNet || 0),
            skippedEarnings: Number(last.skippedNet || 0),
          },
        });

      } catch (err) {
        ctx.throw(500, err);
      }
    },

    /* =========================================
       3️⃣ TRACK WISE EARNINGS
    ========================================= */
    async singleTrackEarnings(ctx) {
      try {
        const data = await strapi.db
          .query("api::royalty-report.royalty-report")
          .findMany({
            select: [
              "ISRC",
              "TrackTitle",
              "Artist",
              "NetTotal",
              "Units",
            ],
          });

        const trackMap = {};

        for (const item of data) {
          const key = item.ISRC || "UNKNOWN";

          if (!trackMap[key]) {
            trackMap[key] = {
              ISRC: item.ISRC,
              TrackTitle: item.TrackTitle,
              Artist: item.Artist,
              totalEarnings: 0,
              totalUnits: 0,
            };
          }

          trackMap[key].totalEarnings += Number(item.NetTotal || 0);
          trackMap[key].totalUnits += Number(item.Units || 0);
        }

        return ctx.send(Object.values(trackMap));

      } catch (err) {
        ctx.throw(500, err);
      }
    },

    /* =========================================
       4️⃣ PLATFORM STREAMS + SHARE %
    ========================================= */
    async getTotalStreams(ctx) {
      try {
        const data = await strapi.db
          .query("api::royalty-report.royalty-report")
          .findMany({
            select: ["Platform", "Units", "NetTotal"],
          });

        const platformMap = {};
        let totalUnits = 0;

        for (const item of data) {
          const platform = item.Platform || "Unknown";
          const units = Number(item.Units || 0);
          const earnings = Number(item.NetTotal || 0);

          totalUnits += units;

          if (!platformMap[platform]) {
            platformMap[platform] = {
              platform,
              totalUnits: 0,
              totalEarnings: 0,
              percentage: 0,
            };
          }

          platformMap[platform].totalUnits += units;
          platformMap[platform].totalEarnings += earnings;
        }

        const platforms = Object.values(platformMap).map((p) => ({
          ...p,
          percentage: totalUnits
            ? ((p.totalUnits / totalUnits) * 100).toFixed(2)
            : "0.00",
        }));

        platforms.sort((a, b) => b.totalUnits - a.totalUnits);

        return ctx.send({
          totalUnits,
          platforms,
        });

      } catch (err) {
        ctx.throw(500, err);
      }
    },

  })
);