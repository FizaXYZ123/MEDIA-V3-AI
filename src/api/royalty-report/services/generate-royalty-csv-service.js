const {
    createCoreService,
} = require("@strapi/strapi").factories;

const { Parser } = require("json2csv");
const createUserActivityLog = require("../../../utils/user-activity-log");

module.exports = createCoreService(
    "api::royalty-report.royalty-report",
    ({ strapi }) => ({

        async generateCsvReport(ctx) {

            try {

                console.log("==================================");
                console.log("🚀 CSV EXPORT STARTED");
                console.log("==================================");

                const { startMonth, endMonth } =
                    ctx.query;

                const [startYear, startMonthNumber] = startMonth
                    .split("-")
                    .map(Number);

                const [endYear, endMonthNumber] = endMonth
                    .split("-")
                    .map(Number);

                const startValue = startYear * 100 + startMonthNumber;
                const endValue = endYear * 100 + endMonthNumber;

                const userId =
                    ctx.state.user.id;

                console.log("👤 User ID:", userId);

                const log = await createUserActivityLog({
                    userId,
                    action: "CSV Report Requested",
                    description: `Requested royalty CSV report from ${startMonth} to ${endMonth}`,
                });

                /* ================= CHECK EXISTING REPORT ================= */

                const existingReport =
                    await strapi.db
                        .query("api::csv-report-log.csv-report-log")
                        .findOne({
                            where: {
                                users_permissions_user:
                                    userId,

                                startMonth,

                                endMonth,
                            },
                        });

                if (existingReport) {

                    console.log(
                        "⚠️ Report already generated"
                    );

                    return ctx.send({
                        success: true,

                        message:
                            "Report already generated. Download it from logs",

                        reportId:
                            existingReport.id,
                    });
                    return;
                }

                /* ================= FETCH ROYALTIES ================= */

                const royalties =
                    await strapi.entityService.findMany(
                        "api::royalty-report.royalty-report",
                        {
                            filters: {
                                reportYear: {
                                    $gte: startYear,
                                    $lte: endYear,
                                },

                                distribute_track: {
                                    PublishedRelease: {
                                        UserDetail: {
                                            id: userId,
                                        },
                                    },
                                },
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

                console.log(
                    "📦 Royalties Fetched:",
                    royalties.length
                );

                /* ================= FILTER & GROUP ROYALTIES ================= */

                const groupedRoyalties = new Map();

                for (const royalty of royalties) {

                    if (!royalty.reportYear || !royalty.reportMonth) {
                        continue;
                    }

                    const value =
                        royalty.reportYear * 100 + royalty.reportMonth;

                    if (
                        value < startValue ||
                        value > endValue
                    ) {
                        continue;
                    }

                    const key =
                        `${royalty.reportYear}-${royalty.reportMonth}`;

                    if (!groupedRoyalties.has(key)) {

                        groupedRoyalties.set(key, {
                            reportYear: royalty.reportYear,
                            reportMonth: royalty.reportMonth,
                            royalties: [],
                        });

                    }

                    groupedRoyalties
                        .get(key)
                        .royalties
                        .push(royalty);
                }

                if (!groupedRoyalties.size) {

                    console.log(
                        "⚠️ Report does not exist"
                    );

                    ctx.body = {
                        success: false,
                        message: "Report does not exist",
                    };

                    return;
                }

                /* ================= USER ================= */

                const firstGroup =
                    [...groupedRoyalties.values()][0];

                const user =
                    firstGroup.royalties[0]
                        ?.distribute_track
                        ?.PublishedRelease
                        ?.UserDetail;

                if (!user) {

                    console.log(
                        "❌ User not found"
                    );

                    return ctx.badRequest(
                        "User not found"
                    );
                }

                console.log(
                    "👤 User Found:",
                    {
                        id: user.id,
                        username: user.username,
                    }
                );

                /* ================= FINAL ROWS ================= */

                const finalRows = [];

                let totalAdjustedNetTotal = 0;
                let grandTotalUnits = 0;

                for (const group of groupedRoyalties.values()) {

                    const filteredRoyalties = group.royalties;

                    const reportMonth = group.reportMonth;
                    const reportYear = group.reportYear;

                    console.log("=================================");
                    console.log("Processing:", reportMonth, reportYear);
                    console.log("Royalties:", filteredRoyalties.length);

                    const totalEarnings = filteredRoyalties.reduce(
                        (sum, royalty) => sum + Number(royalty.NetTotal || 0),
                        0
                    );

                    const totalUnits = filteredRoyalties.reduce(
                        (sum, royalty) => sum + Number(royalty.Units || 0),
                        0
                    );

                    grandTotalUnits += totalUnits;

                    const invoiceMonthEnd = new Date(
                        reportYear,
                        reportMonth - 1,
                        new Date(reportYear, reportMonth, 0).getDate(),
                        23,
                        59,
                        59,
                        999
                    );

                    /* ================= DETERMINE PLAN ================= */

                    const invoiceMonthStart = new Date(
                        reportYear,
                        reportMonth - 1,
                        1
                    );

                    /* ACTIVE SUBSCRIPTION */
                    let activeSubscription = await strapi.db
                        .query("api::user-subscription.user-subscription")
                        .findOne({
                            where: {
                                users_permissions_user: user.id,
                                startDate: {
                                    $lte: invoiceMonthEnd,
                                },
                                endDate: {
                                    $gte: invoiceMonthStart,
                                },
                            },
                            populate: {
                                plan: true,
                            },
                            orderBy: {
                                startDate: "desc",
                            },
                        });

                    /* IF NO ACTIVE SUBSCRIPTION */
                    if (!activeSubscription) {
                        activeSubscription = await strapi.db
                            .query("api::user-subscription.user-subscription")
                            .findOne({
                                where: {
                                    users_permissions_user: user.id,
                                    startDate: {
                                        $lte: invoiceMonthEnd,
                                    },
                                },
                                populate: {
                                    plan: true,
                                },
                                orderBy: {
                                    startDate: "desc",
                                },
                            });
                    }

                    if (!activeSubscription) {
                        return ctx.badRequest("No subscription found");
                    }

                    if (!activeSubscription.plan?.isActive) {
                        return ctx.badRequest("Plan inactive");
                    }

                    let subscriptionToUse = activeSubscription;

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

                        const previousSubscription =
                            await strapi.db
                                .query("api::user-subscription.user-subscription")
                                .findOne({
                                    where: {
                                        users_permissions_user: user.id,
                                        startDate: {
                                            $lt: activeSubscription.startDate,
                                        },
                                    },
                                    populate: {
                                        plan: true,
                                    },
                                    orderBy: {
                                        startDate: "desc",
                                    },
                                });

                        if (
                            reportYear < upgradeYear ||
                            (
                                reportYear === upgradeYear &&
                                reportMonth < upgradeMonth
                            )
                        ) {

                            if (previousSubscription?.plan) {
                                subscriptionToUse = previousSubscription;
                            }

                        } else if (
                            reportYear === upgradeYear &&
                            reportMonth === upgradeMonth
                        ) {

                            if (upgradeDay > 15 && previousSubscription?.plan) {
                                subscriptionToUse = previousSubscription;
                            }

                        } else {

                            subscriptionToUse = activeSubscription;
                        }
                    }

                    const activePlan = subscriptionToUse.plan;

                    const planName =
                        activePlan?.name?.toLowerCase()?.trim();

                    console.log("PLAN:", planName);
                    console.log("Label Fee:", labelFee);
                    console.log("Admin Fee:", adminFee);
                    console.log("Enterprise Commission:", enterpriseCommission);

                    /* ================= FETCH FEES ================= */

                    const labelFeeData = await strapi.db
                        .query("api::label-fee-history.label-fee-history")
                        .findMany({
                            where: {
                                users_permissions_user: user.id,
                                effective_from: {
                                    $lte: invoiceMonthEnd,
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
                                    $lte: invoiceMonthEnd,
                                },
                            },
                            orderBy: {
                                effective_from: "desc",
                            },
                            limit: 1,
                        });

                    const enterpriseCommissionData =
                        await strapi.db
                            .query("api::enterprise-commission.enterprise-commission")
                            .findMany({
                                where: {
                                    users_permissions_user: user.id,
                                    effective_from: {
                                        $lte: invoiceMonthEnd,
                                    },
                                },
                                orderBy: {
                                    effective_from: "desc",
                                },
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

                    const enterpriseCommission =
                        enterpriseCommissionData[0]
                            ?.commission_percentage ?? 0;


                    /* =======================================================
                       ARTIST / ARTIST PLUS
                    ======================================================= */

                    if (
                        planName === "artist" ||
                        planName === "artist plus"
                    ) {

                        const labelFeeAmount = Number(
                            (totalEarnings * labelFee / 100).toFixed(2)
                        );

                        const afterLabel = Number(
                            (totalEarnings - labelFeeAmount).toFixed(2)
                        );

                        const adminFeeAmount = Number(
                            (afterLabel * adminFee / 100).toFixed(2)
                        );

                        const finalAmount = Number(
                            (afterLabel - adminFeeAmount).toFixed(2)
                        );

                        totalAdjustedNetTotal += finalAmount;

                        for (const royalty of filteredRoyalties) {

                            const royaltyNet = Number(royalty.NetTotal || 0);

                            const ratio =
                                totalEarnings > 0
                                    ? royaltyNet / totalEarnings
                                    : 0;

                            const adjustedNet =
                                Number((finalAmount * ratio).toFixed(10));

                            finalRows.push({
                                report_month: royalty.reportMonth,
                                report_year: royalty.reportYear,
                                confirmation_report_date:
                                    royalty.ConfirmationReportDate,
                                country: royalty.Country,
                                units: royalty.Units,
                                net_total: adjustedNet,
                                channel: royalty.Platform,
                                artist: royalty.Artist,
                                release: royalty.ReleaseTitle,
                                upc: royalty.UPC,
                                track_title: royalty.TrackTitle,
                                isrc: royalty.ISRC,
                            });
                        }
                    }
                    /* =======================================================
                       PRO LABEL
                    ======================================================= */

                    else if (planName === "pro label") {

                        const isrcGroups = {};

                        for (const royalty of filteredRoyalties) {

                            const isrc =
                                royalty.ISRC ||
                                royalty.isrc ||
                                "NO_ISRC";

                            if (!isrcGroups[isrc]) {
                                isrcGroups[isrc] = [];
                            }

                            isrcGroups[isrc].push(royalty);
                        }

                        let monthAdjustedTotal = 0;

                        for (const isrc in isrcGroups) {

                            const rows = isrcGroups[isrc];

                            const songTotal = rows.reduce(
                                (sum, row) =>
                                    sum + Number(row.NetTotal || 0),
                                0
                            );

                            const commissionAmount = Number(
                                (
                                    songTotal *
                                    enterpriseCommission /
                                    100
                                ).toFixed(2)
                            );

                            const payableAmount = Number(
                                (
                                    songTotal -
                                    commissionAmount
                                ).toFixed(2)
                            );

                            monthAdjustedTotal += payableAmount;

                            for (const royalty of rows) {

                                const royaltyNet = Number(
                                    royalty.NetTotal || 0
                                );

                                const ratio =
                                    songTotal > 0
                                        ? royaltyNet / songTotal
                                        : 0;

                                const adjustedNet =
                                    Number((payableAmount * ratio).toFixed(10));

                                finalRows.push({
                                    report_month: royalty.reportMonth,
                                    report_year: royalty.reportYear,
                                    confirmation_report_date:
                                        royalty.ConfirmationReportDate,
                                    country: royalty.Country,
                                    units: royalty.Units,
                                    net_total: adjustedNet,
                                    channel: royalty.Platform,
                                    artist: royalty.Artist,
                                    release: royalty.ReleaseTitle,
                                    upc: royalty.UPC,
                                    track_title: royalty.TrackTitle,
                                    isrc: royalty.ISRC,
                                });
                            }
                        }

                        totalAdjustedNetTotal += monthAdjustedTotal;
                    }

                }

                console.log("=================================");
                console.log("Grand Units:", grandTotalUnits);
                console.log("Adjusted Total:", totalAdjustedNetTotal);
                console.log("=================================");

                /* ================= GLOBAL UNIT PRICE ================= */

                const perUnitPrice =
                    grandTotalUnits > 0
                        ? totalAdjustedNetTotal /
                        grandTotalUnits
                        : 0;

                console.log(
                    "💵 Global Unit Price:",
                    perUnitPrice
                );

                /* ================= FINAL CSV ROWS ================= */

                const csvRows =
                    finalRows.map(
                        (row) => ({
                            report_month: row.report_month,

                            report_year: row.report_year,

                            confirmation_report_date:
                                row.confirmation_report_date,

                            country:
                                row.country,

                            units:
                                row.units,

                            unit_price:
                                Number(
                                    perUnitPrice.toFixed(
                                        10
                                    )
                                ),

                            net_total:
                                Number(
                                    row.net_total.toFixed(
                                        10
                                    )
                                ),

                            channel:
                                row.channel,

                            artist:
                                row.artist,

                            release:
                                row.release,

                            upc:
                                row.upc,

                            track_title:
                                row.track_title,

                            isrc:
                                row.isrc,
                        })
                    );

                console.log(
                    "📄 Final CSV Rows:",
                    csvRows.length
                );

                /* ================= CSV ================= */

                const parser =
                    new Parser({
                        fields: [
                            "report_month",
                            "report_year",
                            "confirmation_report_date",
                            "country",
                            "units",
                            "unit_price",
                            "net_total",
                            "channel",
                            "artist",
                            "release",
                            "upc",
                            "track_title",
                            "isrc",
                        ],
                    });

                const csv =
                    parser.parse(csvRows);

                console.log(
                    "✅ CSV Generated Successfully"
                );

                /* ================= CREATE CSV LOG ================= */

                const fileName =
                    `earnings-report-${Date.now()}.csv`;

                await strapi.db
                    .query("api::csv-report-log.csv-report-log")
                    .create({
                        data: {
                            startMonth,

                            endMonth,

                            reportName:
                                fileName,

                            csvData:
                                csv,

                            users_permissions_user:
                                userId,

                            publishedAt:
                                new Date(),
                        },
                    });

                console.log(
                    "📝 CSV Log Created"
                );


                /* ================= RESPONSE ================= */

                ctx.set(
                    "Content-Type",
                    "text/csv"
                );

                ctx.set(
                    "Content-Disposition",
                    `attachment; filename=earnings-report.csv`
                );

                ctx.body = csv;

                console.log(
                    "🎉 CSV Export Completed"
                );

                console.log(
                    "=================================="
                );

            } catch (error) {

                console.error(
                    "❌ CSV EXPORT ERROR:",
                    error
                );

                return ctx.badRequest(
                    "Failed to generate CSV"
                );
            }
        },

    })
);