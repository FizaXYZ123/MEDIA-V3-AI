const axios = require("axios");

/* =========================================================
   CONFIG
========================================================= */

const TINYBIRD_BASE_URL =
    "https://api.us-east.aws.tinybird.co/v0/pipes";

const TOKEN = process.env.SONU_SUITE_ACCESS_TOKEN;

if (!TOKEN) {
    throw new Error("Tinybird token missing");
}

const HEADERS = {
    Authorization: `Bearer ${TOKEN}`,
};

/* =========================================================
   NORMALIZE ISRC
========================================================= */

function normalizeIsrc(isrc = "") {
    return isrc.replace(/-/g, "").trim().toUpperCase();
}

/* =========================================================
   GET YEAR RANGE
========================================================= */

function getYearDates(year) {
    return {
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
    };
}

/* =========================================================
   GET TINYBIRD TRACKS
========================================================= */

async function getTinybirdTracks() {
    const response = await axios.get(
        `${TINYBIRD_BASE_URL}/list_tracks.json`,
        {
            headers: HEADERS,
        }
    );

    return response.data.data || [];
}

/* =========================================================
   GET COUNTRY STREAMS
========================================================= */

async function getCountryStreams(
    trackId,
    startDate,
    endDate
) {
    const response = await axios.get(
        `${TINYBIRD_BASE_URL}/streams.json`,
        {
            headers: HEADERS,

            params: {
                track_id: trackId,
                dimension: "country",
                date_start: startDate,
                date_end: endDate,
            },
        }
    );

    return response.data.data || [];
}

/* =========================================================
   CONTROLLER
========================================================= */

module.exports = {

    async streamsOverview(ctx) {
        try {
            const user = ctx.state.user;

            const period =
                ctx.query.period || "7days";

            if (!user) {
                return ctx.unauthorized(
                    "Unauthorized"
                );
            }

            /* =========================================
               PERIOD MAP
            ========================================= */

            const PERIOD_MAP = {
                "7days": 7,
                "14days": 14,
                "30days": 30,
            };

            const totalDays =
                PERIOD_MAP[period] || 7;

            /* =========================================
               DATE RANGE
               Tinybird data delayed by 2 days
            ========================================= */

            const endDate = new Date();

            endDate.setDate(
                endDate.getDate() - 2
            );

            const startDate = new Date(
                endDate
            );

            startDate.setDate(
                startDate.getDate() -
                totalDays
            );

            const formattedStartDate =
                startDate
                    .toISOString()
                    .split("T")[0];

            const formattedEndDate =
                endDate
                    .toISOString()
                    .split("T")[0];

            /* =========================================
               GET USER TRACKS
            ========================================= */

            const artistDetails =
                await strapi.entityService.findMany(
                    "api::artist-detail.artist-detail",
                    {
                        filters: {
                            owner: {
                                id: user.id,
                            },
                        },

                        populate: {
                            tracks: {
                                fields: [
                                    "TrackName",
                                    "ISRC",
                                ],
                            },
                        },
                    }
                );

            const userTracks =
                artistDetails.flatMap(
                    (artist) =>
                        artist.tracks || []
                );

            /* =========================================
               GET TINYBIRD TRACKS
            ========================================= */

            const tinybirdTracks =
                await getTinybirdTracks();

            /* =========================================
               MATCH TRACKS
            ========================================= */

            const matchedTracks = userTracks
                .map((song) => {
                    const matchedTrack =
                        tinybirdTracks.find(
                            (track) =>
                                normalizeIsrc(
                                    track.track_code
                                ) ===
                                normalizeIsrc(song.ISRC)
                        );

                    if (!matchedTrack)
                        return null;

                    return {
                        songName:
                            song.TrackName,

                        trackId:
                            matchedTrack.track_id,
                    };
                })
                .filter(Boolean);

            // console.log(
            //     "MATCHED TRACK IDS:",
            //     JSON.stringify(
            //         matchedTracks,
            //         null,
            //         2
            //     )
            // );

            /* =========================================
               FETCH STREAMS
            ========================================= */

            let allStreams = [];

            for (const track of matchedTracks) {
                const response =
                    await axios.get(
                        `${TINYBIRD_BASE_URL}/streams.json`,
                        {
                            headers:
                                HEADERS,

                            params: {
                                track_id:
                                    track.trackId,

                                dimension:
                                    "day",

                                date_start:
                                    formattedStartDate,

                                date_end:
                                    formattedEndDate,
                            },
                        }
                    );

                const streams =
                    response.data.data ||
                    [];

                allStreams.push(
                    ...streams
                );
            }

            /* =========================================
               MERGE DAY STREAMS
            ========================================= */

            const dayMap = {};

            allStreams.forEach(
                (item) => {
                    const day =
                        item.day;

                    const streams =
                        Number(
                            item.total_stream_count ||
                            0
                        );

                    if (!dayMap[day]) {
                        dayMap[day] = 0;
                    }

                    dayMap[day] +=
                        streams;
                }
            );

            /* =========================================
               FINAL RESPONSE
            ========================================= */

            const finalData =
                Object.entries(dayMap)
                    .map(
                        ([
                            day,
                            totalStreams,
                        ]) => ({
                            day,
                            totalStreams,
                        })
                    )

                    .sort(
                        (a, b) =>
                            new Date(a.day) -
                            new Date(b.day)
                    );

            return ctx.send({
                success: true,

                period,

                startDate:
                    formattedStartDate,

                endDate:
                    formattedEndDate,

                data: finalData,
            });
        } catch (error) {
            console.error(
                error.response?.data ||
                error.message
            );

            return ctx.badRequest(
                "Failed to fetch streams overview",
                {
                    error:
                        error.response?.data ||
                        error.message,
                }
            );
        }
    },

    async top5Countries(ctx) {
        try {
            const user = ctx.state.user;

            /* =========================================
   PERIOD MAP
========================================= */

            const period =
                ctx.query.period || "7days";

            const PERIOD_MAP = {
                "7days": 7,
                "14days": 14,
                "30days": 30,
            };

            const totalDays =
                PERIOD_MAP[period] || 7;

            /* =========================================
               DATE RANGE
               Tinybird data delayed by 2 days
            ========================================= */

            const endDateObj = new Date();

            endDateObj.setDate(
                endDateObj.getDate() - 2
            );

            const startDateObj = new Date(
                endDateObj
            );

            startDateObj.setDate(
                startDateObj.getDate() -
                totalDays
            );

            const startDate =
                startDateObj
                    .toISOString()
                    .split("T")[0];

            const endDate =
                endDateObj
                    .toISOString()
                    .split("T")[0];

            if (!user) {
                return ctx.unauthorized("Unauthorized");
            }

            /* =========================================
               GET USER TRACKS
            ========================================= */

            const artistDetails =
                await strapi.entityService.findMany(
                    "api::artist-detail.artist-detail",
                    {
                        filters: {
                            owner: {
                                id: user.id,
                            },
                        },

                        populate: {
                            tracks: {
                                fields: ["TrackName", "ISRC"],
                            },
                        },
                    }
                );

            const userTracks =
                artistDetails.flatMap(
                    (artist) => artist.tracks || []
                );

            /* =========================================
               GET TINYBIRD TRACKS
            ========================================= */

            const tinybirdTracks =
                await getTinybirdTracks();

            /* =========================================
               MATCH TRACKS
            ========================================= */

            const matchedTracks = userTracks
                .map((song) => {
                    const matchedTrack =
                        tinybirdTracks.find(
                            (track) =>
                                normalizeIsrc(
                                    track.track_code
                                ) ===
                                normalizeIsrc(song.ISRC)
                        );

                    if (!matchedTrack) return null;

                    return {
                        songName: song.TrackName,
                        trackId: matchedTrack.track_id,
                    };
                })
                .filter(Boolean);
            // console.log(
            //     "MATCHED TRACK IDS:",
            //     JSON.stringify(matchedTracks, null, 2)
            // );

            /* =========================================
               FETCH COUNTRY STREAMS
            ========================================= */

            let allCountryStreams = [];

            for (const track of matchedTracks) {
                const streams =
                    await getCountryStreams(
                        track.trackId,
                        startDate,
                        endDate
                    );

                allCountryStreams.push(...streams);
            }

            /* =========================================
               MERGE COUNTRY STREAMS
            ========================================= */

            const countryMap = {};

            allCountryStreams.forEach((item) => {
                // console.log(
                //     "COUNTRY ITEM:",
                //     JSON.stringify(item, null, 2)
                // );

                const country =
                    item.country_code || "Unknown";

                const streams =
                    Number(item.total_stream_count || 0);

                if (!countryMap[country]) {
                    countryMap[country] = 0;
                }

                countryMap[country] += streams;
            });

            /* =========================================
               TOP 5 COUNTRIES
            ========================================= */

            const totalStreams = Object.values(
                countryMap
            ).reduce(
                (sum, value) => sum + value,
                0
            );

            const topCountries = Object.entries(
                countryMap
            )
                .map(([country, totalUnits]) => ({
                    country,
                    totalUnits,

                    percentage: (
                        (totalUnits / totalStreams) *
                        100
                    ).toFixed(2),
                }))

                .sort(
                    (a, b) =>
                        b.totalUnits - a.totalUnits
                )

                .slice(0, 5);

            return ctx.send({
                success: true,

                period,

                startDate,

                endDate,

                totalCountries:
                    topCountries.length,

                data: topCountries,
            });
        } catch (error) {
            console.error(
                error.response?.data ||
                error.message
            );

            return ctx.badRequest(
                "Failed to fetch top countries",
                {
                    error:
                        error.response?.data ||
                        error.message,
                }
            );
        }
    },

    async bestPerformingChannels(ctx) {
        try {
            const user = ctx.state.user;

            /* =========================================
              PERIOD MAP
========================================= */

            const period =
                ctx.query.period || "7days";

            const PERIOD_MAP = {
                "7days": 7,
                "14days": 14,
                "30days": 30,
            };

            const totalDays =
                PERIOD_MAP[period] || 7;

            /* =========================================
               DATE RANGE
               Tinybird data delayed by 2 days
            ========================================= */

            const endDateObj = new Date();

            endDateObj.setDate(
                endDateObj.getDate() - 2
            );

            const startDateObj = new Date(
                endDateObj
            );

            startDateObj.setDate(
                startDateObj.getDate() -
                totalDays
            );

            const startDate =
                startDateObj
                    .toISOString()
                    .split("T")[0];

            const endDate =
                endDateObj
                    .toISOString()
                    .split("T")[0];

            if (!user) {
                return ctx.unauthorized(
                    "Unauthorized"
                );
            }

            /* =========================================
               GET USER TRACKS
            ========================================= */

            const artistDetails =
                await strapi.entityService.findMany(
                    "api::artist-detail.artist-detail",
                    {
                        filters: {
                            owner: {
                                id: user.id,
                            },
                        },

                        populate: {
                            tracks: {
                                fields: [
                                    "TrackName",
                                    "ISRC",
                                ],
                            },
                        },
                    }
                );

            const userTracks =
                artistDetails.flatMap(
                    (artist) =>
                        artist.tracks || []
                );

            /* =========================================
               GET TINYBIRD TRACKS
            ========================================= */

            const tinybirdTracks =
                await getTinybirdTracks();

            /* =========================================
               MATCH TRACKS
            ========================================= */

            const matchedTracks = userTracks
                .map((song) => {
                    const matchedTrack =
                        tinybirdTracks.find(
                            (track) =>
                                normalizeIsrc(
                                    track.track_code
                                ) ===
                                normalizeIsrc(song.ISRC)
                        );

                    if (!matchedTrack)
                        return null;

                    return {
                        songName:
                            song.TrackName,

                        trackId:
                            matchedTrack.track_id,
                    };
                })
                .filter(Boolean);

            // console.log(
            //     "MATCHED TRACK IDS:",
            //     JSON.stringify(
            //         matchedTracks,
            //         null,
            //         2
            //     )
            // );

            /* =========================================
               FETCH CHANNEL STREAMS
            ========================================= */

            let allChannelStreams = [];

            for (const track of matchedTracks) {
                const response =
                    await axios.get(
                        `${TINYBIRD_BASE_URL}/streams.json`,
                        {
                            headers: HEADERS,

                            params: {
                                track_id:
                                    track.trackId,

                                dimension:
                                    "channel",

                                date_start:
                                    startDate,

                                date_end:
                                    endDate,
                            },
                        }
                    );

                const streams =
                    response.data.data || [];

                allChannelStreams.push(
                    ...streams
                );
            }

            /* =========================================
               MERGE CHANNEL STREAMS
            ========================================= */

            const channelMap = {};

            allChannelStreams.forEach(
                (item) => {
                    const channel =
                        item.channel_name ||
                        "Unknown";

                    const streams =
                        Number(
                            item.total_stream_count ||
                            0
                        );

                    if (
                        !channelMap[channel]
                    ) {
                        channelMap[channel] = 0;
                    }

                    channelMap[channel] +=
                        streams;
                }
            );

            /* =========================================
               TOP CHANNELS
            ========================================= */

            const totalStreams =
                Object.values(
                    channelMap
                ).reduce(
                    (
                        sum,
                        value
                    ) => sum + value,
                    0
                );

            const topChannels =
                Object.entries(
                    channelMap
                )
                    .map(
                        ([
                            channel,
                            totalUnits,
                        ]) => ({
                            channel,
                            totalUnits,

                            percentage:
                                (
                                    (totalUnits /
                                        totalStreams) *
                                    100
                                ).toFixed(
                                    2
                                ),
                        })
                    )

                    .sort(
                        (a, b) =>
                            b.totalUnits -
                            a.totalUnits
                    );

            return ctx.send({
                success: true,

                period,

                startDate,

                endDate,

                totalChannels:
                    topChannels.length,

                data: topChannels,
            });
        } catch (error) {
            console.error(
                error.response?.data ||
                error.message
            );

            return ctx.badRequest(
                "Failed to fetch best performing channels",
                {
                    error:
                        error.response?.data ||
                        error.message,
                }
            );
        }
    },
};