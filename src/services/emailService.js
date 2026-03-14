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

async function sendSignupRequestNotification(to, societyName, applicantName, applicantEmail) {
  const t = getTransporter();
  if (!t) {
    console.warn('Email not configured. Signup request:', applicantName, applicantEmail);
    return;
  }
  await t.sendMail({
    from: config.email.from,
    to,
    subject: `New member signup request – ${societyName}`,
    html: `
      <p>Hello,</p>
      <p>A new member has requested to join <strong>${societyName}</strong>.</p>
      <p><strong>Name:</strong> ${applicantName}</p>
      <p><strong>Email:</strong> ${applicantEmail}</p>
      <p>Please log in to the admin dashboard to approve or reject this request.</p>
    `,
  });
}

module.exports = { sendInviteEmail, sendSignupRequestNotification, getTransporter };
