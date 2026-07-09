"use strict";

const fs = require("fs");
const csv = require("csv-parser");
const createActivityLog = require("../../../utils/activity-log");

/* FORMAT DATE */
function formatDate(dateStr) {
  if (!dateStr) return null;

  // already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // MM/DD/YYYY
  const parts = String(dateStr).split("/");

  if (parts.length === 3) {
    const [month, day, year] = parts;

    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const d = new Date(dateStr);

  if (isNaN(d.getTime())) return null;

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* SAFE NUMBER */
function toNumber(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return 0;
  }

  const cleaned = String(value)
    .replace(/,/g, "")
    .trim();

  const n = Number(cleaned);

  return isNaN(n) ? 0 : n;
}

function toDecimal(value, fieldName = "", digits = 20) {

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return 0;
  }

  const cleaned = String(value)
    .replace(/,/g, "")
    .trim();

  let num = Number(cleaned);

  if (isNaN(num)) {
    return 0;
  }

  /*
    ✅ Convert scientific notation
    into full decimal 
  */
  const decimalValue = num.toLocaleString("fullwide", {
    useGrouping: false,
    maximumFractionDigits: digits,
  });

  if (/e/i.test(cleaned)) {
    console.log(
      `🔄 [${fieldName}] ${cleaned} → ${decimalValue}`
    );
  }

  return decimalValue;
}

function normalizeISRC(isrc) {
  if (!isrc) return null;

  const clean = isrc
    .replace(/-/g, "")
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();

  // Convert AUBEC2469677 → AU-BEC-24-69677
  if (clean.length === 12) {
    return `${clean.slice(0, 2)}-${clean.slice(2, 5)}-${clean.slice(5, 7)}-${clean.slice(7)}`;
  }

  return clean;
}

/* PLATFORM NORMALIZER */
function normalizePlatform(platform) {
  if (!platform) return null;

  const p = platform.toLowerCase().trim();

  if (p.includes("spotify")) return "Spotify";

  if (p.includes("apple")) return "Apple Music";

  if (p.includes("youtube")) return "YouTube Music";

  if (p.includes("amazon")) return "Amazon Music";

  if (p.includes("deezer")) return "Deezer";

  if (p.includes("tidal")) return "Tidal";

  if (p.includes("yango")) return "Yango Play";

  if (p.includes("meta")) return "Meta";

  if (p.includes("peloton")) return "Peloton";

  if (p.includes("awa")) return "AWA";

  if (p.includes("itunes")) return "iTunes";

  if (p.includes("kdigital")) return "KDigital Media";

  if (p.includes("supernatural")) return "Supernatural";

  if (p.includes("tiktok")) return "TikTok";

  if (p.includes("mixcloud")) return "MixCloud";

  if (p.includes("qobuz")) return "Qobuz";

  if (p.includes("anghami")) return "Anghami";

  if (p.includes("beatport")) return "Beatport";

  if (p.includes("douyin")) return "DouYin";

  if (p.includes("jio saavn") || p.includes("saavn"))
    return "JioSaavn";

  if (p.includes("kkbox")) return "KKBox";

  if (p.includes("taobao")) return "Taobao";

  if (p.includes("tuned global")) return "Tuned Global";

  if (p.includes("soda")) return "Soda Music";

  if (p.includes("netease")) return "NetEase Cloud Music";

  if (p.includes("soundcloud")) return "SoundCloud";

  if (p.includes("boomplay")) return "Boomplay Music";

  if (p.includes("flo")) return "Flo";

  if (p.includes("joox")) return "JOOX";

  if (p.includes("lickd")) return "Lickd";

  if (p.includes("tencent")) return "Tencent";

  if (p.includes("udio")) return "Udio";

  if (p.includes("massive music")) return "Massive Music";

  if (p.includes("pandora")) return "Pandora";

  if (p.includes("soundexchange")) return "SoundExchange";

  if (p.includes("audible magic")) return "Audible Magic";

  if (p.includes("claro")) return "Claro Musica";

  if (p.includes("iheart")) return "iHeart";

  if (p.includes("kanjian")) return "Kanjian";

  if (p.includes("lissen")) return "Lissen";

  return platform.trim();
}

/* HEADER NORMALIZER */
function normalizeHeader(header) {
  if (!header) return header;

  let h = header
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase()
    .replace(/_+/g, "_")
    .trim();

  const map = {
    startdate: "start_date",
    enddate: "end_date",
    unitprice: "unit_price",
    currencyrate: "currency_rate",
    grosstotal: "gross_total",
    nettotal: "net_total",
    gross_total_client: "gross_total_client_currency",
    net_total_client: "net_total_client_currency",
    useremail: "user_email",
    platform: "channel",

    /* ✅ ADD THESE LINES */
    release: "release",
    releasetitle: "release",
    release_title: "release",

    upc: "upc",
    upccode: "upc",
    upc_code: "upc"
  };

  return map[h] || h;
}

module.exports = () => ({

  async importCSV(filepath, filename, commissionPercent = 15, platformCommissions = {}, user = null) {

    const rows = [];

    await new Promise((resolve) => {
      fs.createReadStream(filepath)
        .pipe(csv({
          mapHeaders: ({ header }) => normalizeHeader(header)
        }))
        .on("data", (data) => rows.push(data))
        .on("end", resolve);
    });

    if (!rows.length) {
      throw new Error("CSV file is empty");
    }

    /* REPORT PERIOD */
    let minStart = null;
    let maxEnd = null;

    rows.forEach((row) => {
      const start = new Date(formatDate(row.start_date));
      const end = new Date(formatDate(row.end_date));

      if (!minStart || start < minStart) minStart = start;
      if (!maxEnd || end > maxEnd) maxEnd = end;
    });

    const reportStartDate = formatDate(minStart);
    const reportEndDate = formatDate(maxEnd);

    console.log("🧠 Calculated Period:", reportStartDate, "→", reportEndDate);

    /* ❌ DO NOT CHANGE (DUPLICATE CHECK) */

    const reportExists = await strapi.db
      .query("api::imported-report.imported-report")
      .findMany({
        where: {
          $or: [
            {
              startDate: reportStartDate,
              endDate: reportEndDate
            },
            {
              startDate: { $lte: reportEndDate },
              endDate: { $gte: reportStartDate }
            }
          ]
        }
      });

    if (reportExists.length > 0) {
      throw new Error(
        `Report already exists for overlapping period (${reportStartDate} → ${reportEndDate})`
      );
    }

    /* ================= MERGE DUPLICATE ROWS ================= */

    const groupedRowsMap = {};

    rows.forEach((row) => {

      const isrc = normalizeISRC(row.isrc);
      const platform =
        normalizePlatform(row.channel);
      const country =
        (row.country || "").trim();

      const startDate =
        formatDate(row.start_date);

      const endDate =
        formatDate(row.end_date);

      // ✅ MERGE ONLY WHEN ALL MATCH
      const key =
        `${isrc}__${platform}__${country}__${startDate}__${endDate}`;

      console.log("🔑 MERGE KEY:", key);

      // ✅ FIRST ENTRY
      if (!groupedRowsMap[key]) {

        groupedRowsMap[key] = {

          // keep all fields from first row
          ...row,

          units:
            Number(
              toDecimal(
                row.units,
                "units"
              )
            ),

          gross_total:
            Number(
              toDecimal(
                row.gross_total,
                "gross_total"
              )
            ),

          net_total:
            Number(
              toDecimal(
                row.net_total,
                "net_total"
              )
            ),

          gross_total_client_currency:
            Number(
              toDecimal(
                row.gross_total_client_currency,
                "gross_total_client_currency"
              )
            ),

          net_total_client_currency:
            Number(
              toDecimal(
                row.net_total_client_currency,
                "net_total_client_currency"
              )
            ),
        };

      } else {

        // ✅ ONLY TOTAL THESE FIELDS

        const convertedUnits =
          Number(
            toDecimal(
              row.units,
              "units"
            )
          );

        const convertedGross =
          Number(
            toDecimal(
              row.gross_total,
              "gross_total"
            )
          );

        const convertedNet =
          Number(
            toDecimal(
              row.net_total,
              "net_total"
            )
          );

        const convertedGrossClient =
          Number(
            toDecimal(
              row.gross_total_client_currency,
              "gross_total_client_currency"
            )
          );

        const convertedNetClient =
          Number(
            toDecimal(
              row.net_total_client_currency,
              "net_total_client_currency"
            )
          );

        console.log("➕ MERGING VALUES", {
          key,
          convertedUnits,
          convertedGross,
          convertedNet,
          convertedGrossClient,
          convertedNetClient
        });

        groupedRowsMap[key].units +=
          convertedUnits;

        groupedRowsMap[key].gross_total +=
          convertedGross;

        groupedRowsMap[key].net_total +=
          convertedNet;

        groupedRowsMap[key]
          .gross_total_client_currency +=
          convertedGrossClient;

        groupedRowsMap[key]
          .net_total_client_currency +=
          convertedNetClient;
      }
    });

    // replace original rows with merged rows
    rows.length = 0;
    rows.push(
      ...Object.values(groupedRowsMap)
    );

    console.log(
      `🧠 Merged Rows Count: ${rows.length}`
    );

    /* ================= GROUP BY PLATFORM ================= */
    const platformGroups = {};

    rows.forEach((row, index) => {

      const platform =
        normalizePlatform(row.channel) || "UNKNOWN";

      if (!platformGroups[platform]) {
        platformGroups[platform] = [];
      }

      platformGroups[platform].push({
        ...row,
        __index: index
      });
    });

    /* ================= APPLY COMMISSION PER PLATFORM ================= */
    const adjustedMap = {};

    for (const platform in platformGroups) {

      const rowsInPlatform = platformGroups[platform];

      let platformTotal = 0;

      rowsInPlatform.forEach(r => {
        platformTotal += toNumber(r.net_total);
      });

      console.log(
        "💰 PLATFORM TOTAL BEFORE COMMISSION",
        {
          platform,
          platformTotal
        }
      );
      if (platformTotal === 0) continue;

      const commissionToApply =
        platformCommissions?.[platform] ?? commissionPercent;

      const rate = commissionToApply / 100;

      const platformRemaining =
        platformTotal * (1 - rate);

      console.log(
        "💸 PLATFORM COMMISSION APPLIED",
        {
          platform,
          commissionPercent: commissionToApply,
          platformTotal,
          platformRemaining
        }
      );

      rowsInPlatform.forEach(r => {

        const original = toNumber(r.net_total);

        /*
          ✅ Redistribute proportionally
          after applying commission
          on total platform earnings
        */

        const adjusted =
          platformTotal > 0
            ? (original / platformTotal) * platformRemaining
            : 0;

        adjustedMap[r.__index] = adjusted;
      });
    }

    /* LOAD TRACKS */
    const tracks = await strapi.db
      .query("api::distribute-track.distribute-track")
      .findMany({
        where: {
          Status: "Completed",
        },
        populate: {
          PublishedRelease: {
            select: ["id", "Status"]
          }
        },
        select: ["id", "ISRC", "Status"]
      });

    const trackMap = {};

    tracks.forEach((t) => {

      if (
        t.Status !== "Completed" ||
        t.PublishedRelease?.Status !== "Completed"
      ) {
        return;
      }

      const cleanISRC = normalizeISRC(t.ISRC);

      if (cleanISRC) {
        trackMap[cleanISRC] = t.id;
      }
    });

    let inserted = 0;
    let skipped = 0;
    let monthlyTotal = 0;
    let skippedTotal = 0;

    for (let i = 0; i < rows.length; i++) {

      const row = rows[i];
      const adjustedNet = adjustedMap[i];

      if (adjustedNet === undefined) {
        skipped++;

        const original = toNumber(row.net_total);
        skippedTotal += original;

        console.log(`⚠️ SKIPPED (NO ADJUSTED VALUE): Index ${i}`);

        continue;
      }

      const isrc = normalizeISRC(row.isrc);
      const platform = normalizePlatform(row.channel);

      if (!isrc) {
        skipped++;
        const original = toNumber(row.net_total);
        skippedTotal += original;
        continue;
      }

      const trackId = trackMap[isrc];
      if (!trackId) {
        skipped++;
        const original = toNumber(row.net_total);
        skippedTotal += original;
        continue;
      }

      monthlyTotal += adjustedNet;

      console.log(
        "🧾 INSERTING ROYALTY",
        {
          isrc,
          platform,
          country: row.country,
          adjustedNet: adjustedNet
        }
      );

      const startDate = formatDate(row.start_date);
      const endDate = formatDate(row.end_date);
      const confirmationDate = formatDate(row.confirmation_report_date);

      // Duplicate Check
      const existingRoyalty = await strapi.db
        .query("api::royalty-report.royalty-report")
        .findOne({
          where: {
            ISRC: isrc,
            Platform: platform,
            Country: row.country,
            StartDate: startDate,
            EndDate: endDate,
            UserEmail: row.user_email,
          },
        });

      if (existingRoyalty) {

        console.log(
          "⚠️ DUPLICATE ROYALTY SKIPPED",
          {
            isrc,
            platform,
            country: row.country,
            startDate,
            endDate,
            userEmail: row.user_email,
            existingRoyaltyId: existingRoyalty.id
          }
        );

        skipped++;

        continue;
      }

      /* ================= CREATE ================= */

      const created = await strapi.db
        .query("api::royalty-report.royalty-report")
        .create({
          data: {

            ISRC: isrc,

            TrackTitle: row.track_title,

            Artist: row.artist,

            ReleaseTitle: row.release || row.release_title || "",

            Platform: platform,

            Country: row.country,

            Currency: row.currency,

            StartDate: startDate,

            EndDate: endDate,

            ConfirmationReportDate: confirmationDate,

            Label: row.label || "",

            Type: row.type || "",

            Units: toNumber(row.units),

            UnitPrice: toDecimal(row.unit_price, "UnitPrice"),

            GrossTotal: toDecimal(row.gross_total, "GrossTotal"),

            NetTotal: toDecimal(adjustedNet, "NetTotal"),

            Taxes: toDecimal(row.taxes, "Taxes"),

            ChannelCosts: toDecimal(row.channel_costs, "ChannelCosts"),

            CurrencyRate: toDecimal(row.currency_rate, "CurrencyRate"),

            GrossTotalClientCurrency:
              toDecimal(
                row.gross_total_client_currency,
                "GrossTotalClientCurrency"
              ),

            NetTotalClientCurrency:
              toDecimal(
                row.net_total_client_currency,
                "NetTotalClientCurrency"
              ),

            OtherCostsClientCurrency:
              toDecimal(
                row.other_costs_client_currency,
                "OtherCostsClientCurrency"
              ),

            ChannelCostsClientCurrency:
              toDecimal(
                row.channel_costs_client_currency,
                "ChannelCostsClientCurrency"
              ),

            OriginalNetTotal:
              toDecimal(row.net_total, "OriginalNetTotal"),

            UserEmail: row.user_email,

            UPC: row.upc || "",

            TenantId: row.tenant_id,

            distribute_track: trackId,

            publishedAt: new Date()
          }
        });

      inserted++;
    }

    let originalTotal = 0;

    for (let i = 0; i < rows.length; i++) {
      originalTotal += toNumber(rows[i].net_total);
    }

    originalTotal = toDecimal(originalTotal);

    const importedReport = await strapi.db
      .query("api::imported-report.imported-report")
      .create({
        data: {
          startDate: reportStartDate,
          endDate: reportEndDate,
          FileName: filename,
          totalNet: toDecimal(monthlyTotal, "totalNet"),

          skippedNet: toDecimal(skippedTotal, "skippedNet"),

          CommissionPercent:
            toDecimal(commissionPercent, "CommissionPercent"),

          OriginalTotal:
            toDecimal(originalTotal, "OriginalTotal"),

          PlatformCommission: platformCommissions,
        }
      });

    console.log("🎉 IMPORT COMPLETED", {
      inserted,
      skipped,
      monthlyTotal,
      skippedTotal,
      originalTotal
    });

    const sample = await strapi.db
      .query("api::royalty-report.royalty-report")
      .findMany({
        limit: 3,
        select: ["id", "StartDate", "EndDate", "ISRC"],
      });

    console.log("Sample royalties:", sample);

    const matching = await strapi.db
      .query("api::royalty-report.royalty-report")
      .findMany({
        where: {
          StartDate: reportStartDate,
          EndDate: reportEndDate,
        },
        select: ["id", "StartDate", "EndDate"],
      });

    console.log("Matching via db.query:", matching.length);

    const royalties = await strapi.entityService.findMany(
  "api::royalty-report.royalty-report",
  {
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
  }
);

console.log("Royalties without filter:", royalties.length);

    if (user) {
      await createActivityLog({
        user,
        action: "Import",
        module: "Royalty Report",
        entityId: importedReport.id,
        entityName: filename,
        description: `Imported royalty report ${filename}. Inserted: ${inserted}, Skipped: ${skipped}`,
      });
    }

    /* 🔥 GENERATE INVOICES */
    await generateInvoices(reportStartDate, reportEndDate);

    return { inserted, skipped, monthlyTotal, skippedTotal, commissionPercent, originalTotal };


  },

});

/* ================= INVOICE GENERATION ================= */
async function generateInvoices(reportStartDate, reportEndDate) {

  console.log("========== GENERATE INVOICES START ==========");
  console.log({
    reportStartDate,
    reportEndDate,
  });

  try {

    const end = new Date(reportEndDate);

    const month = end.getMonth() + 1;
    const year = end.getFullYear();
    const currentDate = new Date();

    /* ================= FETCH ROYALTIES ================= */
    // const royalties = await strapi.entityService.findMany(
    //   "api::royalty-report.royalty-report",
    //   {
    //     filters: {
    //       StartDate: reportStartDate,
    //       EndDate: reportEndDate,
    //     },
    //     populate: {
    //       distribute_track: {
    //         populate: {
    //           PublishedRelease: {
    //             populate: {
    //               UserDetail: true,
    //             },
    //           },
    //         },
    //       },
    //     },
    //   }
    // );

    // console.log("📦 Royalties fetched:", royalties.length);

    let royalties;

    try {
      console.log("Fetching royalties...");

      royalties = await strapi.entityService.findMany(
        "api::royalty-report.royalty-report",
        {
          filters: {
            StartDate: reportStartDate,
            EndDate: reportEndDate,
          },
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
        }
      );

      console.log("Royalties fetched:", royalties.length);

    } catch (err) {
      console.error("FAILED TO FETCH ROYALTIES");
      console.error(err);
      console.error(err.stack);
      throw err;
    }

    if (!royalties.length) {
      console.log("⚠️ No royalties found");
      return;
    }

    /* ================= GROUP BY USER ================= */
    const userMap = {};

    for (const r of royalties) {

      const user =
        r.distribute_track?.PublishedRelease?.UserDetail;

      if (!user) {
        console.log("❌ No user found for royalty:", r.id);
        continue;
      }

      if (!userMap[user.id]) {
        userMap[user.id] = {
          totalEarnings: 0,
          user,
          royalties: [],
        };
      }

      // ✅ FIX FLOAT ISSUE
      userMap[user.id].totalEarnings =
        Number(
          (userMap[user.id].totalEarnings + Number(r.NetTotal || 0)).toFixed(2)
        );

      userMap[user.id].royalties.push(r);
    }

    console.log("👥 Total users grouped:", Object.keys(userMap).length);

    /* ================= PROCESS USERS ================= */
    for (const userId in userMap) {

      const { user, totalEarnings } = userMap[userId];

      console.log("➡️ Processing user:", user.id);
      console.log("💰 Total Earnings:", totalEarnings);

      if (!totalEarnings || totalEarnings <= 0) {
        // console.log("⚠️ Skipping (no earnings):", user.id);
        continue;
      }

      /* ================= DUPLICATE CHECK ================= */
      const existing = await strapi.entityService.findMany(
        "api::invoice.invoice",
        {
          filters: {
            users_permissions_user: user.id,
            month,
            year,
          },
        }
      );

      if (existing.length > 0) {
        console.log("⚠️ Invoice already exists:", user.id);
        continue;
      }

      /* ================= DETERMINE PLAN FOR ROYALTY MONTH ================= */

      const reportMonthDate = new Date(reportEndDate);

      const reportMonth = reportMonthDate.getMonth();
      const reportYear = reportMonthDate.getFullYear();

      /* ACTIVE SUBSCRIPTION */
      let activeSubscription = await strapi.db
        .query("api::user-subscription.user-subscription")
        .findOne({
          where: {
            users_permissions_user: user.id,
            status: "active",
          },
          populate: {
            plan: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        });

      /* IF NO ACTIVE SUBSCRIPTION, USE LATEST OLD SUBSCRIPTION */
      if (!activeSubscription) {

        console.log(
          `⚠️ No active subscription for user ${user.id}. Using latest subscription.`
        );

        activeSubscription = await strapi.db
          .query("api::user-subscription.user-subscription")
          .findOne({
            where: {
              users_permissions_user: user.id,
            },
            populate: {
              plan: true,
            },
            orderBy: {
              endDate: "desc",
            },
          });
      }

      if (!activeSubscription) {

        console.log(
          `⏭️ User ${user.id} skipped - no subscription found`
        );

        continue;
      }

      if (!activeSubscription?.plan?.isActive) {

        console.log(
          `⏭️ User ${user.id} skipped - plan inactive`
        );

        continue;
      }

      let subscriptionToUse = activeSubscription;

      console.log("=================================");
      console.log("USER:", user.id);
      console.log("REPORT MONTH:", reportMonth + 1);
      console.log("REPORT YEAR:", reportYear);
      console.log(
        "ACTIVE PLAN:",
        activeSubscription.plan?.name
      );
      console.log(
        "SUBSCRIPTION TYPE:",
        activeSubscription.subscriptionType
      );
      console.log(
        "UPGRADED AT:",
        activeSubscription.upgradedAt || "N/A"
      );

      /* HANDLE UPGRADE LOGIC */
      if (
        activeSubscription.subscriptionType === "upgrade" &&
        activeSubscription.upgradedAt
      ) {

        const upgradedAt = new Date(
          activeSubscription.upgradedAt
        );

        const upgradeMonth = upgradedAt.getMonth();
        const upgradeYear = upgradedAt.getFullYear();
        const upgradeDay = upgradedAt.getDate();

        console.log(
          "UPGRADE DATE:",
          upgradedAt.toISOString()
        );

        /* FETCH PREVIOUS SUBSCRIPTION */
        const previousSubscription = await strapi.db
          .query("api::user-subscription.user-subscription")
          .findOne({
            where: {
              users_permissions_user: user.id,
              createdAt: {
                $lt: activeSubscription.createdAt,
              },
            },
            populate: {
              plan: true,
            },
            orderBy: {
              createdAt: "desc",
            },
          });

        /* REPORT BEFORE UPGRADE MONTH */
        if (
          reportYear < upgradeYear ||
          (
            reportYear === upgradeYear &&
            reportMonth < upgradeMonth
          )
        ) {

          console.log(
            "📅 Report month before upgrade month."
          );

          if (previousSubscription?.plan) {
            subscriptionToUse = previousSubscription;

            console.log(
              "USING PREVIOUS PLAN:",
              previousSubscription.plan.name
            );
          }
        }

        /* REPORT IS UPGRADE MONTH */
        else if (
          reportYear === upgradeYear &&
          reportMonth === upgradeMonth
        ) {

          console.log(
            "📅 Report month is upgrade month."
          );

          if (upgradeDay <= 15) {

            console.log(
              "✅ Upgrade before/on 15th."
            );

            subscriptionToUse = activeSubscription;

          } else {

            console.log(
              "⚠️ Upgrade after 15th."
            );

            if (previousSubscription?.plan) {
              subscriptionToUse = previousSubscription;

              console.log(
                "USING PREVIOUS PLAN:",
                previousSubscription.plan.name
              );
            }
          }
        }

        /* REPORT AFTER UPGRADE MONTH */
        else {

          console.log(
            "✅ Report month after upgrade month."
          );

          subscriptionToUse = activeSubscription;
        }
      }

      const activePlan = subscriptionToUse.plan;

      const planName =
        activePlan?.name?.toLowerCase()?.trim();

      console.log(
        "FINAL PLAN USED:",
        activePlan?.name
      );
      console.log("=================================");

      /* ================= FETCH FEES ================= */
      const labelFeeData = await strapi.db
        .query("api::label-fee-history.label-fee-history")
        .findMany({
          where: {
            users_permissions_user: user.id,
            effective_from: {
              $lte: currentDate,
            },
          },
          orderBy: { effective_from: "desc" },
          limit: 1,
        });

      const adminFeeData = await strapi.db
        .query("api::admin-fee-history.admin-fee-history")
        .findMany({
          where: {
            users_permissions_user: user.id,
            effective_from: {
              $lte: currentDate,
            },
          },
          orderBy: { effective_from: "desc" },
          limit: 1,
        });


      let labelFee =
        labelFeeData[0]?.feePercentage ??
        user.labelFee ??
        0;

      let adminFee =
        adminFeeData[0]?.feePercentage ??
        user.adminFee ??
        0;

      const enterpriseCommissionData = await strapi.db
        .query("api::enterprise-commission.enterprise-commission")
        .findMany({
          where: {
            users_permissions_user: user.id,
            effective_from: {
              $lte: currentDate,
            },
          },
          orderBy: { effective_from: "desc" },
          limit: 1,
        });

      const enterpriseCommission =
        enterpriseCommissionData[0]?.commission_percentage ?? 0;

      console.log("💸 Fees:", {
        userId: user.id,
        labelFee,
        adminFee,
      });

      /* ================= CALCULATION ================= */

      let labelFeeAmount = 0;
      let adminFeeAmount = 0;

      let enterpriseCommissionPercentage = 0;
      let enterpriseCommissionAmount = 0;

      let afterLabel = totalEarnings;
      let finalAmount = totalEarnings;

      // ✅ ARTIST / ARTIST PLUS
      if (
        planName === "artist" ||
        planName === "artist plus"
      ) {

        // 🔥 OLD LOGIC KEPT SAME

        labelFeeAmount = Number(
          (totalEarnings * labelFee / 100).toFixed(2)
        );

        afterLabel = Number(
          (totalEarnings - labelFeeAmount).toFixed(2)
        );

        adminFeeAmount = Number(
          (afterLabel * adminFee / 100).toFixed(2)
        );

        finalAmount = Number(
          (afterLabel - adminFeeAmount).toFixed(2)
        );
      }

      // ✅ PRO LABEL
      else if (planName === "pro label") {

        // ✅ Never apply admin/label fee
        labelFeeAmount = 0;
        adminFeeAmount = 0;

        labelFee = 0;
        adminFee = 0;

        let totalCommissionAmount = 0;
        let totalPayable = 0;

        // ✅ If no commission entry exists -> use 0
        enterpriseCommissionPercentage =
          Number(enterpriseCommission || 0);

        // ✅ GROUP ROYALTIES BY ISRC
        const isrcTotals = {};

        for (const royalty of userMap[user.id].royalties) {

          const isrc =
            royalty.ISRC ||
            royalty.isrc ||
            "NO_ISRC";

          const amount = Number(
            royalty.NetTotal || 0
          );

          if (!isrcTotals[isrc]) {
            isrcTotals[isrc] = 0;
          }

          isrcTotals[isrc] = Number(
            (
              isrcTotals[isrc] + amount
            ).toFixed(2)
          );
        }

        // ✅ APPLY COMMISSION ON TOTAL OF EACH ISRC
        for (const isrc in isrcTotals) {

          const songTotal = Number(
            isrcTotals[isrc]
          );

          const commissionAmount = Number(
            (
              songTotal *
              enterpriseCommissionPercentage /
              100
            ).toFixed(2)
          );

          const payableAmount = Number(
            (
              songTotal -
              commissionAmount
            ).toFixed(2)
          );

          totalCommissionAmount = Number(
            (
              totalCommissionAmount +
              commissionAmount
            ).toFixed(2)
          );

          totalPayable = Number(
            (
              totalPayable +
              payableAmount
            ).toFixed(2)
          );
        }

        afterLabel = totalEarnings;

        enterpriseCommissionAmount =
          totalCommissionAmount;

        finalAmount = totalPayable;
      };

      console.log("=================================");
      console.log("USER ID:", user.id);
      console.log("PLAN:", planName);
      console.log("TOTAL EARNINGS:", totalEarnings);
      console.log("FINAL AMOUNT PAYABLE:", finalAmount);
      console.log("LABEL FEE:", labelFee);
      console.log("ADMIN FEE:", adminFee);
      console.log("ENTERPRISE COMMISSION:", enterpriseCommission);
      console.log("=================================");

      /* ================= CREATE INVOICE ================= */
      const createdInvoice = await strapi.entityService.create(
        "api::invoice.invoice",
        {
          data: {
            month,
            year,
            totalEarnings,

            labelFeePercentage: labelFee,
            labelFeeAmount,

            amountPayableBeforeAdminFee: afterLabel,

            adminFeePercentage: adminFee,
            adminFeeAmount,

            enterpriseCommissionPercentage,
            enterpriseCommissionAmount,

            finalAmountPayable: finalAmount,

            invoiceDate: new Date(),

            users_permissions_user: user.id,

            publishedAt: new Date(),
          },
        }
      );

      console.log("✅ Invoice created:", user.id);

      /* ================= 🔔 SEND NOTIFICATION ================= */
      try {
        await strapi.entityService.create("api::notification.notification", {
          data: {
            title: "Invoice Generated ",
            message: `Your invoice for ${month}/${year} is ready. Amount: ₹${finalAmount}`,
            users_permissions_user: user.id,
            publishedAt: new Date(),
          },
        });

        console.log("🔔 Notification created for user:", user.id);

      } catch (err) {
        console.error("❌ Notification error:", err);
      }

      console.log("✅ Invoice created:", user.id);
    }

    console.log("🎉 Invoice generation completed");

  } catch (error) {
    console.error("❌ Invoice generation error:", error);
  }
}
