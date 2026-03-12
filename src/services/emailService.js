const nodemailer = require('nodemailer');
const config = require('../config');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (config.email.host && config.email.user) {
    transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.port === 465,
      auth: {
        user: config.email.user,
        pass: config.email.pass,
      },
    });
  }
  return transporter;
}

async function sendInviteEmail(to, societyName, inviteUrl) {
  const t = getTransporter();
  if (!t) {
    console.warn('Email not configured. Invite URL:', inviteUrl);
    return;
  }
  await t.sendMail({
    from: config.email.from,
    to,
    subject: `You're invited to join ${societyName} on our platform`,
    html: `
      <p>Hello,</p>
      <p>You have been invited to onboard <strong>${societyName}</strong> on our Society Management Platform.</p>
      <p>Click the link below to complete onboarding:</p>
      <p><a href="${inviteUrl}">${inviteUrl}</a></p>
      <p>This link expires in 7 days.</p>
    `,
  });
}

module.exports = { sendInviteEmail, getTransporter };
