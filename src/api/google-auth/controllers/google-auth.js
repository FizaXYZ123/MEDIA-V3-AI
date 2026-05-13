"use strict";

const { OAuth2Client } = require("google-auth-library");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const os = require("os");
const sharp = require("sharp");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

module.exports = {

  async googleLogin(ctx) {
    console.log("\n================= 🚀 GOOGLE LOGIN START =================");

    try {
      const { idToken } = ctx.request.body;

      if (!idToken) {
        return ctx.badRequest("Missing idToken");
      }

      /* ================= VERIFY GOOGLE TOKEN ================= */

      const ticket = await client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();

      if (!payload?.email) {
        return ctx.badRequest("Invalid Google token");
      }

      /* ================= USER DATA ================= */

      const email = payload.email.toLowerCase();
      const firstName = payload.given_name || "";
      const lastName = payload.family_name || "";
      const fullName = payload.name || `${firstName} ${lastName}`.trim();
      const phoneNumber = payload.phone_number || "";
      const googleProfilePicture = payload.picture || null;

      /* ================= USERNAME ================= */

      const base = (firstName || "user")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "");

      let username;
      let exists = true;

      while (exists) {
        const randomNumber = Math.floor(1000 + Math.random() * 9000);
        username = `${base}${randomNumber}`;

        const check = await strapi.db
          .query("plugin::users-permissions.user")
          .findOne({
            where: { username },
          });

        if (!check) {
          exists = false;
        }
      }

      /* ================= ROLE ================= */

      const userRole = await strapi.db
        .query("plugin::users-permissions.role")
        .findOne({
          where: { name: "Client" },
        });

      if (!userRole) {
        return ctx.internalServerError("Client role not found");
      }

      /* ================= FIND USER ================= */

      let user = await strapi.db
        .query("plugin::users-permissions.user")
        .findOne({
          where: { email },
          populate: ["Profile_image"],
        });

      /* ================= TOKEN ================= */

      const confirmationToken = crypto.randomBytes(32).toString("hex");

      /* ================= RANDOM PASSWORD ================= */

      const generatedPassword = crypto.randomBytes(12).toString("hex");

      /* ================= GOOGLE PROFILE IMAGE UPLOAD TO S3 ================= */

      let uploadedProfileImageId = null;

      if (googleProfilePicture && (!user || !user.Profile_image)) {
        let originalTempPath = null;
        let finalPath = null;

        try {
          console.log("🖼️ Google profile image found:", googleProfilePicture);

          const imageResponse = await fetch(googleProfilePicture);

          if (imageResponse.ok) {
            const arrayBuffer = await imageResponse.arrayBuffer();
            const originalBuffer = Buffer.from(arrayBuffer);

            originalTempPath = path.join(
              os.tmpdir(),
              `${username}-google-profile-original-${Date.now()}.jpg`
            );

            finalPath = path.join(
              os.tmpdir(),
              `${username}-google-profile-${Date.now()}.png`
            );

            fs.writeFileSync(originalTempPath, originalBuffer);

            console.log("🖼️ Converting Google image to PNG...");

            const pngBuffer = await sharp(originalTempPath)
              .png({ compressionLevel: 9 })
              .toBuffer();

            fs.writeFileSync(finalPath, pngBuffer);

            const finalSize = fs.statSync(finalPath).size;

            console.log("📤 Uploading Google profile image to Strapi/S3...");

            const uploadedFiles = await strapi
              .plugin("upload")
              .service("upload")
              .upload({
                data: {},
                files: {
                  path: finalPath,
                  name: `${username}-google-profile.png`,
                  type: "image/png",
                  size: finalSize,
                },
              });

            if (uploadedFiles && uploadedFiles.length > 0) {
              uploadedProfileImageId = uploadedFiles[0].id;

              console.log("✅ Google profile image uploaded");
              console.log("🆔 File ID:", uploadedFiles[0].id);
              console.log("🌍 URL:", uploadedFiles[0].url);
            }
          }
        } catch (uploadErr) {
          console.error("GOOGLE PROFILE IMAGE UPLOAD ERROR:", uploadErr);
        } finally {
          if (originalTempPath && fs.existsSync(originalTempPath)) {
            fs.unlinkSync(originalTempPath);
          }

          if (finalPath && fs.existsSync(finalPath)) {
            fs.unlinkSync(finalPath);
          }
        }
      }

      /* ================= CREATE / UPDATE USER ================= */

      if (!user) {
        user = await strapi.entityService.create(
          "plugin::users-permissions.user",
          {
            data: {
              firstName,
              lastName,
              FulllName: fullName,
              username,
              email,
              phoneNumber,
              provider: "google",
              confirmed: true,
              confirmationToken,
              role: userRole.id,
              password: generatedPassword,

              ...(uploadedProfileImageId && {
                Profile_image: uploadedProfileImageId,
              }),
            },
          }
        );
      } else {
        const updateData = {
          confirmationToken,
          confirmed: true,

          ...(!user.Profile_image &&
            uploadedProfileImageId && {
            Profile_image: uploadedProfileImageId,
          }),
        };

        await strapi.db.query("plugin::users-permissions.user").update({
          where: { id: user.id },
          data: updateData,
        });
      }

      /* ================= JWT ================= */

      const jwt = strapi.plugins["users-permissions"].services.jwt.issue({
        id: user.id,
      });

      /* ================= USER DETAILS ================= */

      const latestUser = await strapi.entityService.findOne(
        "plugin::users-permissions.user",
        user.id,
        {
          populate: ["role", "Profile_image"],
        }
      );

      /* ================= SUBSCRIPTION ================= */

      const subscription = await strapi.db
        .query("api::user-subscription.user-subscription")
        .findMany({
          where: {
            users_permissions_user: user.id,
          },
          orderBy: { createdAt: "desc" },
          limit: 1,
          populate: ["plan"],
        });

      const latest_subscription = subscription[0] || null;

      /* ================= RESPONSE ================= */

      return ctx.send({
        jwt,

        user: {
          ...latestUser,
          latest_subscription,
        },
      });
    } catch (err) {
      console.error("GOOGLE LOGIN ERROR:", err);

      return ctx.internalServerError("Google Login Failed");
    }
  },
};
