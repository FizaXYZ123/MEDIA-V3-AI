"use strict";

const path = require("node:path");

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/royalty-report/import",
      handler: "custom-royalty-report.importReport",
      config: {
        auth: {}
      }
    },
    {
      method: "GET",
      path: "/search-reports",
      handler: "custom-royalty-report.searchReports",
      config: {
        auth: {}
      }
    },

    // USER-SPECIFIC ENDPOINTS
    {
      method: "GET",
      path: "/user/track-earnings",
      handler: "custom-royalty-report.getTrackEarnings",
      config: {
        auth: {},
      }
    },
    {
      method: "GET",
      path: "/user/best-streaming-platforms",
      handler: "custom-royalty-report.userStreamsFromPlatform",
      config: {
        auth: {}
      }
    },
    {
      method: "GET",
      path: "/user/best-streaming-countries",
      handler: "custom-royalty-report.userStreamsFromCountries",
      config: {
        auth: {}
      }
    },
     {
      method: "GET",
      path: "/user/total-streams",
      handler: "custom-royalty-report.userTotalStreams",
      config: {
        auth: {}
      }
    },
    {
      method: "GET",
      path: "/user/earnings-per-month",
      handler: "custom-royalty-report.getUserEarningsPerMonth",
      config: {
        auth: {}
      }
    },

    // V3 — Priority 12: enhanced analytics endpoints
    {
      method: "GET",
      path: "/user/analytics/overview",
      handler: "custom-royalty-report.analyticsOverview",
      config: { auth: {} },
    },
    {
      method: "GET",
      path: "/user/analytics/by-dsp",
      handler: "custom-royalty-report.analyticsByDsp",
      config: { auth: {} },
    },
    {
      method: "GET",
      path: "/user/analytics/by-release/:id",
      handler: "custom-royalty-report.analyticsByRelease",
      config: { auth: {} },
    },
    {
      method: "GET",
      path: "/user/analytics/by-country",
      handler: "custom-royalty-report.analyticsByCountry",
      config: { auth: {} },
    },
      {
      method: "DELETE",
      path: "/royalty-reports/delete-all",
      handler: "custom-royalty-report.deleteAll",
      config: {
        auth: false, 
      },
    },

    // export royalty file
    {
      method: "GET",
      path: "/royalty-report/export-csv",
      handler: "custom-royalty-report.generateCsvReport",
      config: {
        auth: {},
      },
    },
  ]
};
