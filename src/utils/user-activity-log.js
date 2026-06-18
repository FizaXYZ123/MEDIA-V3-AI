const createUserActivityLog = async ({
  userId,
  action,
  description = "",
}) => {
  try {
    if (!userId || !action) return;

    await strapi.entityService.create(
      "api::user-activity-log.user-activity-log",
      {
        data: {
          users_permissions_user: userId,
          action,
          description,
          publishedAt:new Date()
        },
       
      }
    );
  } catch (error) {
    strapi.log.error(
      `[User Activity Log] ${error.message}`
    );
  }
};

module.exports = createUserActivityLog;