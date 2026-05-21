module.exports = {
    routes: [
        {
            method: "GET",
            path: "/csv-report/download/:id",
            handler: "csv-download.downloadCsvReport",
            config: {
                auth: {}
            },
        },
        {
            method: "GET",
            path: "/csv-report-logs/my-logs",
            handler: "csv-download.getMyLogs",
            config: {
               auth:{}
            },
        },
    ],
};