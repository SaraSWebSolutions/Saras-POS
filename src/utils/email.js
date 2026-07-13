const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

exports.generateOTP = () => String(Math.floor(100000 + Math.random() * 900000)); // 6 digits

exports.sendOTPEmail = async (to, otp) => {
  // In development, if SMTP isn't configured, just log the OTP instead of failing.
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`[DEV] OTP for ${to}: ${otp}`);
    return;
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: "Saras POS - Password Reset OTP",
    html: `<p>Your OTP for password reset is <b>${otp}</b>. It is valid for 10 minutes.</p>`,
  });
};
