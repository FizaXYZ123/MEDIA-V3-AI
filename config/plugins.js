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
          params: {
            Bucket: env("AWS_BUCKET"),
          },
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
  "users-permissions": {
    config: {
      register: {
        allowedFields: [
          "firstName", "lastName", "phoneNumber", "distribute_drafts", "artist_details",
          "Profile_image", "currency", "dob", "notifications", "user_type",
          "label_fee_histories", "admin_fee_histories", "invoices", "published_track_update_logs",
          "platformFeeOverride", "commissionOverride", "availableBalance", "pendingBalance",
          "paymentMethod", "payout_requests", "user_subscriptions", "payment_logs",
          "enterprise_commissions", "csv_report_logs", "billing_cards", "user_payout_details",
          "ticket_messages", "activity_logs", "user_activity_logs", "ticket_raises",
          "assigned_tickets", "resolved_tickets"
        ]
      }
    }
  }
});