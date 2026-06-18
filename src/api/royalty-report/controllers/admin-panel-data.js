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
        const months = Number(ctx.query.months || 1);

        const invoices = await strapi.db
          .query("api::invoice.invoice")
          .findMany({
            select: ["month", "year", "finalAmountPayable"],
            orderBy: [
              { year: "desc" },
              { month: "desc" },
            ],
          });

        if (!invoices.length) {
          return ctx.send({
            totalEarnings: 0,
          });
        }

        const latestYear = invoices[0].year;
        const latestMonth = invoices[0].month;

        const latestDate = new Date(latestYear, latestMonth - 1, 1);

        const startDate = new Date(latestDate);
        startDate.setMonth(startDate.getMonth() - (months - 1));

        let totalEarnings = 0;

        for (const invoice of invoices) {
          const invoiceDate = new Date(
            invoice.year,
            invoice.month - 1,
            1
          );

          if (
            invoiceDate >= startDate &&
            invoiceDate <= latestDate
          ) {
            totalEarnings += Number(
              invoice.finalAmountPayable || 0
            );
          }
        }

        return ctx.send({
          totalEarnings,
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
        const months = Number(ctx.query.months || 1);

        const allRoyalties = await strapi.db
          .query("api::royalty-report.royalty-report")
          .findMany({
            select: [
              "ISRC",
              "TrackTitle",
              "Artist",
              "NetTotal",
              "Units",
              "StartDate",
              "EndDate",
            ],
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
          });

        // console.log("allRoyalties:", allRoyalties.length);

        if (allRoyalties.length) {
          console.log(
            "sample royalty:",
            JSON.stringify(allRoyalties[0], null, 2)
          );
        }

        if (!allRoyalties.length) {
          return ctx.send([]);
        }

        /* ================= FIND LATEST ROYALTY PERIOD ================= */

        const sortedRoyalties = [...allRoyalties].sort((a, b) => {
          const dateA = new Date(a.EndDate || a.StartDate);
          const dateB = new Date(b.EndDate || b.StartDate);

          return dateB - dateA;
        });

        const latestRoyaltyDate = new Date(
          sortedRoyalties[0].EndDate ||
          sortedRoyalties[0].StartDate
        );

        const latestYear = latestRoyaltyDate.getFullYear();
        const latestMonth = latestRoyaltyDate.getMonth() + 1;

        const latestDate = new Date(
          latestYear,
          latestMonth - 1,
          1
        );

        const startDate = new Date(latestDate);
        startDate.setMonth(
          startDate.getMonth() - (months - 1)
        );

        const royalties = allRoyalties.filter((royalty) => {
          const royaltyDate = new Date(
            royalty.EndDate || royalty.StartDate
          );

          const royaltyMonthDate = new Date(
            royaltyDate.getFullYear(),
            royaltyDate.getMonth(),
            1
          );

          return (
            royaltyMonthDate >= startDate &&
            royaltyMonthDate <= latestDate
          );
        });

        /* ================= GROUP BY ISRC ================= */

        const trackMap = {};

        for (const royalty of royalties) {
          const isrc = royalty.ISRC || "UNKNOWN";

          if (!trackMap[isrc]) {
            trackMap[isrc] = {
              ISRC: royalty.ISRC,
              TrackTitle: royalty.TrackTitle,
              Artist: royalty.Artist,
              totalUnits: 0,
              grossEarnings: 0,
              user:
                royalty.distribute_track?.PublishedRelease
                  ?.UserDetail || null,
            };
          }

          trackMap[isrc].grossEarnings = Number(
            (
              trackMap[isrc].grossEarnings +
              Number(royalty.NetTotal || 0)
            ).toFixed(2)
          );

          trackMap[isrc].totalUnits += Number(
            royalty.Units || 0
          );
        }

        const userTotals = {};

        for (const isrc in trackMap) {
          const track = trackMap[isrc];
          const userId = track.user?.id;

          if (!userId) continue;

          if (!userTotals[userId]) {
            userTotals[userId] = 0;
          }

          userTotals[userId] = Number(
            (
              userTotals[userId] +
              Number(track.grossEarnings || 0)
            ).toFixed(2)
          );
        }

        // console.log("=================================");
        // console.log(
        //   "Tracks Found:",
        //   Object.keys(trackMap).length
        // );
        // console.log(
        //   "Sample Track:",
        //   trackMap[Object.keys(trackMap)[0]]
        // );
        // console.log("=================================");

        const results = [];
        const userCache = {};

        /* ================= APPLY FFE LOGIC ================= */

        for (const isrc in trackMap) {
          const track = trackMap[isrc];

          const user = track.user;

          if (!user) {
            console.log(
              "❌ NO USER FOUND FOR TRACK:",
              track.TrackTitle,
              track.ISRC
            );
            continue;
          }

          if (!userCache[user.id]) {
            const currentDate = new Date();

            const subscriptions = await strapi.db
              .query("api::user-subscription.user-subscription")
              .findMany({
                where: {
                  users_permissions_user: user.id,
                },
                populate: {
                  plan: true,
                },
                orderBy: {
                  startDate: "asc",
                },
              });

            const labelFeeData = await strapi.db
              .query("api::label-fee-history.label-fee-history")
              .findMany({
                where: {
                  users_permissions_user: user.id,
                  effective_from: {
                    $lte: currentDate,
                  },
                },
                orderBy: {
                  effective_from: "desc",
                },
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
                orderBy: {
                  effective_from: "desc",
                },
                limit: 1,
              });

            const enterpriseCommissionData = await strapi.db
              .query(
                "api::enterprise-commission.enterprise-commission"
              )
              .findMany({
                where: {
                  users_permissions_user: user.id,
                  effective_from: {
                    $lte: currentDate,
                  },
                },
                orderBy: {
                  effective_from: "desc",
                },
                limit: 1,
              });

            userCache[user.id] = {
              subscriptions,
              labelFeeData,
              adminFeeData,
              enterpriseCommissionData,
            };
          }

          const {
            subscriptions,
            labelFeeData,
            adminFeeData,
            enterpriseCommissionData,
          } = userCache[user.id];


          // console.log(
          //   "Subscriptions Found:",
          //   subscriptions.length
          // );

          if (!subscriptions.length) {
            console.log(
              "❌ NO SUBSCRIPTIONS FOUND FOR USER:",
              user.id
            );

            results.push({
              ISRC: track.ISRC,
              TrackTitle: track.TrackTitle,
              Artist: track.Artist,
              totalUnits: track.totalUnits,
              totalEarnings: Number(
                track.grossEarnings.toFixed(2)
              ),
            });

            continue;
          }

          const latestSubscription =
            subscriptions[subscriptions.length - 1];

          // console.log("=================================");
          // console.log(
          //   "Selected Subscription:",
          //   latestSubscription.id
          // );
          // console.log(
          //   "Status:",
          //   latestSubscription.status
          // );
          // console.log(
          //   "Plan:",
          //   latestSubscription.plan?.name
          // );
          // console.log(
          //   "Start Date:",
          //   latestSubscription.startDate
          // );
          // console.log(
          //   "End Date:",
          //   latestSubscription.endDate
          // );
          // console.log("=================================");

          const activePlan =
            latestSubscription.plan;

          const planName =
            activePlan?.name?.toLowerCase()?.trim();


          let labelFee =
            labelFeeData[0]?.feePercentage ??
            user.labelFee ??
            0;

          let adminFee =
            adminFeeData[0]?.feePercentage ??
            user.adminFee ??
            0;

          const enterpriseCommission =
            enterpriseCommissionData[0]
              ?.commission_percentage ?? 0;

          // console.log("Label Fee:", labelFee);
          // console.log("Admin Fee:", adminFee);
          // console.log(
          //   "Enterprise Commission:",
          //   enterpriseCommission
          // );

          const songTotal = Number(
            track.grossEarnings || 0
          );

          const totalUserEarnings =
            userTotals[user.id] || 0;

          let finalAmount = songTotal;

          /* ================= ARTIST / ARTIST PLUS ================= */

          if (
            planName === "artist" ||
            planName === "artist plus"
          ) {
            const labelFeeAmount = Number(
              (
                (totalUserEarnings * labelFee) /
                100
              ).toFixed(2)
            );

            const afterLabel = Number(
              (
                totalUserEarnings -
                labelFeeAmount
              ).toFixed(2)
            );

            const adminFeeAmount = Number(
              (
                (afterLabel * adminFee) /
                100
              ).toFixed(2)
            );

            const userFinalAmount = Number(
              (
                afterLabel -
                adminFeeAmount
              ).toFixed(2)
            );

            const ratio =
              totalUserEarnings > 0
                ? songTotal / totalUserEarnings
                : 0;

            finalAmount =
              userFinalAmount * ratio;
          }
          /* ================= PRO LABEL ================= */

          else if (planName === "pro label") {
            const commissionAmount = Number(
              (
                (songTotal *
                  enterpriseCommission) /
                100
              ).toFixed(2)
            );

            finalAmount = Number(
              (
                songTotal -
                commissionAmount
              ).toFixed(2)
            );
          }

          results.push({
            ISRC: track.ISRC,
            TrackTitle: track.TrackTitle,
            Artist: track.Artist,
            totalUnits: track.totalUnits,
            totalEarnings: Number(
              finalAmount.toFixed(2)
            ),
          });
        }

        return ctx.send(results);
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