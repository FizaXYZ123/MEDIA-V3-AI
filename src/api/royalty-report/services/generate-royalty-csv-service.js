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

                /* ================= FORMAT DATES ================= */

                const startDate =
                    `${startMonth}-01`;

                const [endYear, endMonthNumber] =
                    endMonth.split("-");

                const lastDay =
                    new Date(
                        Number(endYear),
                        Number(endMonthNumber),
                        0
                    ).getDate();

                const endDate =
                    `${endMonth}-${lastDay}`;

                console.log("📅 Formatted Dates:", {
                    startDate,
                    endDate,
                });

                const userId =
                    ctx.state.user.id;

                console.log("📅 Date Range:", {
                    startMonth,
                    endMonth,
                });

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
                                StartDate: {
                                    $gte: startDate,
                                },

                                EndDate: {
                                    $lte: endDate,
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

                if (!royalties.length) {

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

                const user =
                    royalties[0]
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

                /* ================= TOTAL EARNINGS ================= */

                const totalEarnings =
                    royalties.reduce(
                        (sum, royalty) =>
                            sum +
                            Number(
                                royalty.NetTotal || 0
                            ),
                        0
                    );

                console.log(
                    "💰 Total Earnings:",
                    totalEarnings
                );

                /* ================= TOTAL UNITS ================= */

                const totalUnits =
                    royalties.reduce(
                        (sum, royalty) =>
                            sum +
                            Number(
                                royalty.Units || 0
                            ),
                        0
                    );

                console.log(
                    "🎧 Total Units:",
                    totalUnits
                );

                /* ================= ACTIVE SUBSCRIPTION ================= */

                const activeSubscription =
                    await strapi.db
                        .query(
                            "api::user-subscription.user-subscription"
                        )
                        .findOne({
                            where: {
                                users_permissions_user:
                                    user.id,

                                status: "active",
                            },

                            populate: {
                                plan: true,
                            },
                        });

                console.log(
                    "📄 Active Subscription:",
                    activeSubscription?.plan?.name
                );

                if (
                    !activeSubscription?.plan
                        ?.isActive
                ) {

                    console.log(
                        "❌ No active plan"
                    );

                    return ctx.badRequest(
                        "No active plan"
                    );
                }

                const activePlan =
                    activeSubscription.plan;

                const planName =
                    activePlan.name
                        ?.toLowerCase()
                        ?.trim();

                console.log(
                    "📦 Plan Name:",
                    planName
                );

                const currentDate =
                    new Date();

                /* ================= FINAL ROWS ================= */

                const finalRows = [];

                let totalAdjustedNetTotal = 0;

                /* =======================================================
                   ARTIST / ARTIST PLUS
                ======================================================= */

                if (
                    planName === "artist" ||
                    planName ===
                    "artist plus"
                ) {

                    console.log(
                        "🎤 Applying Artist Logic"
                    );

                    /* ================= ARTIST FEES ================= */

                    const labelFeeData =
                        await strapi.db
                            .query(
                                "api::label-fee-history.label-fee-history"
                            )
                            .findMany({
                                where: {
                                    users_permissions_user:
                                        user.id,

                                    effective_from: {
                                        $lte: currentDate,
                                    },
                                },

                                orderBy: {
                                    effective_from:
                                        "desc",
                                },

                                limit: 1,
                            });

                    const adminFeeData =
                        await strapi.db
                            .query(
                                "api::admin-fee-history.admin-fee-history"
                            )
                            .findMany({
                                where: {
                                    users_permissions_user:
                                        user.id,

                                    effective_from: {
                                        $lte: currentDate,
                                    },
                                },

                                orderBy: {
                                    effective_from:
                                        "desc",
                                },

                                limit: 1,
                            });

                    let labelFee =
                        labelFeeData[0]
                            ?.feePercentage ??
                        user.labelFee ??
                        0;

                    let adminFee =
                        adminFeeData[0]
                            ?.feePercentage ??
                        user.adminFee ??
                        0;

                    console.log("💸 Artist Fees:", {
                        labelFee,
                        adminFee,
                    });

                    const labelFeeAmount =
                        totalEarnings *
                        labelFee /
                        100;

                    const afterLabel =
                        totalEarnings -
                        labelFeeAmount;

                    const adminFeeAmount =
                        afterLabel *
                        adminFee /
                        100;

                    const finalAmount =
                        afterLabel -
                        adminFeeAmount;

                    totalAdjustedNetTotal =
                        finalAmount;

                    console.log(
                        "💰 Artist Calculations:",
                        {
                            totalEarnings,
                            labelFeeAmount,
                            adminFeeAmount,
                            finalAmount,
                        }
                    );

                    for (const royalty of royalties) {

                        const royaltyNetTotal =
                            Number(
                                royalty.NetTotal || 0
                            );

                        const ratio =
                            totalEarnings > 0
                                ? royaltyNetTotal /
                                totalEarnings
                                : 0;

                        const adjustedNetTotal =
                            finalAmount * ratio;

                        finalRows.push({
                            start_date:
                                royalty.StartDate,

                            end_date:
                                royalty.EndDate,

                            confirmation_report_date:
                                royalty.ConfirmationReportDate,

                            country:
                                royalty.Country,

                            units:
                                royalty.Units,

                            net_total:
                                Number(
                                    adjustedNetTotal.toFixed(
                                        10
                                    )
                                ),

                            channel:
                                royalty.Platform,

                            artist:
                                royalty.Artist,

                            release:
                                royalty.ReleaseTitle,

                            upc:
                                royalty.UPC,

                            track_title:
                                royalty.TrackTitle,

                            isrc:
                                royalty.ISRC,
                        });
                    }

                    console.log(
                        "✅ Artist rows processed:",
                        finalRows.length
                    );
                }

                /* =======================================================
                   PRO LABEL
                ======================================================= */

                else if (
                    planName ===
                    "pro label"
                ) {

                    console.log(
                        "🏢 Applying Pro Label Logic"
                    );

                    /* ================= ENTERPRISE COMMISSION ================= */

                    const enterpriseCommissionData =
                        await strapi.db
                            .query(
                                "api::enterprise-commission.enterprise-commission"
                            )
                            .findMany({
                                where: {
                                    users_permissions_user:
                                        user.id,

                                    effective_from: {
                                        $lte: currentDate,
                                    },
                                },

                                orderBy: {
                                    effective_from:
                                        "desc",
                                },

                                limit: 1,
                            });

                    const enterpriseCommission =
                        enterpriseCommissionData[0]
                            ?.commission_percentage ??
                        0;

                    console.log(
                        "🏢 Enterprise Commission:",
                        enterpriseCommission
                    );

                    const isrcGroups = {};

                    /* ================= GROUP BY ISRC ================= */

                    for (const royalty of royalties) {

                        const isrc =
                            royalty.ISRC ||
                            "NO_ISRC";

                        if (
                            !isrcGroups[isrc]
                        ) {
                            isrcGroups[isrc] =
                                [];
                        }

                        isrcGroups[isrc].push(
                            royalty
                        );
                    }

                    console.log(
                        "🎵 Total ISRC Groups:",
                        Object.keys(
                            isrcGroups
                        ).length
                    );

                    /* ================= APPLY COMMISSION ================= */

                    for (const isrc in isrcGroups) {

                        const rows =
                            isrcGroups[isrc];

                        const isrcTotal =
                            rows.reduce(
                                (sum, row) =>
                                    sum +
                                    Number(
                                        row.NetTotal ||
                                        0
                                    ),
                                0
                            );

                        const commissionAmount =
                            isrcTotal *
                            enterpriseCommission /
                            100;

                        const adjustedTotal =
                            isrcTotal -
                            commissionAmount;

                        totalAdjustedNetTotal +=
                            adjustedTotal;

                        console.log(
                            "🎵 ISRC Processed:",
                            {
                                isrc,
                                rows:
                                    rows.length,
                                isrcTotal,
                                commissionAmount,
                                adjustedTotal,
                            }
                        );

                        /* ================= REDISTRIBUTE ================= */

                        for (const royalty of rows) {

                            const royaltyNetTotal =
                                Number(
                                    royalty.NetTotal ||
                                    0
                                );

                            const ratio =
                                isrcTotal > 0
                                    ? royaltyNetTotal /
                                    isrcTotal
                                    : 0;

                            const adjustedNetTotal =
                                adjustedTotal *
                                ratio;

                            finalRows.push({
                                start_date:
                                    royalty.StartDate,

                                end_date:
                                    royalty.EndDate,

                                confirmation_report_date:
                                    royalty.ConfirmationReportDate,

                                country:
                                    royalty.Country,

                                units:
                                    royalty.Units,

                                net_total:
                                    Number(
                                        adjustedNetTotal.toFixed(
                                            10
                                        )
                                    ),

                                channel:
                                    royalty.Platform,

                                artist:
                                    royalty.Artist,

                                release:
                                    royalty.ReleaseTitle,

                                upc:
                                    royalty.UPC,

                                track_title:
                                    royalty.TrackTitle,

                                isrc:
                                    royalty.ISRC,
                            });
                        }
                    }

                    console.log(
                        "✅ Pro Label rows processed:",
                        finalRows.length
                    );
                }

                /* ================= GLOBAL UNIT PRICE ================= */

                const perUnitPrice =
                    totalUnits > 0
                        ? totalAdjustedNetTotal /
                        totalUnits
                        : 0;

                console.log(
                    "💵 Global Unit Price:",
                    perUnitPrice
                );

                /* ================= FINAL CSV ROWS ================= */

                const csvRows =
                    finalRows.map(
                        (row) => ({
                            start_date:
                                row.start_date,

                            end_date:
                                row.end_date,

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
                            "start_date",
                            "end_date",
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