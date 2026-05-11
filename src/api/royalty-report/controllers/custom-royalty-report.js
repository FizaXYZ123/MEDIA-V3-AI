"use strict";

module.exports = {

  async importReport(ctx) {
    try {
      const file = ctx.request.files?.file;

      if (!file) {
        return ctx.badRequest("CSV file is required");
      }

      /* ================= DEFAULT COMMISSION ================= */
      const commissionRaw = ctx.request.body?.commission;

      const commissionValue =
        commissionRaw !== undefined &&
          !isNaN(Number(commissionRaw)) &&
          Number(commissionRaw) >= 0 &&
          Number(commissionRaw) <= 100
          ? Number(commissionRaw)
          : 15;

      /* ================= PLATFORM COMMISSION ================= */
      let platformCommissions = {};

      try {
        platformCommissions =
          typeof ctx.request.body?.platformCommissions === "string"
            ? JSON.parse(ctx.request.body.platformCommissions)
            : ctx.request.body?.platformCommissions || {};
      } catch (err) {
        return ctx.badRequest("Invalid platformCommissions JSON");
      }

      const result = await strapi
        .service("api::royalty-report.royalty-report")
        .importCSV(
          file.path,
          file.name,
          commissionValue,
          platformCommissions
        );

      return ctx.send({
        message: "Royalty report processed successfully",
        inserted: result.inserted,
        skipped: result.skipped,
        totalNet: result.monthlyTotal,
        skippedNet: result.skippedTotal
      });

    } catch (error) {
      return ctx.badRequest(error.message);
    }
  },

  async searchReports(ctx) {

    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized("Authentication required");
    }

    const { artist, trackTitle, album, platform } = ctx.query;

    const knex = strapi.db.connection;

    let query = knex("royalty_reports");

    // ARTIST FILTER
    if (artist) {
      query = query.andWhereRaw(
        "LOWER(artist) LIKE LOWER(?)",
        [`%${artist}%`]
      );
    }

    // TRACK FILTER
    if (trackTitle) {
      query = query.andWhereRaw(
        "LOWER(track_title) LIKE LOWER(?)",
        [`%${trackTitle}%`]
      );
    }

    // ALBUM FILTER
    if (album) {
      query = query.andWhereRaw(
        "LOWER(release_title) LIKE LOWER(?)",
        [`%${album}%`]
      );
    }

    // PLATFORM FILTER
    if (platform) {
      query = query.andWhereRaw(
        "LOWER(platform) LIKE LOWER(?)",
        [`%${platform}%`]
      );
    }

    const results = await query.select("*");

    ctx.send({
      requestedBy: user.email,
      totalEntries: results.length,
      data: results
    });

  },


  // client panel earnings endpoint 
  async getTrackEarnings(ctx) {

    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized("Authentication required");
    }

    const { trackTitle, platform } = ctx.query;

    const knex = strapi.db.connection;

    let query = knex("royalty_reports")
      .where("user_email", user.email);

    if (trackTitle) {
      query = query.andWhereRaw(
        "LOWER(track_title) = LOWER(?)",
        [trackTitle]
      );
    }

    if (platform) {
      query = query.andWhereRaw(
        "LOWER(platform) = LOWER(?)",
        [platform]
      );
    }

    const results = await query.select("*");

    ctx.send({
      totalEntries: results.length,
      data: results
    });

  },

  async userStreamsPerPlatform(ctx) {
    try {

      /* 1️⃣ GET USER */
      const user = ctx.state.user;

      if (!user) {
        return ctx.unauthorized("Unauthorized");
      }

      /* 2️⃣ GET USER TRACKS (WITH RELATION FILTER) */
      const tracks = await strapi.db
        .query("api::distribute-track.distribute-track")
        .findMany({
          where: {
            PublishedRelease: {
              UserDetail: user.id
            }
          },
          select: ["ISRC"]
        });

      if (!tracks.length) {
        return ctx.send({
          totalUnits: 0,
          platforms: []
        });
      }

      const isrcList = tracks.map(t => t.ISRC).filter(Boolean);

      /* 3️⃣ FETCH ROYALTY DATA */
      const data = await strapi.db
        .query("api::royalty-report.royalty-report")
        .findMany({
          where: {
            ISRC: {
              $in: isrcList
            }
          },
          select: ["Platform", "Units"]
        });

      /* 4️⃣ GROUP BY PLATFORM */
      let totalUnits = 0;
      const platformMap = {};

      data.forEach(item => {
        const platform = item.Platform || "Unknown";
        const units = Number(item.Units || 0);

        totalUnits += units;

        if (!platformMap[platform]) {
          platformMap[platform] = {
            platform,
            totalUnits: 0,
            percentage: 0
          };
        }

        platformMap[platform].totalUnits += units;
      });

      /* 5️⃣ CALCULATE % */
      const result = Object.values(platformMap).map(p => ({
        ...p,
        percentage: totalUnits
          ? ((p.totalUnits / totalUnits) * 100).toFixed(2)
          : 0
      }));

      /* 6️⃣ SORT */
      result.sort((a, b) => b.totalUnits - a.totalUnits);

      return ctx.send({
        totalUnits,
        platforms: result
      });

    } catch (err) {
      ctx.throw(500, err);
    }
  },

  async userCountryEarnings(ctx) {
    try {

      /* 1️⃣ GET USER */
      const user = ctx.state.user;

      if (!user) {
        return ctx.unauthorized("Unauthorized");
      }

      /* 2️⃣ GET USER TRACKS */
      const tracks = await strapi.db
        .query("api::distribute-track.distribute-track")
        .findMany({
          where: {
            PublishedRelease: {
              UserDetail: user.id
            }
          },
          select: ["ISRC"]
        });

      if (!tracks.length) {
        return ctx.send({
          totalEarnings: 0,
          countries: []
        });
      }

      const isrcList = tracks.map(t => t.ISRC).filter(Boolean);

      /* 3️⃣ FETCH ROYALTY DATA */
      const data = await strapi.db
        .query("api::royalty-report.royalty-report")
        .findMany({
          where: {
            ISRC: {
              $in: isrcList
            }
          },
          select: ["Country", "NetTotal"]
        });

      if (!data.length) {
        return ctx.send({
          totalEarnings: 0,
          countries: []
        });
      }

      /* 4️⃣ GROUP BY COUNTRY */
      let totalEarnings = 0;
      const countryMap = {};

      data.forEach(item => {
        const country = item.Country || "Unknown";
        const earnings = Number(item.NetTotal || 0);

        totalEarnings += earnings;

        if (!countryMap[country]) {
          countryMap[country] = {
            country,
            totalEarnings: 0,
            percentage: 0
          };
        }

        countryMap[country].totalEarnings += earnings;
      });

      /* 5️⃣ CALCULATE % */
      const result = Object.values(countryMap).map(c => ({
        ...c,
        percentage: totalEarnings
          ? ((c.totalEarnings / totalEarnings) * 100).toFixed(2)
          : 0
      }));

      /* 6️⃣ SORT */
      result.sort((a, b) => b.totalEarnings - a.totalEarnings);

      return ctx.send({
        totalEarnings,
        countries: result
      });

    } catch (err) {
      ctx.throw(500, err);
    }
  },

  async getUserEarningsPerMonth(ctx) {
    const userId = ctx.state.user.id;
    const year = parseInt(ctx.query.year) || new Date().getFullYear();

    const invoices = await strapi.entityService.findMany(
      "api::invoice.invoice",
      {
        filters: {
          users_permissions_user: userId,
          year,
        },
        fields: [
          "month",
          "amountPayableBeforeAdminFee"
        ],
        limit: -1,
      }
    );

    const months = Array(12).fill(0);
    let yearlyTotal = 0;

    invoices.forEach(inv => {
      const index = inv.month - 1;

      const beforeAdmin = Number(inv.amountPayableBeforeAdminFee || 0);

      months[index] = beforeAdmin;
      yearlyTotal += beforeAdmin;
    });

    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    return {
      year,

      // ✅ ONLY this total
      totalEarnings: Number(yearlyTotal.toFixed(2)),

      // ✅ ONLY before admin fee per month
      monthly: months.map((total, i) => ({
        month: monthNames[i],
        total: Number(total.toFixed(2)),
      })),
    };
  },

  async getUserStreamsPerMonth(ctx) {
    const userId = ctx.state.user.id;

    // ✅ Year from query (required or fallback)
    const year = parseInt(ctx.query.year) || new Date().getFullYear();

    const start = `${year}-01-01`;
    const end = `${year}-12-31`;

    const royalties = await strapi.entityService.findMany(
      "api::royalty-report.royalty-report",
      {
        filters: {
          EndDate: {
            $gte: start,
            $lte: end,
          },
          distribute_track: {
            PublishedRelease: {
              UserDetail: {
                id: userId,
              },
            },
          },
        },
        fields: ["Units", "EndDate"],
        populate: {
          distribute_track: {
            populate: {
              PublishedRelease: {
                populate: {
                  UserDetail: true,
                },
              },
            },
          },
        },
        limit: -1,
      }
    );

    const months = Array(12).fill(0);
    let yearlyTotalUnits = 0;

    royalties.forEach(r => {
      if (!r.EndDate) return;

      const monthIndex = new Date(r.EndDate).getMonth();
      const units = Number(r.Units || 0);

      months[monthIndex] += units;
      yearlyTotalUnits += units;
    });

    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    return {
      year,

      // ✅ Total units for the selected year
      totalUnits: yearlyTotalUnits,

      // ✅ Month-wise units
      monthly: months.map((total, i) => ({
        month: monthNames[i],
        units: total,
      })),
    };
  },
  async getUserStreamsPerPlatform(ctx) {
    const userId = ctx.state.user.id;

    // ✅ Year
    const year = parseInt(ctx.query.year) || new Date().getFullYear();

    const start = `${year}-01-01`;
    const end = `${year}-12-31`;

    // ✅ Normalize platform names
    function normalizePlatformName(p) {
      const value = p.toLowerCase();

      if (value.includes("youtube")) return "YouTube Music";
      if (value.includes("spotify")) return "Spotify";
      if (value.includes("apple")) return "Apple Music";
      if (value.includes("amazon")) return "Amazon Music";
      if (value.includes("deezer")) return "Deezer";

      return p;
    }

    // ✅ Handle multiple platform=params
    let platformFilter = [];

    if (ctx.query.platform) {
      if (Array.isArray(ctx.query.platform)) {
        platformFilter = ctx.query.platform.map(p =>
          normalizePlatformName(p.trim())
        );
      } else {
        platformFilter = [
          normalizePlatformName(ctx.query.platform.trim()),
        ];
      }
    }

    const royalties = await strapi.entityService.findMany(
      "api::royalty-report.royalty-report",
      {
        filters: {
          EndDate: {
            $gte: start,
            $lte: end,
          },

          // ✅ Apply platform filter only if passed
          ...(platformFilter.length > 0 && {
            Platform: {
              $in: platformFilter,
            },
          }),

          distribute_track: {
            PublishedRelease: {
              UserDetail: {
                id: userId,
              },
            },
          },
        },

        fields: ["Units", "EndDate", "Platform"],

        populate: {
          distribute_track: {
            populate: {
              PublishedRelease: {
                populate: {
                  UserDetail: true,
                },
              },
            },
          },
        },

        limit: -1,
      }
    );

    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    // ✅ Initialize 12 months
    const monthly = Array(12).fill(null).map(() => ({}));

    royalties.forEach(r => {
      if (!r.EndDate) return;

      const monthIndex = new Date(r.EndDate).getMonth();
      const platform = r.Platform || "Unknown";
      const units = Number(r.Units || 0);

      if (!monthly[monthIndex][platform]) {
        monthly[monthIndex][platform] = 0;
      }

      monthly[monthIndex][platform] += units;
    });

    // ✅ Ensure all selected platforms appear (even if 0)
    if (platformFilter.length > 0) {
      platformFilter.forEach(platform => {
        monthly.forEach(m => {
          if (!m[platform]) {
            m[platform] = 0;
          }
        });
      });
    }

    return {
      year,
      platforms: platformFilter,
      monthly: monthly.map((data, i) => ({
        month: monthNames[i],
        ...data,
      })),
    };
  },

  // ─── V3 — Priority 12: enhanced analytics ─────────────────────────────────
  // Shared helper: build a where clause that scopes to the current user and
  // optionally filters by ISO date strings (`from`, `to`).
  _analyticsWhere(ctx) {
    const userId = ctx.state?.user?.id;
    const where = { user: userId };
    const { from, to } = ctx.query || {};
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.$gte = from;
      if (to) where.createdAt.$lte = to;
    }
    return where;
  },

  async analyticsOverview(ctx) {
    try {
      const where = module.exports._analyticsWhere(ctx);
      const rows = await strapi.db.query("api::royalty-report.royalty-report").findMany({
        where,
        limit: 50000,
      });
      let gross = 0;
      let net = 0;
      let streams = 0;
      const byMonth = {};
      for (const r of rows) {
        const g = Number(r.NetTotalClientCurrency || r.NetTotal || 0);
        const n = Number(r.ArtistEarnings || r.NetTotal || 0);
        const s = Number(r.Quantity || 0);
        gross += g;
        net += n;
        streams += s;
        const key = (r.SaleMonth || r.createdAt || "").toString().slice(0, 7);
        if (!byMonth[key]) byMonth[key] = { month: key, gross: 0, net: 0, streams: 0 };
        byMonth[key].gross += g;
        byMonth[key].net += n;
        byMonth[key].streams += s;
      }
      ctx.body = {
        totals: { gross, net, streams, rowCount: rows.length },
        monthly: Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)),
      };
    } catch (err) {
      strapi.log.error("analyticsOverview failed", err);
      ctx.throw(500, err.message);
    }
  },

  async analyticsByDsp(ctx) {
    try {
      const where = module.exports._analyticsWhere(ctx);
      const rows = await strapi.db.query("api::royalty-report.royalty-report").findMany({
        where,
        limit: 50000,
      });
      const map = {};
      for (const r of rows) {
        const dsp = r.DSP || r.RetailerName || "Unknown";
        if (!map[dsp]) map[dsp] = { dsp, gross: 0, net: 0, streams: 0 };
        map[dsp].gross += Number(r.NetTotalClientCurrency || r.NetTotal || 0);
        map[dsp].net += Number(r.ArtistEarnings || r.NetTotal || 0);
        map[dsp].streams += Number(r.Quantity || 0);
      }
      ctx.body = { rows: Object.values(map).sort((a, b) => b.net - a.net) };
    } catch (err) {
      strapi.log.error("analyticsByDsp failed", err);
      ctx.throw(500, err.message);
    }
  },

  async analyticsByRelease(ctx) {
    try {
      const releaseId = ctx.params?.id;
      const where = { ...module.exports._analyticsWhere(ctx) };
      // Match either by relation or by ISRC list — depends on schema. We try
      // both and merge so this works regardless of how the import linked rows.
      if (releaseId) {
        where.$or = [
          { distribute_track: { publish_distribute: { id: releaseId } } },
          { release: releaseId },
        ];
      }
      const rows = await strapi.db.query("api::royalty-report.royalty-report").findMany({
        where,
        limit: 50000,
      });
      const map = {};
      for (const r of rows) {
        const key = r.ISRC || r.SongTitle || "Unknown";
        if (!map[key]) {
          map[key] = { isrc: r.ISRC, title: r.SongTitle, gross: 0, net: 0, streams: 0 };
        }
        map[key].gross += Number(r.NetTotalClientCurrency || r.NetTotal || 0);
        map[key].net += Number(r.ArtistEarnings || r.NetTotal || 0);
        map[key].streams += Number(r.Quantity || 0);
      }
      ctx.body = { rows: Object.values(map).sort((a, b) => b.net - a.net) };
    } catch (err) {
      strapi.log.error("analyticsByRelease failed", err);
      ctx.throw(500, err.message);
    }
  },

  async analyticsByCountry(ctx) {
    try {
      const where = module.exports._analyticsWhere(ctx);
      const rows = await strapi.db.query("api::royalty-report.royalty-report").findMany({
        where,
        limit: 50000,
      });
      const map = {};
      for (const r of rows) {
        const country = r.SaleCountry || r.Country || "Unknown";
        if (!map[country]) map[country] = { country, gross: 0, net: 0, streams: 0 };
        map[country].gross += Number(r.NetTotalClientCurrency || r.NetTotal || 0);
        map[country].net += Number(r.ArtistEarnings || r.NetTotal || 0);
        map[country].streams += Number(r.Quantity || 0);
      }
      ctx.body = { rows: Object.values(map).sort((a, b) => b.net - a.net) };
    } catch (err) {
      strapi.log.error("analyticsByCountry failed", err);
      ctx.throw(500, err.message);
    }
  },

  async deleteAll(ctx) {
    try {
      const deleted = await strapi.db
        .query("api::royalty-report.royalty-report")
        .deleteMany({
          where: {},
        });

      return ctx.send({
        success: true,
        message: `royalty reports deleted successfully`,
      });
    } catch (error) {
      console.error("❌ Delete all error:", error);

      return ctx.internalServerError(
        "Failed to delete royalty reports"
      );
    }
  },
};