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

/* Build a per-DSP override lookup keyed by channel name (raw and normalized).
   Each entry: { percent: number } */
function buildDspOverrideMap(dspOverrides) {
  const map = {};
  if (!Array.isArray(dspOverrides)) return map;

  for (const o of dspOverrides) {
    if (!o || o.channel === undefined || o.channel === null) continue;
    const pct = Number(o.percent);
    if (isNaN(pct)) continue;

    const raw = String(o.channel).trim();
    map[raw.toLowerCase()] = pct;

    const normalized = normalizePlatform(raw);
    if (normalized) {
      map[String(normalized).toLowerCase()] = pct;
    }
  }
  return map;
}

function lookupSonosuiteCut(channelRaw, channelNormalized, overrideMap, fallback) {
  if (overrideMap) {
    if (channelNormalized && overrideMap[String(channelNormalized).toLowerCase()] !== undefined) {
      return overrideMap[String(channelNormalized).toLowerCase()];
    }
    if (channelRaw && overrideMap[String(channelRaw).toLowerCase()] !== undefined) {
      return overrideMap[String(channelRaw).toLowerCase()];
    }
  }
  return fallback;
}

module.exports = () => ({

  /**
   * Imports a SonoSuite-style CSV and applies the 3-layer fee model.
   *
   * Backward-compatible signature:
   *   importCSV(filepath, filename, commissionPercent)        // legacy: number
   *   importCSV(filepath, filename, { sonosuiteCutPercent, dspOverrides, commissionPercent })
   *
   * 3-layer model (per row):
   *   gross         = net_total_client_currency (or net_total fallback)
   *   sonosuiteCut% = dspOverride[channel] ?? sonosuiteCutPercent ?? globalSettings.defaultSonosuiteCut
   *   afterSono     = gross * (1 - sonosuiteCut/100)
   *   platformFee%  = user.platformFeeOverride ?? globalSettings.defaultPlatformFee
   *   afterPlatform = afterSono * (1 - platformFee/100)
   *   commission%   = user.commissionOverride ?? plan.defaultCommission ?? commissionPercent (legacy fallback)
   *   artistEarn    = afterPlatform * (1 - commission/100)
   *
   * NetTotal stored on the royalty-report row is the artist-visible net (= artistEarnings),
   * preserving the existing reporting/dashboard semantics. The three applied %s and the
   * artistEarnings figure are stored explicitly for auditing.
   */
  async importCSV(filepath, filename, optionsOrCommission) {

    /* -------- Parse arguments (backward compat) -------- */
    let sonosuiteCutPercentArg;
    let dspOverridesArg;
    let commissionPercentArg;

    if (typeof optionsOrCommission === "object" && optionsOrCommission !== null) {
      sonosuiteCutPercentArg = optionsOrCommission.sonosuiteCutPercent;
      dspOverridesArg = optionsOrCommission.dspOverrides;
      commissionPercentArg = optionsOrCommission.commissionPercent;
    } else if (optionsOrCommission !== undefined) {
      commissionPercentArg = optionsOrCommission;
    }

    /* -------- Load global settings (defaults) -------- */
    const globalSettings = await strapi
      .service("api::global-setting.global-setting")
      .getOrCreate();

    const defaultSonoCut = Number(
      sonosuiteCutPercentArg ?? globalSettings.defaultSonosuiteCut ?? 15
    );
    const defaultPlatformFee = Number(
      globalSettings.defaultPlatformFee ?? 5
    );
    const fallbackCommission = Number(
      commissionPercentArg ?? 15
    );

    const dspOverrideMap = buildDspOverrideMap(dspOverridesArg);

    /* -------- Read CSV -------- */
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

    /* -------- Compute report period -------- */
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

    /* -------- Duplicate guard -------- */
    const reportExists = await strapi.db
      .query("api::imported-report.imported-report")
      .findOne({
        where: {
          startDate: reportStartDate,
          endDate: reportEndDate
        }
      });

    if (reportExists) {
      throw new Error(
        `Royalty report from ${reportStartDate} to ${reportEndDate} already uploaded`
      );
    }

    /* -------- Load tracks (id + ISRC + owning user) -------- */
    const tracks = await strapi.db
      .query("api::distribute-track.distribute-track")
      .findMany({
        select: ["id", "ISRC"],
        populate: {
          PublishedRelease: {
            populate: {
              UserDetail: {
                select: [
                  "id",
                  "platformFeeOverride",
                  "commissionOverride",
                  "availableBalance",
                ],
                populate: {
                  plan: {
                    select: ["defaultCommission"],
                  },
                },
              },
            },
          },
        },
      });

    const trackMap = {};
    const trackUserMap = {}; // trackId -> user record (with overrides + plan)
    tracks.forEach(t => {
      if (t.ISRC) {
        trackMap[t.ISRC.toUpperCase()] = t.id;
      }
      const u = t?.PublishedRelease?.UserDetail;
      if (u) {
        trackUserMap[t.id] = u;
      }
    });

    /* -------- Walk rows and apply 3-layer fees -------- */
    let inserted = 0;
    let skipped = 0;
    let monthlyTotal = 0;     // sum of artist-visible NetTotal
    let skippedTotal = 0;
    let originalGrossTotal = 0; // sum of pre-cut gross

    // Track per-user balance deltas to apply at the end
    const userBalanceDelta = {}; // userId -> sum of artistEarnings

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      const isrc = row.isrc?.trim().toUpperCase();
      const channelRaw = row.channel;
      const platform = normalizePlatform(channelRaw);

      if (!isrc) {
        skipped++;
        continue;
      }

      const trackId = trackMap[isrc];
      if (!trackId) {
        skipped++;
        skippedTotal += toNumber(row.net_total_client_currency || row.net_total);
        continue;
      }

      const user = trackUserMap[trackId] || null;

      // Gross figure for this row (prefer client currency)
      const gross = toNumber(
        row.net_total_client_currency || row.net_total
      );

      // Layer 1 — SonoSuite cut (per-DSP override > global default)
      const sonoCutPct = lookupSonosuiteCut(
        channelRaw,
        platform,
        dspOverrideMap,
        defaultSonoCut
      );
      const afterSono = gross * (1 - sonoCutPct / 100);

      // Layer 2 — Platform fee (user override > global default)
      const platformFeePct = Number(
        user?.platformFeeOverride ?? defaultPlatformFee
      );
      const afterPlatform = afterSono * (1 - platformFeePct / 100);

      // Layer 3 — Commission (user override > plan default > legacy CSV input)
      const commissionPct = Number(
        user?.commissionOverride ??
        user?.plan?.defaultCommission ??
        fallbackCommission
      );
      const artistEarnings = afterPlatform * (1 - commissionPct / 100);

      const round6 = (n) => Number(Number(n).toFixed(6));

      monthlyTotal += artistEarnings;
      originalGrossTotal += gross;

      if (user?.id) {
        userBalanceDelta[user.id] =
          (userBalanceDelta[user.id] || 0) + artistEarnings;
      }

      const startDate = formatDate(row.start_date);
      const endDate = formatDate(row.end_date);
      const confirmationDate = formatDate(row.confirmation_report_date);

      await strapi.db
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

            // Artist-visible net = post-commission
            NetTotal: round6(artistEarnings),

            StartDate: startDate,
            EndDate: endDate,
            ConfirmationReportDate: confirmationDate,
            Currency: row.currency,
            Label: row.label,
            Type: row.type,
            Taxes: toNumber(row.taxes),
            ChannelCosts: toNumber(row.channel_costs),
            CurrencyRate: toNumber(row.currency_rate),
            GrossTotalClientCurrency: toNumber(row.gross_total_client_currency),
            NetTotalClientCurrency: toNumber(row.net_total_client_currency),
            OtherCostsClientCurrency: toNumber(row.other_costs_client_currency),
            ChannelCostsClientCurrency: toNumber(row.channel_costs_client_currency),
            UserEmail: row.user_email,
            UPC: row.upc || "",
            TenantId: row.tenant_id,
            OriginalNetTotal: toNumber(row.net_total),

            // 3-layer audit fields
            SonosuiteCutApplied: sonoCutPct,
            PlatformFeeApplied: platformFeePct,
            CommissionApplied: commissionPct,
            ArtistEarnings: round6(artistEarnings),

            distribute_track: trackId,
            publishedAt: new Date(),
          },
        });

      inserted++;
    }

    /* -------- Update user available balances -------- */
    for (const userId in userBalanceDelta) {
      const delta = userBalanceDelta[userId];
      if (!delta) continue;

      const fresh = await strapi.db
        .query("plugin::users-permissions.user")
        .findOne({ where: { id: userId }, select: ["id", "availableBalance"] });

      if (!fresh) continue;

      const newBalance = Number(
        (Number(fresh.availableBalance || 0) + delta).toFixed(2)
      );

      await strapi.db
        .query("plugin::users-permissions.user")
        .update({
          where: { id: userId },
          data: { availableBalance: newBalance },
        });
    }

    /* -------- Persist imported-report metadata -------- */
    await strapi.db
      .query("api::imported-report.imported-report")
      .create({
        data: {
          startDate: reportStartDate,
          endDate: reportEndDate,
          FileName: filename,
          totalNet: Number(monthlyTotal.toFixed(6)),
          skippedNet: Number(skippedTotal.toFixed(6)),
          CommissionPercent: fallbackCommission,
          OriginalTotal: Number(originalGrossTotal.toFixed(6)),
        }
      });

    /* -------- Generate invoices using new 3-layer figures -------- */
    await generateInvoices(reportStartDate, reportEndDate, {
      defaultSonoCut,
      defaultPlatformFee,
    });

    return {
      inserted,
      skipped,
      monthlyTotal,
      skippedTotal,
      sonosuiteCutPercent: defaultSonoCut,
      platformFeePercent: defaultPlatformFee,
      commissionPercent: fallbackCommission,
      originalTotal: originalGrossTotal,
    };
  }

});

/* ================= INVOICE GENERATION ================= */
async function generateInvoices(reportStartDate, reportEndDate, defaults = {}) {

  try {

    const end = new Date(reportEndDate);
    const month = end.getMonth() + 1;
    const year = end.getFullYear();

    /* -------- Fetch royalties for the period (with audit fields) -------- */
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

    if (!royalties.length) return;

    /* -------- Group per user with all 3 layers -------- */
    const userMap = {};

    for (const r of royalties) {
      const user = r.distribute_track?.PublishedRelease?.UserDetail;
      if (!user) continue;

      if (!userMap[user.id]) {
        userMap[user.id] = {
          user,
          grossClient: 0,         // pre-SonoSuite cut
          sonoCutAmount: 0,
          afterSono: 0,
          platformFeeAmount: 0,
          afterPlatform: 0,
          commissionAmount: 0,
          artistEarnings: 0,      // = afterCommission
        };
      }

      const m = userMap[user.id];

      const gross = Number(r.NetTotalClientCurrency || r.OriginalNetTotal || 0);
      const sonoPct = Number(r.SonosuiteCutApplied ?? defaults.defaultSonoCut ?? 15);
      const platformPct = Number(r.PlatformFeeApplied ?? defaults.defaultPlatformFee ?? 5);
      const commissionPct = Number(r.CommissionApplied ?? 0);

      const sonoCutAmt = gross * (sonoPct / 100);
      const afterSono = gross - sonoCutAmt;
      const platformAmt = afterSono * (platformPct / 100);
      const afterPlatform = afterSono - platformAmt;
      const commissionAmt = afterPlatform * (commissionPct / 100);
      const artistEarn = Number(r.ArtistEarnings ?? (afterPlatform - commissionAmt));

      m.grossClient += gross;
      m.sonoCutAmount += sonoCutAmt;
      m.afterSono += afterSono;
      m.platformFeeAmount += platformAmt;
      m.afterPlatform += afterPlatform;
      m.commissionAmount += commissionAmt;
      m.artistEarnings += artistEarn;
    }

    /* -------- Process each user -------- */
    for (const userId in userMap) {
      const m = userMap[userId];
      const { user } = m;

      const totalEarnings = Number(m.artistEarnings.toFixed(2));
      if (totalEarnings <= 0) continue;

      // Duplicate-month guard
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

      if (existing.length > 0) continue;

      // Map new layered amounts onto the existing invoice schema:
      //   labelFeePercentage / labelFeeAmount  ← commission (artist-visible)
      //   adminFeePercentage / adminFeeAmount  ← platform fee + sono cut (hidden bundle)
      const grossForInvoice = Number(m.afterPlatform.toFixed(2)); // post-platform-fee, pre-commission

      const commissionPctEffective =
        grossForInvoice > 0
          ? Number(((m.commissionAmount / grossForInvoice) * 100).toFixed(2))
          : 0;

      const hiddenAmount = Number(
        (m.sonoCutAmount + m.platformFeeAmount).toFixed(2)
      );
      const hiddenPct =
        m.grossClient > 0
          ? Number(((hiddenAmount / m.grossClient) * 100).toFixed(2))
          : 0;

      const createdInvoice = await strapi.entityService.create(
        "api::invoice.invoice",
        {
          data: {
            month,
            year,

            // Total earnings = grossForInvoice (after the hidden cuts; what artist sees as gross)
            totalEarnings: grossForInvoice,

            // labelFee* = commission (artist-visible)
            labelFeePercentage: commissionPctEffective,
            labelFeeAmount: Number(m.commissionAmount.toFixed(2)),

            amountPayableBeforeAdminFee: totalEarnings,

            // adminFee* = SonoSuite cut + platform fee (hidden bundle, kept off the artist UI)
            adminFeePercentage: hiddenPct,
            adminFeeAmount: hiddenAmount,

            finalAmountPayable: totalEarnings,

            invoiceDate: new Date(),
            users_permissions_user: user.id,
            publishedAt: new Date(),
          },
        }
      );

      try {
        await strapi.entityService.create("api::notification.notification", {
          data: {
            title: "Invoice Generated ",
            message: `Your invoice for ${month}/${year} is ready. Amount: ₹${totalEarnings}`,
            users_permissions_user: user.id,
            publishedAt: new Date(),
          },
        });
      } catch (err) {
        // swallow notification errors
      }
    }

  } catch (error) {
    // console.error("❌ Invoice generation error:", error);
  }
}
