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
    }

}