module.exports = ({ env }) => ({
  upload: {
    config: {
      provider: "aws-s3",
      providerOptions: {
        s3Options: {
          credentials: {
            accessKeyId: env("AWS_ACCESS_KEY_ID"),
            secretAccessKey: env("AWS_ACCESS_SECRET"),
          },
          region: env("AWS_REGION"),
        },
        params: {
          Bucket: env("AWS_BUCKET"),
        },
      },
    },
  },

 
   email: {
    config: {
      provider: "strapi-provider-email-brevo",
      providerOptions: {
        apiKey: env("BREVO_API_KEY"),
      },
      settings: {
        defaultFrom: env("BREVO_FROM_EMAIL"),   
        defaultReplyTo: env("BREVO_FROM_EMAIL"),    
      },
    },
  },
});