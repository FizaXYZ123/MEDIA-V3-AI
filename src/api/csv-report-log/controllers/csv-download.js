'use strict';

module.exports = {

    async downloadCsvReport(ctx) {

        const { id } = ctx.params;

        const report =
            await strapi.db
                .query(
                    "api::csv-report-log.csv-report-log"
                )
                .findOne({
                    where: {
                        id,
                    },
                });

        if (!report) {

            return ctx.notFound(
                "Report not found"
            );
        }

        ctx.set(
            "Content-Type",
            "text/csv"
        );

        ctx.set(
            "Content-Disposition",
            `attachment; filename=${report.reportName}`
        );

        ctx.body =
            report.csvData;
    },

    async getMyLogs(ctx) {
        try {
            const user = ctx.state.user;

            if (!user) {
                return ctx.unauthorized("You must be logged in");
            }

            const logs = await strapi.entityService.findMany(
                "api::csv-report-log.csv-report-log",
                {
                    filters: {
                        users_permissions_user: user.id,
                    },
                    sort: { createdAt: "desc" },
                }
            );

            return ctx.send({
                success: true,
                data: logs,
            });
        } catch (error) {
            console.log("GET MY LOGS ERROR", error);

            return ctx.badRequest("Failed to fetch logs");
        }
    },

}