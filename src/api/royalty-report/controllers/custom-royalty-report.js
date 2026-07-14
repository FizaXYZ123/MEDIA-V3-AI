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

      /* ================= report month and year ================= */

      const reportMonth = Number(ctx.request.body?.reportMonth);
      const reportYear = Number(ctx.request.body?.reportYear);

      if (
        !Number.isInteger(reportMonth) ||
        reportMonth < 1 ||
        reportMonth > 12 ||
        !Number.isInteger(reportYear) ||
        reportYear < 2000
      ) {
        return ctx.badRequest("Valid report month and year are required");
      }

      /* ================= CHECK REPORT ALREADY IMPORTED ================= */

      const existingReport = await strapi.db
        .query("api::imported-report.imported-report")
        .findOne({
          where: {
            reportMonth,
            reportYear,
          },
        });

      if (existingReport) {
        return ctx.badRequest(
          `Royalty report for ${reportMonth}/${reportYear} has already been imported.`
        );
      }

      const loggedInUser = await strapi.db
        .query("plugin::users-permissions.user")
        .findOne({
          where: {
            id: ctx.state.user.id,
          },
          populate: {
            role: true,
          },
        });

      const result = await strapi
        .service("api::royalty-report.royalty-report")
        .importCSV(
          file.path,
          file.name,
          commissionValue,
          platformCommissions,
          loggedInUser,
          reportMonth,
          reportYear
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

  async generateCsvReport(ctx) {

    return await strapi
      .service(
        "api::royalty-report.generate-royalty-csv-service"
      )
      .generateCsvReport(ctx);
  },

  // client panel earnings endpoint 

  async getTrackEarnings(ctx) {

    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized("Authentication required");
    }

    const {
      isrc,
      songName,
      platform,
      country,
      startDate,
      endDate,
    } = ctx.query;

    const knex = strapi.db.connection;

    let query = knex("royalty_reports")
      .where("user_email", user.email);

    // =========================
    // ISRC (multiple)
    // =========================
    if (isrc) {

      const isrcList = isrc
        .split(",")
        .map(v => v.trim().toLowerCase());

      query = query.where(function () {
        isrcList.forEach((item, index) => {

          if (index === 0) {
            this.whereRaw(
              "LOWER(isrc) LIKE ?",
              [`%${item}%`]
            );
          } else {
            this.orWhereRaw(
              "LOWER(isrc) LIKE ?",
              [`%${item}%`]
            );
          }

        });
      });
    }

    // =========================
    // SONG NAME (multiple)
    // =========================
    if (songName) {

      const songList = songName
        .split(",")
        .map(v => v.trim().toLowerCase());

      query = query.where(function () {
        songList.forEach((item, index) => {

          if (index === 0) {
            this.whereRaw(
              "LOWER(track_title) LIKE ?",
              [`%${item}%`]
            );
          } else {
            this.orWhereRaw(
              "LOWER(track_title) LIKE ?",
              [`%${item}%`]
            );
          }

        });
      });
    }

    // =========================
    // PLATFORM (multiple)
    // =========================
    if (platform) {

      const platformList = platform
        .split(",")
        .map(v => v.trim().toLowerCase());

      query = query.where(function () {
        platformList.forEach((item, index) => {

          if (index === 0) {
            this.whereRaw(
              "LOWER(platform) LIKE ?",
              [`%${item}%`]
            );
          } else {
            this.orWhereRaw(
              "LOWER(platform) LIKE ?",
              [`%${item}%`]
            );
          }

        });
      });
    }

    // =========================
    // COUNTRY (multiple)
    // =========================
    if (country) {

      const countryList = country
        .split(",")
        .map(v => v.trim().toLowerCase());

      query = query.where(function () {
        countryList.forEach((item, index) => {

          if (index === 0) {
            this.whereRaw(
              "LOWER(country) LIKE ?",
              [`%${item}%`]
            );
          } else {
            this.orWhereRaw(
              "LOWER(country) LIKE ?",
              [`%${item}%`]
            );
          }

        });
      });
    }

    // =========================
    // DATE RANGE
    // =========================
    if (startDate) {
      query = query.where(
        "start_date",
        ">=",
        startDate
      );
    }

    if (endDate) {
      query = query.where(
        "start_date",
        "<=",
        endDate
      );
    }

    // console.log("📊 TRACK EARNINGS FILTERS:", {
    //   isrc,
    //   songName,
    //   platform,
    //   country,
    //   startDate,
    //   endDate,
    // });

    const results = await query.select("*");

    // console.log("✅ Results Found:", results.length);

    ctx.send({
      totalEntries: results.length,
      data: results
    });

  },

  async userStreamsFromPlatform(ctx) {
    try {
      /* 1️⃣ AUTH USER */
      const user = ctx.state.user;

      if (!user) {
        return ctx.unauthorized("Unauthorized");
      }

      /* 2️⃣ RANGE */
      const range = (ctx.query.range || "1M").toUpperCase();

      let limit = 1;

      if (range === "3M") {
        limit = 3;
      } else if (range === "6M") {
        limit = 6;
      }

      /* 3️⃣ GET USER TRACKS */
      const tracks = await strapi.db
        .query("api::distribute-track.distribute-track")
        .findMany({
          where: {
            PublishedRelease: {
              UserDetail: user.id,
            },
          },
          select: ["ISRC"],
        });

      if (!tracks.length) {
        return ctx.send({
          range,
          totalUnits: 0,
          platforms: [],
        });
      }

      const isrcList = tracks
        .map((track) => track.ISRC)
        .filter(Boolean);

      /* 4️⃣ FETCH USER ROYALTIES */
      const royalties = await strapi.db
        .query("api::royalty-report.royalty-report")
        .findMany({
          where: {
            ISRC: {
              $in: isrcList,
            },
            distribute_track: {
              PublishedRelease: {
                UserDetail: user.id,
              },
            },
          },
          select: [
            "ISRC",
            "Platform",
            "Units",
            "reportMonth",
            "reportYear",
          ],
          orderBy: [
            { reportYear: "desc" },
            { reportMonth: "desc" },
          ],
        });

      if (!royalties.length) {
        return ctx.send({
          range,
          totalUnits: 0,
          platforms: [],
        });
      }

      /* 5️⃣ GROUP BY REPORT MONTH */

      const monthMap = new Map();

      royalties.forEach((royalty) => {
        if (!royalty.reportMonth || !royalty.reportYear) return;

        const key = `${royalty.reportYear}-${royalty.reportMonth}`;

        if (!monthMap.has(key)) {
          monthMap.set(key, []);
        }

        monthMap.get(key).push({
          Platform: royalty.Platform,
          Units: Number(royalty.Units || 0),
        });
      });

      /* 6️⃣ TAKE LATEST MONTHS */

      const selectedRoyalties = [...monthMap.entries()]
        .sort((a, b) => {
          const [yearA, monthA] = a[0].split("-").map(Number);
          const [yearB, monthB] = b[0].split("-").map(Number);

          return (
            new Date(yearB, monthB - 1) -
            new Date(yearA, monthA - 1)
          );
        })
        .slice(0, limit)
        .flatMap(([, royalties]) => royalties);

      /* 7️⃣ GROUP BY PLATFORM */
      let totalUnits = 0;

      const platformMap = {};

      selectedRoyalties.forEach((item) => {
        const platform = item.Platform || "Unknown";
        const units = Number(item.Units || 0);

        totalUnits += units;

        if (!platformMap[platform]) {
          platformMap[platform] = {
            platform,
            totalUnits: 0,
            percentage: 0,
          };
        }

        platformMap[platform].totalUnits += units;
      });

      /* 8️⃣ CALCULATE PERCENTAGE */
      const result = Object.values(platformMap).map((platform) => ({
        ...platform,
        percentage: totalUnits
          ? ((platform.totalUnits / totalUnits) * 100).toFixed(2)
          : 0,
      }));

      /* 9️⃣ TOP 4 */
      const topPlatforms = result
        .sort((a, b) => b.totalUnits - a.totalUnits)
        .slice(0, 4);

      return ctx.send({
        range,
        totalUnits,
        platforms: topPlatforms,
      });
    } catch (err) {
      ctx.throw(500, err);
    }
  },

  async userStreamsFromCountries(ctx) {
    try {
      const user = ctx.state.user;

      if (!user) {
        return ctx.unauthorized("Unauthorized");
      }

      const range = (ctx.query.range || "1M").toUpperCase();

      let limit = 1;

      if (range === "3M") {
        limit = 3;
      } else if (range === "6M") {
        limit = 6;
      }

      /* ================= USER TRACKS ================= */

      const tracks = await strapi.db
        .query("api::distribute-track.distribute-track")
        .findMany({
          where: {
            PublishedRelease: {
              UserDetail: user.id,
            },
          },
          select: ["ISRC"],
        });

      if (!tracks.length) {
        return ctx.send({
          range,
          totalUnits: 0,
          countries: [],
        });
      }

      const isrcList = tracks
        .map((track) => track.ISRC)
        .filter(Boolean);

      /* ================= USER ROYALTIES ================= */

      const royalties = await strapi.db
        .query("api::royalty-report.royalty-report")
        .findMany({
          where: {
            ISRC: {
              $in: isrcList,
            },
            distribute_track: {
              PublishedRelease: {
                UserDetail: user.id,
              },
            },
          },
          select: [
            "Country",
            "Units",
            "reportMonth",
            "reportYear",
          ],
          orderBy: [
            { reportYear: "desc" },
            { reportMonth: "desc" },
          ],
        });

      if (!royalties.length) {
        return ctx.send({
          range,
          totalUnits: 0,
          countries: [],
        });
      }

      /* ================= GROUP BY REPORT MONTH ================= */

      const monthMap = new Map();

      royalties.forEach((royalty) => {
        if (!royalty.reportMonth || !royalty.reportYear) return;

        const key = `${royalty.reportYear}-${royalty.reportMonth}`;

        if (!monthMap.has(key)) {
          monthMap.set(key, []);
        }

        monthMap.get(key).push({
          Country: royalty.Country,
          Units: Number(royalty.Units || 0),
        });
      });
      /* ================= TAKE LATEST MONTHS ================= */

      const selectedRoyalties = [...monthMap.entries()]
        .sort((a, b) => {
          const [yearA, monthA] = a[0].split("-").map(Number);
          const [yearB, monthB] = b[0].split("-").map(Number);

          return (
            new Date(yearB, monthB - 1) -
            new Date(yearA, monthA - 1)
          );
        })
        .slice(0, limit)
        .flatMap(([, royalties]) => royalties);

      /* ================= COUNTRY UNITS ================= */

      let totalUnits = 0;

      const countryMap = {};

      selectedRoyalties.forEach((royalty) => {
        const country = royalty.Country || "Unknown";
        const units = Number(royalty.Units || 0);

        totalUnits += units;

        if (!countryMap[country]) {
          countryMap[country] = {
            country,
            units: 0,
          };
        }

        countryMap[country].units += units;
      });

      /* ================= TOP 5 COUNTRIES ================= */

      const countries = Object.values(countryMap)
        .map((country) => ({
          country: country.country,
          units: country.units,
        }))
        .sort((a, b) => b.units - a.units)
        .slice(0, 5);

      return ctx.send({
        range,
        totalUnits,
        countries,
      });
    } catch (err) {
      ctx.throw(500, err);
    }
  },

  async userTotalStreams(ctx) {
    try {
      const user = ctx.state.user;

      if (!user) {
        return ctx.unauthorized("Unauthorized");
      }

      /* ================= RANGE ================= */

      const range = (ctx.query.range || "1M").toUpperCase();

      let limit = 1;

      if (range === "3M") {
        limit = 3;
      } else if (range === "6M") {
        limit = 6;
      }

      /* ================= USER TRACKS ================= */

      const tracks = await strapi.db
        .query("api::distribute-track.distribute-track")
        .findMany({
          where: {
            PublishedRelease: {
              UserDetail: user.id,
            },
          },
          select: ["ISRC"],
        });

      if (!tracks.length) {
        return ctx.send({
          range,
          totalStreams: 0,
        });
      }

      const isrcList = tracks
        .map((track) => track.ISRC)
        .filter(Boolean);

      /* ================= USER ROYALTIES ================= */

      const royalties = await strapi.db
        .query("api::royalty-report.royalty-report")
        .findMany({
          where: {
            ISRC: {
              $in: isrcList,
            },
            distribute_track: {
              PublishedRelease: {
                UserDetail: user.id,
              },
            },
          },
          select: [
            "Units",
            "reportMonth",
            "reportYear",
          ],
        });

      if (!royalties.length) {
        return ctx.send({
          range,
          totalStreams: 0,
        });
      }


      /* ================= GROUP STREAMS BY MONTH ================= */
      const monthMap = new Map();

      royalties.forEach((royalty) => {
        if (!royalty.reportMonth || !royalty.reportYear) {
          return;
        }

        const key = `${royalty.reportYear}-${royalty.reportMonth}`;

        if (!monthMap.has(key)) {
          monthMap.set(key, {
            date: new Date(
              royalty.reportYear,
              royalty.reportMonth - 1,
              1
            ),
            totalStreams: 0,
          });
        }

        monthMap.get(key).totalStreams += Number(royalty.Units || 0);
      });
      /* ================= CHART ================= */

      const chart = [...monthMap.values()]
        .sort((a, b) => b.date - a.date)
        .slice(0, limit)
        .map((item) => ({
          month: item.date.toLocaleDateString("en-US", {
            month: "short",
            year: "numeric",
          }),
          totalStreams: Math.round(item.totalStreams),
        }));

      /* ================= GRAND TOTAL ================= */

      const totalStreams = chart.reduce(
        (sum, item) => sum + item.totalStreams,
        0
      );

      return ctx.send({
        range,
        totalStreams,
        chart,
      });

    } catch (err) {
      ctx.throw(500, err);
    }
  },

  async getUserEarningsPerMonth(ctx) {
    const userId = ctx.state.user.id;
    const range = ctx.query.range || "1M";

    let limit = 1;

    if (range === "3M") {
      limit = 3;
    } else if (range === "6M") {
      limit = 6;
    }

    const invoices = await strapi.entityService.findMany(
      "api::invoice.invoice",
      {
        filters: {
          users_permissions_user: userId,
        },
        fields: [
          "month",
          "year",
          "invoiceDate",
          "finalAmountPayable",
        ],
        sort: ["invoiceDate:desc"],
        limit,
      }
    );

    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    // oldest -> latest for frontend chart
    const monthly = invoices
      .reverse()
      .map(inv => ({
        month: `${monthNames[inv.month - 1]} ${inv.year}`,
        total: Number(
          Number(inv.finalAmountPayable || 0).toFixed(2)
        ),
      }));

    const totalEarnings = monthly.reduce(
      (sum, item) => sum + item.total,
      0
    );

    return {
      range,
      totalEarnings,
      monthly,
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