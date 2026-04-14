'use strict';

/**
 * SonoSuite CSV export controller.
 * Generates a CSV in the exact SonoSuite format required by their bulk uploader.
 *
 * Body shape:
 *   { releaseIds?: number[], filters?: { status?, dateFrom?, dateTo?, userId? } }
 *
 * One row per track. Release-level fields are repeated on every track row.
 */

const PUB_API = 'api::publish-distribute.publish-distribute';

const HEADER_LINES = [
  '#metadata',
  'description,[YYYY-MM-DD-UPLOAD-N]',
  'format_version,4',
  'total_releases,[count]',
  'total_tracks,[count]',
  '#release_info,,,,,,,,,,,,,,,,,,,,,,,,#track_info',
  '#action,#upc,#catalog_number,#grid,#title,#remix_or_version,#user_email,#label,#participants,#primary_genre,#secondary_genre,#language,#explicit_lyrics,#price_category,#digital_release,#original_release,#license_type,#license_info,#c_year,#c_line,#p_year,#p_line,#territories,#cover_url,#track_count,#isrc,#iswc,#track_title,#remix_or_version,#participants,#primary_genre,#secondary_genre,#language,#explicit_lyrics,#p_year,#p_line,#audio_url',
];

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return dt.toISOString().split('T')[0];
}

/**
 * Build the participants string from a track's RoleCredits JSON.
 * Format: `primary:Name;featuring:Name;producer:Name`
 */
function formatParticipants(roleCredits) {
  if (!roleCredits) return '';
  if (Array.isArray(roleCredits)) {
    return roleCredits
      .map((c) => {
        const role = String(c.role || c.type || 'primary').toLowerCase();
        const name = c.name || c.artistName || '';
        return name ? `${role}:${name}` : '';
      })
      .filter(Boolean)
      .join(';');
  }
  if (typeof roleCredits === 'object') {
    const out = [];
    for (const [role, val] of Object.entries(roleCredits)) {
      if (Array.isArray(val)) {
        for (const v of val) {
          const name = typeof v === 'string' ? v : v?.name;
          if (name) out.push(`${role.toLowerCase()}:${name}`);
        }
      } else if (val) {
        const name = typeof val === 'string' ? val : val?.name;
        if (name) out.push(`${role.toLowerCase()}:${name}`);
      }
    }
    return out.join(';');
  }
  return '';
}

function isAdminRequest(ctx) {
  const role = ctx.state?.user?.role;
  if (!role) return false;
  const name = String(role.name || '').toLowerCase();
  const type = String(role.type || '').toLowerCase();
  return (
    name === 'admin' ||
    name === 'super admin' ||
    name === 'super-admin' ||
    type === 'admin' ||
    type === 'super-admin'
  );
}

module.exports = {
  async exportCSV(ctx) {
    if (!isAdminRequest(ctx)) return ctx.forbidden('Admin only');

    const body = ctx.request.body || {};
    const { releaseIds, filters } = body;

    /* -------- Build query -------- */
    const where = {};
    if (Array.isArray(releaseIds) && releaseIds.length > 0) {
      where.id = { $in: releaseIds };
    } else if (filters) {
      if (filters.status) where.Status = filters.status;
      if (filters.userId) where.UserDetail = filters.userId;
      if (filters.dateFrom || filters.dateTo) {
        where.DigitalReleaseDate = {};
        if (filters.dateFrom) where.DigitalReleaseDate.$gte = filters.dateFrom;
        if (filters.dateTo) where.DigitalReleaseDate.$lte = filters.dateTo;
      }
    }

    const releases = await strapi.db.query(PUB_API).findMany({
      where,
      populate: {
        TrackList: true,
        CoverArt: true,
        UserDetail: { select: ['email'] },
      },
    });

    if (!releases.length) {
      return ctx.notFound('No releases match the supplied criteria');
    }

    /* -------- Build header -------- */
    const totalReleases = releases.length;
    const totalTracks = releases.reduce(
      (s, r) => s + (Array.isArray(r.TrackList) ? r.TrackList.length : 0),
      0,
    );
    const today = new Date().toISOString().split('T')[0];

    const header = HEADER_LINES.slice();
    header[1] = `description,${today}-UPLOAD-1`;
    header[3] = `total_releases,${totalReleases}`;
    header[4] = `total_tracks,${totalTracks}`;

    /* -------- Build rows -------- */
    const lines = [...header];

    for (const r of releases) {
      const tracks = Array.isArray(r.TrackList) ? r.TrackList : [];
      if (tracks.length === 0) continue;

      const releaseFields = [
        'add', // #action
        '', // #upc
        '', // #catalog_number
        '', // #grid
        r.ReleaseTitle || '',
        r.Version || '',
        r.UserDetail?.email || '',
        r.AddLabel || '',
        '', // #participants (release-level — left empty; per-track participants are populated)
        r.PrimaryGenre || '',
        r.SecondaryGenre || '',
        r.LanguageOfTheTitles || '',
        '', // #explicit_lyrics — release-level (per-track set below)
        r.PriceCategory || '',
        fmtDate(r.DigitalReleaseDate),
        fmtDate(r.OriginalReleaseDate),
        '', // #license_type
        '', // #license_info
        r.CopyrightYear || '',
        r.CopyrightholderName || '',
        r.PhonogramRightsHolderYear || '',
        r.PhonogramRightsHolderName || '',
        Array.isArray(r.Countries) ? r.Countries.join('|') : '',
        r.CoverArt?.url || '',
        tracks.length,
      ];

      for (const t of tracks) {
        const trackFields = [
          t.ISRC || '',
          t.ISWC || '',
          t.TrackName || '',
          '', // #remix_or_version (track-level)
          formatParticipants(t.RoleCredits),
          t.PrimaryGenre || '',
          t.SecondaryGenre || '',
          r.LanguageOfTheTitles || '',
          t.ContainsExplicitContent ? 'yes' : 'no',
          r.PhonogramRightsHolderYear || '',
          r.PhonogramRightsHolderName || '',
          t.TrackUpload?.url || '',
        ];

        const row = [...releaseFields, ...trackFields].map(csvEscape).join(',');
        lines.push(row);
      }
    }

    const csv = lines.join('\n') + '\n';
    const filename = `sonosuite-export-${today}.csv`;

    ctx.set('Content-Type', 'text/csv; charset=utf-8');
    ctx.set('Content-Disposition', `attachment; filename="${filename}"`);
    ctx.body = csv;
  },
};
