module.exports = {
    async changePassword(ctx) {
        try {
            /* =========================================================
               GET LOGGED IN USER
            ========================================================= */

            const user = ctx.state.user;

            if (!user) {
                return ctx.unauthorized("Unauthorized");
            }

            /* =========================================================
               GET BODY
            ========================================================= */

            const { currentPassword, newPassword } = ctx.request.body;

            if (!currentPassword || !newPassword) {
                return ctx.badRequest(
                    "Current password and new password are required"
                );
            }

            /* =========================================================
               PASSWORD VALIDATION
            ========================================================= */

            if (newPassword.length < 6) {
                return ctx.badRequest(
                    "Password must be at least 6 characters"
                );
            }

            /* =========================================================
               GET FULL USER
            ========================================================= */

            const existingUser = await strapi
                .query("plugin::users-permissions.user")
                .findOne({
                    where: {
                        id: user.id,
                    },
                });

            if (!existingUser) {
                return ctx.notFound("User not found");
            }

            /* =========================================================
               CHECK CURRENT PASSWORD
            ========================================================= */

            const isValidPassword = await strapi
                .plugin("users-permissions")
                .service("user")
                .validatePassword(
                    currentPassword,
                    existingUser.password
                );

            if (!isValidPassword) {
                return ctx.badRequest(
                    "Current password is incorrect"
                );
            }

            /* =========================================================
               CHECK IF NEW PASSWORD SAME AS OLD
            ========================================================= */

            const isSamePassword = await strapi
                .plugin("users-permissions")
                .service("user")
                .validatePassword(
                    newPassword,
                    existingUser.password
                );

            if (isSamePassword) {
                return ctx.badRequest(
                    "New password cannot be same as current password"
                );
            }

            /* =========================================================
               UPDATE PASSWORD
            ========================================================= */

            await strapi.entityService.update(
                "plugin::users-permissions.user",
                user.id,
                {
                    data: {
                        password: newPassword,
                    },
                }
            );

            /* =========================================================
               RESPONSE
            ========================================================= */

            return ctx.send({
                success: true,
                message: "Password changed successfully",
            });
        } catch (error) {
            console.log("CHANGE PASSWORD ERROR", error);

            return ctx.internalServerError(
                "Something went wrong"
            );
        }
    },
};