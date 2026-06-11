// src/utils/activity-log.js

module.exports = async ({
    user,
    action,
    module,
    entityId,
    entityName,
    description,
}) => {
    try {
        if (!user || !action || !module) {
            return;
        }

        await strapi.entityService.create(
            "api::activity-log.activity-log",
            {
                data: {
                    users_permissions_user: user.id,
                    userRole: user.role?.name || null,
                    action,
                    module,
                    entityId: entityId?.toString(),
                    entityName,
                    description,
                    publishedAt: new Date()
                },
            }
        );
    } catch (error) {
        strapi.log.error("Failed to create activity log:", error);
    }
};