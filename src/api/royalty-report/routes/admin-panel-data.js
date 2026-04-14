"use strict";

module.exports = {
    routes: [
        {
            method: "GET",
            path: "/country-earnings",
            handler: "admin-panel-data.getCountryEarnings",
            config: {
                auth: {},
            }
        },
        {
            method: "GET",
            path: "/earnings-summary",
            handler: "admin-panel-data.getEarningsSummary",
            config: {
                auth: {}
            }
        },
        {
            method: "GET",
            path: "/single-track-earnings",
            handler: "admin-panel-data.singleTrackEarnings",
            config: {
                auth: {}
            }
        },
        {
            method: "GET",
            path: "/streams-per-platform",
            handler: "admin-panel-data.getTotalStreams",
            config: {
                auth: {}
            }
        }
    ]
};