module.exports = {
    routes: [
        {
            method: "GET",
            path: "/csv-report/download/:id",
            handler:"csv-download.downloadCsvReport",
             config: {
                auth:{}
            },
        },
    ],
};