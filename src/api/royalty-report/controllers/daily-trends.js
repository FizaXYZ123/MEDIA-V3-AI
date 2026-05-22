const axios = require("axios");

/* =========================================================
   CONFIG
========================================================= */

const TINYBIRD_BASE_URL =
    "https://api.us-east.aws.tinybird.co/v0/pipes";

const HEADERS = {
    Authorization: `Bearer ${process.env.sonu_suite_access_token}`,
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
    async top5Countries(ctx) {
        try {
            const user = ctx.state.user;

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
            console.log(
                "MATCHED TRACK IDS:",
                JSON.stringify(matchedTracks, null, 2)
            );

            /* =========================================
               CURRENT YEAR
            ========================================= */

            const currentYear =
                new Date().getFullYear();

            let { startDate, endDate } =
                getYearDates(currentYear);

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
               FALLBACK TO PREVIOUS YEAR
            ========================================= */

            if (!allCountryStreams.length) {
                const previousYear =
                    currentYear - 1;

                ({ startDate, endDate } =
                    getYearDates(previousYear));

                for (const track of matchedTracks) {
                    const streams =
                        await getCountryStreams(
                            track.trackId,
                            startDate,
                            endDate
                        );

                    allCountryStreams.push(...streams);
                }
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
};