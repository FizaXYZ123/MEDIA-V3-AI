"use strict";

const fs = require("fs");
const csv = require("csv-parser");

/* FORMAT DATE */
function formatDate(dateStr) {
  if (!dateStr) return null;

  // ✅ FIX: parse MM/DD/YYYY manually
  const parts = String(dateStr).split("/");

  if (parts.length === 3) {
    const [month, day, year] = parts;

    const d = new Date(
      Number(year),
      Number(month) - 1,
      Number(day)
    );

    return d.toISOString().split("T")[0];
  }

  // fallback
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;

  return d.toISOString().split("T")[0];
}


/* SAFE NUMBER */
function toNumber(value) {
  if (value === undefined || value === null) return 0;
  const cleaned = String(value).replace(/,/g, "").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

/* PLATFORM NORMALIZER */
function normalizePlatform(platform) {
  if (!platform) return null;
  const p = platform.toLowerCase().trim();

  if (p.includes("youtube")) return "YouTube Music";
  if (p.includes("apple")) return "Apple Music";
  if (p.includes("spotify")) return "Spotify";
  if (p.includes("amazon")) return "Amazon Music";
  if (p.includes("deezer")) return "Deezer";

  return platform;
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

  async importCSV(filepath, filename, commissionPercent = 15, platformCommissions = {}) {

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

    /* ================= GROUP BY ISRC ================= */
    const isrcGroups = {};

    rows.forEach((row, index) => {
      const isrc = row.isrc?.trim().toUpperCase();
      if (!isrc) return;

      if (!isrcGroups[isrc]) {
        isrcGroups[isrc] = [];
      }

      isrcGroups[isrc].push({ ...row, __index: index });
    });

    /* ================= APPLY 15% COMMISSION ================= */
    const adjustedMap = {};

    for (const isrc in isrcGroups) {
      const group = isrcGroups[isrc];

      let totalNet = 0;

      group.forEach(r => {
        totalNet += toNumber(r.net_total);
      });

      if (totalNet === 0) continue;

      /******** GROUP BY PLATFORM INSIDE ISRC ********/
      const platformGroups = {};

      group.forEach(r => {
        const platform = normalizePlatform(r.channel) || "UNKNOWN";

        if (!platformGroups[platform]) {
          platformGroups[platform] = [];
        }

        platformGroups[platform].push(r);
      });

      /******** APPLY COMMISSION PER PLATFORM ********/
      for (const platform in platformGroups) {
        const rowsInPlatform = platformGroups[platform];

        let platformTotal = 0;

        rowsInPlatform.forEach(r => {
          platformTotal += toNumber(r.net_total);
        });

        const commissionToApply =
          platformCommissions?.[platform] ?? commissionPercent;

        const rate = commissionToApply / 100;

        const platformRemaining = platformTotal * (1 - rate);

        rowsInPlatform.forEach(r => {
          const original = toNumber(r.net_total);

          const adjusted =
            platformTotal > 0
              ? (original / platformTotal) * platformRemaining
              : 0;

          adjustedMap[r.__index] = Number(adjusted.toFixed(6));
        });
      }
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

    /* LOAD TRACKS */
    const tracks = await strapi.db
      .query("api::distribute-track.distribute-track")
      .findMany({
        select: ["id", "ISRC"]
      });

    const trackMap = {};
    tracks.forEach(t => {
      if (t.ISRC) {
        trackMap[t.ISRC.toUpperCase()] = t.id;
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

      const isrc = row.isrc?.trim().toUpperCase();
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

      const startDate = formatDate(row.start_date);
      const endDate = formatDate(row.end_date);
      const confirmationDate = formatDate(row.confirmation_report_date);

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

            Units: toNumber(row.units),

            UnitPrice: toNumber(row.unit_price),

            GrossTotal: toNumber(row.gross_total),

            NetTotal: adjustedNet,

            StartDate: startDate,

            EndDate: endDate,
            ConfirmationReportDate: confirmationDate,

            Currency: row.currency,

            Label: row.label,
            Type: row.type,

            Taxes: toNumber(row.taxes),
            ChannelCosts: toNumber(row.channel_costs),

            CurrencyRate: toNumber(row.currency_rate),

            GrossTotalClientCurrency:
              toNumber(row.gross_total_client_currency),

            NetTotalClientCurrency:
              toNumber(row.net_total_client_currency),

            OtherCostsClientCurrency:
              toNumber(row.other_costs_client_currency),

            ChannelCostsClientCurrency:
              toNumber(row.channel_costs_client_currency),

            UserEmail: row.user_email,

            UPC: row.upc || "",

            TenantId: row.tenant_id,

            OriginalNetTotal: toNumber(row.net_total),

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

    originalTotal = Number(originalTotal.toFixed(6));

    await strapi.db
      .query("api::imported-report.imported-report")
      .create({
        data: {
          startDate: reportStartDate,
          endDate: reportEndDate,
          FileName: filename,
          totalNet: monthlyTotal,
          skippedNet: skippedTotal,
          CommissionPercent: commissionPercent,
          PlatformCommission: platformCommissions,
          OriginalTotal: Number(originalTotal.toFixed(6)),

        }
      });

    console.log({ inserted, skipped });

    /* 🔥 GENERATE INVOICES */
    await generateInvoices(reportStartDate, reportEndDate);

    return { inserted, skipped, monthlyTotal, skippedTotal, commissionPercent, originalTotal };


  }

});

/* ================= INVOICE GENERATION ================= */
async function generateInvoices(reportStartDate, reportEndDate) {

  // console.log("🔥 Invoice generation started");
  // console.log("📅 Period:", reportStartDate, "→", reportEndDate);

  try {

    const end = new Date(reportEndDate);

    const month = end.getMonth() + 1;
    const year = end.getFullYear();

    // console.log("📆 Invoice Month:", month, year);
    /* ================= FETCH ROYALTIES ================= */
    const royalties = await strapi.entityService.findMany(
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

    // console.log("📦 Royalties fetched:", royalties.length);

    if (!royalties.length) {
      // console.log("⚠️ No royalties found");
      return;
    }

    /* ================= GROUP BY USER ================= */
    const userMap = {};

    for (const r of royalties) {

      const user =
        r.distribute_track?.PublishedRelease?.UserDetail;

      if (!user) {
        // console.log("❌ No user found for royalty:", r.id);
        continue;
      }

      if (!userMap[user.id]) {
        userMap[user.id] = {
          totalEarnings: 0,
          user,
        };
      }

      // ✅ FIX FLOAT ISSUE
      userMap[user.id].totalEarnings =
        Number(
          (userMap[user.id].totalEarnings + Number(r.NetTotal || 0)).toFixed(2)
        );
    }

    // console.log("👥 Total users grouped:", Object.keys(userMap).length);

    /* ================= PROCESS USERS ================= */
    for (const userId in userMap) {

      const { user, totalEarnings } = userMap[userId];

      // console.log("➡️ Processing user:", user.id);
      // console.log("💰 Total Earnings:", totalEarnings);

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
        // console.log("⚠️ Invoice already exists:", user.id);
        continue;
      }

      /* ================= FETCH FEES (FIXED) ================= */
      const labelFeeData = await strapi.db
        .query("api::label-fee-history.label-fee-history")
        .findMany({
          where: {
            users_permissions_user: user.id,
          },
          orderBy: { effective_from: "desc" },
          limit: 1,
        });

      const adminFeeData = await strapi.db
        .query("api::admin-fee-history.admin-fee-history")
        .findMany({
          where: {
            users_permissions_user: user.id,
          },
          orderBy: { effective_from: "desc" },
          limit: 1,
        });


      const labelFee =
        labelFeeData[0]?.feePercentage ??
        user.labelFee ??
        0;

      const adminFee =
        adminFeeData[0]?.feePercentage ??
        user.adminFee ??
        0;

      // console.log("💸 Fees:", {
      //   userId: user.id,
      //   labelFee,
      //   adminFee,
      // });

      /* ================= CALCULATION ================= */
      const labelFeeAmount = Number((totalEarnings * labelFee / 100).toFixed(2));
      const afterLabel = Number((totalEarnings - labelFeeAmount).toFixed(2));

      const adminFeeAmount = Number((afterLabel * adminFee / 100).toFixed(2));
      const finalAmount = Number((afterLabel - adminFeeAmount).toFixed(2));

      // console.log("🧮 Calculation:", {
      //   totalEarnings,
      //   labelFeeAmount,
      //   afterLabel,
      //   adminFeeAmount,
      //   finalAmount,
      // });

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

            finalAmountPayable: finalAmount,

            invoiceDate: new Date(),

            users_permissions_user: user.id,

            publishedAt: new Date(),
          },
        }
      );

      // console.log("✅ Invoice created:", user.id);

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

        // console.log("🔔 Notification created for user:", user.id);

      } catch (err) {
        // console.error("❌ Notification error:", err);
      }

      // console.log("✅ Invoice created:", user.id);
    }

    // console.log("🎉 Invoice generation completed");

  } catch (error) {
    // console.error("❌ Invoice generation error:", error);
  }
}