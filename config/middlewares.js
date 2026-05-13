module.exports = [
  'strapi::errors',
  {
    name: "strapi::security",
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "img-src": [
            "'self'",
            "data:",
            "blob:",
            "https://storage.googleapis.com",
            "https://mozart-app.s3.ap-southeast-2.amazonaws.com",
          ],
          "media-src": [
            "'self'",
            "data:",
            "blob:",
            "https://storage.googleapis.com",
            "https://mozart-app.s3.ap-southeast-2.amazonaws.com",
          ],
        },
      },
    },
  },
  {
    name: 'strapi::cors',
    config: {
      origin: ['http://localhost:5173', 'https://v3.amozart.com'],

      methods: [
        'GET',
        'POST',
        'PUT',
        'PATCH',
        'DELETE',
        'OPTIONS',
      ],

      headers: [
        'Content-Type',
        'Authorization',
        'Origin',
        'Accept',
        'client-ip',
      ],
    },
  },
  'strapi::poweredBy',
  'strapi::logger',
  'strapi::query',
  {
    name: 'strapi::body',
    config: {
      formLimit: '100mb',
      jsonLimit: '100mb',
      textLimit: '100mb',
      formidable: {
        maxFileSize: 100 * 1024 * 1024, // 100MB
      },
      includeUnparsed: true,
    },
  },
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
  // V3 — Priority 7: append-only audit log for admin mutations.
  'global::audit-log',
];