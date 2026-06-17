const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

const emailTemplates = {
  otpVerification: ({ name, otp, type }) => ({
    subject: type === "register"
      ? "MultiShop 🛍️ — Your Registration OTP"
      : "MultiShop 🔒 — Password Reset OTP",
    html: `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;background:#f8f9ff;border-radius:16px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#6366f1,#764ba2);padding:36px 32px;text-align:center;">
          <div style="font-size:42px;margin-bottom:8px;">🛍️</div>
          <h1 style="color:white;margin:0;font-size:26px;font-weight:800;letter-spacing:-0.5px;">MultiShop</h1>
        </div>
        <div style="padding:36px 32px;background:white;">
          <h2 style="color:#1e1b4b;margin:0 0 8px;font-size:22px;">
            ${type === "register" ? "Verify Your Email 📧" : "Reset Your Password 🔒"}
          </h2>
          <p style="color:#6b7280;margin:0 0 28px;line-height:1.6;">
            Hi <strong>${name}</strong>, use the OTP below to ${type === "register" ? "complete your registration" : "reset your password"}.
            This OTP is valid for <strong>10 minutes</strong>.
          </p>
          <div style="text-align:center;margin:0 0 28px;">
            <div style="display:inline-block;background:linear-gradient(135deg,#6366f1,#764ba2);border-radius:16px;padding:20px 40px;">
              <p style="color:rgba(255,255,255,0.8);font-size:12px;margin:0 0 6px;letter-spacing:3px;text-transform:uppercase;">Your OTP Code</p>
              <p style="color:white;font-size:40px;font-weight:900;letter-spacing:10px;margin:0;font-family:monospace;">${otp}</p>
            </div>
          </div>
          <div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:12px;padding:14px 18px;margin-bottom:24px;">
            <p style="color:#92400e;font-size:13px;margin:0;">
              ⚠️ <strong>Never share this OTP</strong> with anyone. MultiShop will never ask for your OTP via phone or email.
            </p>
          </div>
          <p style="color:#9ca3af;font-size:12px;margin:0;">
            Didn't request this? You can safely ignore this email. The code will expire automatically.
          </p>
        </div>
        <div style="background:#f5f5f5;padding:16px;text-align:center;color:#9ca3af;font-size:12px;">
          © ${new Date().getFullYear()} MultiShop. All rights reserved.
        </div>
      </div>
    `,
  }),

  emailVerification: ({ name, verifyUrl }) => ({
    subject: "Welcome to MultiShop 🛍️ — Verify Your Email",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:32px;text-align:center;">
          <h1 style="color:white;margin:0;font-size:28px;">🛍️ MultiShop</h1>
        </div>
        <div style="padding:32px;background:white;">
          <h2 style="color:#333;">Welcome, ${name}! 🎉</h2>
          <p style="color:#666;line-height:1.6;">You're almost ready to start shopping. Please verify your email address to activate your account.</p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${verifyUrl}" style="background:linear-gradient(135deg,#667eea,#764ba2);color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;">Verify Email Address</a>
          </div>
          <p style="color:#999;font-size:13px;">This link expires in 24 hours. If you didn't create an account, please ignore this email.</p>
        </div>
        <div style="background:#f5f5f5;padding:16px;text-align:center;color:#999;font-size:12px;">
          © 2024 MultiShop. All rights reserved.
        </div>
      </div>
    `,
  }),

  passwordReset: ({ name, resetUrl }) => ({
    subject: "MultiShop — Reset Your Password 🔒",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:32px;text-align:center;border-radius:12px 12px 0 0;">
          <h1 style="color:white;margin:0;">🛍️ MultiShop</h1>
        </div>
        <div style="padding:32px;background:white;border-radius:0 0 12px 12px;">
          <h2 style="color:#333;">Password Reset Request</h2>
          <p style="color:#666;">Hi ${name}, we received a request to reset your password.</p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${resetUrl}" style="background:#e53e3e;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;">Reset Password</a>
          </div>
          <p style="color:#999;font-size:13px;">This link expires in 10 minutes. If you didn't request this, please ignore this email.</p>
        </div>
      </div>
    `,
  }),

  orderConfirmation: ({ name, orderNumber, items, total }) => ({
    subject: `Order Confirmed! #${orderNumber} 🎉`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:32px;text-align:center;">
          <h1 style="color:white;margin:0;">🛍️ MultiShop</h1>
        </div>
        <div style="padding:32px;background:white;">
          <h2 style="color:#333;">Thank you, ${name}! 🎉</h2>
          <p style="color:#666;">Your order <strong>#${orderNumber}</strong> has been placed successfully.</p>
          <div style="background:#f9f9f9;padding:16px;border-radius:8px;margin:16px 0;">
            <p style="margin:0;font-weight:bold;color:#333;">Order Total: ₹${total}</p>
          </div>
          <p style="color:#666;">We'll send you updates as your order progresses.</p>
        </div>
      </div>
    `,
  }),
};

const sendEmail = async ({ email, template, data, subject, html }) => {
  let mailOptions;

  if (template && emailTemplates[template]) {
    const rendered = emailTemplates[template](data);
    mailOptions = {
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to: email,
      subject: rendered.subject,
      html: rendered.html,
    };
  } else {
    mailOptions = {
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to: email,
      subject,
      html,
    };
  }

  await transporter.sendMail(mailOptions);
};

module.exports = { sendEmail };