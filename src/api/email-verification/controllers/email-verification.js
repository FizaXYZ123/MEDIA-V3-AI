const axios = require("axios");
const crypto = require("crypto");

const verificationStore = {};

module.exports = {

  async sendVerification(ctx) {
    const { email } = ctx.request.body;

    if (!email) {
      return ctx.badRequest("Email is required");
    }

    try {

      // Generate a 5-digit OTP
      const otp = Math.floor(10000 + Math.random() * 90000).toString();

      // Store OTP and set initial verification status

      const normalizedEmail = email.toLowerCase().trim();

      verificationStore[normalizedEmail] = {
        otp,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes validity
        verified: false,
      };

      const msg = {
        to: email,
        from: process.env.BREVO_FROM_EMAIL,
        subject: "Your OTP Code",
        text: `Your OTP code is ${otp}`,
        html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Your OTP Code</title>
<style>
body{font-family:Arial,sans-serif;margin:0;padding:0;background-color:#f7f7f7;text-align:center;color:#333}
.container{max-width:600px;margin:30px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,0.1)}
.header{background-color:#6e36be;padding:20px}
.header img{max-height:60px}
.title{color:#fff;font-size:22px;font-weight:bold;margin-top:10px}
.content{padding:25px 20px}
.content p{font-size:16px;margin:10px 0}
.otp-code{font-size:36px;font-weight:bold;color:#6e36be;margin:20px 0}
.footer{font-size:14px;color:#777;padding:15px;background:#f0f0f0}
</style>
</head>
<body>
<div class="container">
<div class="header">
<img src="https://admin.amozart.com/assets/updateLogo-DoU658F0.png" alt="XYZ Media Logo">
<div class="title">OTP Verification</div>
</div>
<div class="content">
<p>Hello,</p>
<p>Your OTP code is:</p>
<div class="otp-code">${otp}</div>
<p>Please enter this code to complete your verification process.</p>
</div>
<div class="footer">
<p>If you did not request this, please ignore this email.</p>
<p>Thank you,<br>AMozart Team</p>
</div>
</div>
</body>
</html>`
      };

      /* ===== BREVO EMAIL SEND ===== */

      await axios.post(
        "https://api.brevo.com/v3/smtp/email",
        {
          sender: {
            name: "AMozart",
            email: msg.from,
          },
          to: [
            {
              email: msg.to,
            },
          ],
          subject: msg.subject,
          htmlContent: msg.html,
        },
        {
          headers: {
            "api-key": process.env.BREVO_API_KEY,
            "Content-Type": "application/json",
          },
        }
      );

      ctx.send({ message: "Verification email sent" });

    } catch (error) {
      console.error(
        "Failed to send verification email:",
        error.response ? error.response.body : error.message
      );
      ctx.internalServerError("Failed to send verification email");
    }
  },

  async verifyOtp(ctx) {

    const { email, otp } = ctx.request.body;

    const response = {
      approved: false,
      details: [],
      resetToken: null,
    };

    if (!email || !otp) {
      response.details.push("Email and OTP are required");
      return ctx.send(response);
    }

    try {

      const normalizedEmail = email.toLowerCase().trim();

      const entry = verificationStore[normalizedEmail];

      console.log("VERIFY EMAIL:", normalizedEmail);
      console.log("RECEIVED OTP:", otp);
      console.log("STORED ENTRY:", entry);

      if (!entry) {
        response.details.push("Invalid OTP");
        return ctx.send(response);
      }

      if (new Date() > new Date(entry.expiresAt)) {
        response.details.push("OTP has expired");
        return ctx.send(response);
      }

      if (String(otp) !== String(entry.otp)) {
        response.details.push("Invalid OTP");
        return ctx.send(response);
      }

      entry.verified = true;

      response.approved = true;
      response.details.push("OTP verified successfully");

      const resetToken = crypto.randomBytes(32).toString("hex");
      response.resetToken = resetToken;

      await strapi.db.query("plugin::users-permissions.user").update({
        where: { email: normalizedEmail },
        data: {
          resetPasswordToken: resetToken,
        },
      });

    } catch (error) {

      console.error("Failed to verify OTP:", error);

      response.details.push("Failed to verify OTP");

    }

    ctx.send(response);

  },

  async checkVerificationStatus(ctx) {
    const { email } = ctx.request.query;

    if (!email) {
      return ctx.badRequest("Email is required");
    }

    const entry = verificationStore[email];

    if (entry && entry.verified) {
      return ctx.send({ verified: true, message: "Email is verified" });
    } else {
      return ctx.send({
        verified: false,
        message: "Email is not verified or does not exist",
      });
    }
  },
};