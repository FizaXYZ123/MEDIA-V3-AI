const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

module.exports = {
  async sendVerificationEmail(email) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await strapi.db.query('api::email-verification.email-verification').create({
      data: {
        email,
        otp,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes validity
      },
    });

    const msg = {
      to: email,
      from: process.env.SENDGRID_FROM_EMAIL,
      subject: 'Your OTP Code',
      text: `Your OTP code is ${otp}`,
      html: `<strong>Your OTP code is ${otp}</strong>`,
    };

    try {
      await sgMail.send(msg);
      return { success: true };
    } catch (error) {
      throw new Error('Failed to send verification email: ' + error.message);
    }
  },

  async verifyOtp(email, otp) {
    const otpEntry = await strapi.db.query('api::email-verification.email-verification').findOne({
      where: { email, otp },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpEntry) {
      throw new Error('Invalid OTP');
    }

    if (new Date() > new Date(otpEntry.expiresAt)) {
      throw new Error('OTP has expired');
    }

    await strapi.db.query('api::email-verification.email-verification').delete({
      where: { id: otpEntry.id },
    });

    return { success: true };
  },
};
