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
      origin: ['http://localhost:5173', 'https://v3.amozart.com', 'https://localhost:5173', 'https://admin.amozart.com', 'https://amozart.com', 'https://www.amozart.com'],

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
      formLimit: "256mb",
      jsonLimit: "256mb",
      textLimit: "256mb",
      formidable: {
        maxFileSize: 250 * 1024 * 1024, // 250MB
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