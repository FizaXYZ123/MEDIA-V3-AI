"use strict";

const axios = require("axios");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

module.exports = {

  // =====================================================
  // 1. SEND OTP
  // =====================================================
  async sendOtp(ctx) {
    try {
      const { email } = ctx.request.body;

      if (!email) return ctx.badRequest("Email required");

      const normalizedEmail = email.toLowerCase().trim();

      // ✅ check user exists
      const user = await strapi.db.query("plugin::users-permissions.user").findOne({
        where: { email: normalizedEmail },
      });

      if (!user) return ctx.badRequest("User not found");

      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

      // 🔥 delete old entry
      const existing = await strapi.db.query("api::forget-password.forget-password").findOne({
        where: { email: normalizedEmail },
        publicationState: "preview",
      });

      if (existing) {
        await strapi.db.query("api::forget-password.forget-password").delete({
          where: { id: existing.id },
        });
      }

      // ✅ create new entry (PUBLISHED)
      await strapi.db.query("api::forget-password.forget-password").create({
        data: {
          email: normalizedEmail,
          otp: hashedOtp,
          otpExpiry: new Date(Date.now() + 5 * 60 * 1000),
          otpVerified: false,
          publishedAt: new Date(), // ✅ IMPORTANT
        },
      });

      console.log("OTP:", otp);

      // ✅ send email via Brevo
      await axios.post(
        "https://api.brevo.com/v3/smtp/email",
        {
          sender: {
            name: "Amozart",
            email: process.env.BREVO_FROM_EMAIL,
          },
          to: [{ email: normalizedEmail }],
          subject: "Reset Your Password - OTP Code",
           textContent: `Your OTP is ${otp}. It is valid for 5 minutes.`,
      htmlContent: `
<!DOCTYPE html>
<html>
<body style="margin:0; padding:0; background:#f4f6f8; font-family:Arial, sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8; padding:20px 10px;">
<tr>
<td align="center">

<table width="100%" cellpadding="0" cellspacing="0" style="max-width:500px; background:#ffffff; border-radius:10px; overflow:hidden;">

  <!-- HEADER -->
  <tr>
    <td align="center" style="background:#6e36be; padding:18px;">
      <img src="https://admin.amozart.com/assets/updateLogo-DoU658F0.png" style="max-width:120px;" />
      <div style="color:#ffffff; font-size:18px; font-weight:bold; margin-top:8px;">
        Reset Your Password
      </div>
    </td>
  </tr>

  <!-- BODY -->
  <tr>
    <td style="padding:20px;">
      
      <p style="font-size:14px; color:#333;">Hello,</p>

      <p style="font-size:14px; color:#555;">
        We received a request to reset your password.
      </p>

      <p style="font-size:14px; color:#555;">
        Use the OTP below to continue:
      </p>

      <!-- OTP BOX -->
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" style="padding:15px 0;">
            <div style="
              background:#f3edff;
              padding:14px 20px;
              border-radius:8px;
              font-size:26px;
              font-weight:bold;
              color:#6e36be;
              letter-spacing:4px;
              display:inline-block;
            ">
              ${otp}
            </div>
          </td>
        </tr>
      </table>

      <p style="font-size:13px; color:#555; text-align:center;">
        This OTP is valid for <strong>5 minutes</strong>.
      </p>

      <!-- WARNING -->
      <div style="
        background:#fff4e5;
        border-left:4px solid #ff9800;
        padding:10px;
        font-size:12px;
        color:#7a5d1a;
        border-radius:6px;
        margin-top:15px;
      ">
        ⚠️ Do not share this OTP with anyone. Our team will never ask for it.
      </div>

      <p style="font-size:13px; color:#777; margin-top:15px;">
        If you didn’t request this, you can safely ignore this email.
      </p>

    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td align="center" style="padding:15px; font-size:11px; color:#999; background:#fafafa;">
      © ${new Date().getFullYear()} Amozart. All rights reserved.
    </td>
  </tr>

</table>

</td>
</tr>
</table>

</body>
</html>
`,
         
        },
        {
          headers: {
            "api-key": process.env.BREVO_API_KEY,
            "Content-Type": "application/json",
          },
        }
      );

      return ctx.send({ message: "OTP sent successfully" });

    } catch (error) {
      console.error("SEND OTP ERROR:", error.response?.data || error.message);
      return ctx.internalServerError("Failed to send OTP");
    }
  },

  // =====================================================
  // 2. VERIFY OTP
  // =====================================================
  async verifyOtp(ctx) {
    try {
      const { email, otp } = ctx.request.body;

      if (!email || !otp) {
        return ctx.badRequest("Email and OTP required");
      }

      const normalizedEmail = email.toLowerCase().trim();

      const entry = await strapi.db.query("api::forget-password.forget-password").findOne({
        where: { email: normalizedEmail },
        publicationState: "preview",
      });

      if (!entry) {
        return ctx.badRequest("OTP not found. Please request a new OTP.");
      }


      // expiry check
      if (new Date() > new Date(entry.otpExpiry)) {
        return ctx.badRequest("OTP expired, please request a new one.");
      }

      const hashedOtp = crypto.createHash("sha256").update(String(otp)).digest("hex");

      if (hashedOtp !== entry.otp) {
        return ctx.badRequest("Invalid OTP");
      }

      // mark verified
      await strapi.db.query("api::forget-password.forget-password").update({
        where: { id: entry.id },
        data: {
          otpVerified: true,
          publishedAt: new Date(),
        },
      });

      return ctx.send({ message: "OTP verified successfully" });

    } catch (error) {
      console.error("VERIFY OTP ERROR:", error);
      return ctx.internalServerError("Failed to verify OTP");
    }
  },

  async resendOtp(ctx) {
    try {
      const { email } = ctx.request.body;

      if (!email) return ctx.badRequest("Email required");

      const normalizedEmail = email.toLowerCase().trim();

      const entry = await strapi.db.query("api::forget-password.forget-password").findOne({
        where: { email: normalizedEmail },
        publicationState: "preview",
      });

      if (!entry) {
        return ctx.badRequest("No OTP request found. Please send OTP first.");
      }

      const now = new Date();

      // 🔥 CHECK IF OTP STILL VALID
      if (entry.otpExpiry && new Date(entry.otpExpiry) > now) {
        return ctx.badRequest("OTP is still valid. Please wait before requesting a new one.");
      }

      // ✅ generate new OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

      // ✅ update entry
      await strapi.db.query("api::forget-password.forget-password").update({
        where: { id: entry.id },
        data: {
          otp: hashedOtp,
          otpExpiry: new Date(Date.now() + 5 * 60 * 1000), // ✅ 5 mins
          otpVerified: false,
          publishedAt: new Date(),
        },
      });

      console.log("Resent OTP:", otp);

      // ✅ send email
      await axios.post(
        "https://api.brevo.com/v3/smtp/email",
        {
          sender: {
            name: "Amozart",
            email: process.env.BREVO_FROM_EMAIL,
          },
          to: [{ email: normalizedEmail }],
          subject: "Reset Your Password - OTP Code",
           textContent: `Your OTP is ${otp}. It is valid for 5 minutes.`,
      htmlContent: `
<!DOCTYPE html>
<html>
<body style="margin:0; padding:0; background:#f4f6f8; font-family:Arial, sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8; padding:20px 10px;">
<tr>
<td align="center">

<table width="100%" cellpadding="0" cellspacing="0" style="max-width:500px; background:#ffffff; border-radius:10px; overflow:hidden;">

  <!-- HEADER -->
  <tr>
    <td align="center" style="background:#6e36be; padding:18px;">
      <img src="https://admin.amozart.com/assets/updateLogo-DoU658F0.png" style="max-width:120px;" />
      <div style="color:#ffffff; font-size:18px; font-weight:bold; margin-top:8px;">
        Reset Your Password
      </div>
    </td>
  </tr>

  <!-- BODY -->
  <tr>
    <td style="padding:20px;">
      
      <p style="font-size:14px; color:#333;">Hello,</p>

      <p style="font-size:14px; color:#555;">
        We received a request to reset your password.
      </p>

      <p style="font-size:14px; color:#555;">
        Use the OTP below to continue:
      </p>

      <!-- OTP BOX -->
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" style="padding:15px 0;">
            <div style="
              background:#f3edff;
              padding:14px 20px;
              border-radius:8px;
              font-size:26px;
              font-weight:bold;
              color:#6e36be;
              letter-spacing:4px;
              display:inline-block;
            ">
              ${otp}
            </div>
          </td>
        </tr>
      </table>

      <p style="font-size:13px; color:#555; text-align:center;">
        This OTP is valid for <strong>5 minutes</strong>.
      </p>

      <!-- WARNING -->
      <div style="
        background:#fff4e5;
        border-left:4px solid #ff9800;
        padding:10px;
        font-size:12px;
        color:#7a5d1a;
        border-radius:6px;
        margin-top:15px;
      ">
        ⚠️ Do not share this OTP with anyone. Our team will never ask for it.
      </div>

      <p style="font-size:13px; color:#777; margin-top:15px;">
        If you didn’t request this, you can safely ignore this email.
      </p>

    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td align="center" style="padding:15px; font-size:11px; color:#999; background:#fafafa;">
      © ${new Date().getFullYear()} Amozart. All rights reserved.
    </td>
  </tr>

</table>

</td>
</tr>
</table>

</body>
</html>
`,
        },
        {
          headers: {
            "api-key": process.env.BREVO_API_KEY,
            "Content-Type": "application/json",
          },
        }
      );

      return ctx.send({
        message: "OTP resent successfully",
      });

    } catch (error) {
      console.error("RESEND OTP ERROR:", error.response?.data || error.message);
      return ctx.internalServerError("Failed to resend OTP");
    }
  },

  // =====================================================
  // 3. RESET PASSWORD
  // =====================================================
  async resetPassword(ctx) {
    try {
      const { email, newPassword } = ctx.request.body;

      if (!email || !newPassword) {
        return ctx.badRequest("Email and new password required");
      }

      const normalizedEmail = email.toLowerCase().trim();

      const entry = await strapi.db.query("api::forget-password.forget-password").findOne({
        where: { email: normalizedEmail },
        publicationState: "preview",
      });

      if (!entry || !entry.otpVerified) {
        return ctx.badRequest("OTP not verified");
      }

      const user = await strapi.db.query("plugin::users-permissions.user").findOne({
        where: { email: normalizedEmail },
      });

      if (!user) return ctx.badRequest("User not found");

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await strapi.db.query("plugin::users-permissions.user").update({
        where: { id: user.id },
        data: { password: hashedPassword },
      });

      // 🔥 DELETE OTP ENTRY AFTER SUCCESS
      await strapi.db.query("api::forget-password.forget-password").delete({
        where: { id: entry.id },
      });

      return ctx.send({
        message: "Password reset successful",
      });

    } catch (error) {
      console.error("RESET PASSWORD ERROR:", error);
      return ctx.internalServerError("Failed to reset password");
    }
  },

};