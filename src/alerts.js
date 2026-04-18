import axios from 'axios';
import nodemailer from 'nodemailer';
import config from './config.js';

let transporter;

function hasDiscordConfig() {
  return Boolean(config.alerts.discordWebhookUrl);
}

function hasEmailConfig() {
  return Boolean(
    config.alerts.fromEmail &&
      config.alerts.toEmail &&
      config.alerts.smtpHost &&
      config.alerts.smtpUser &&
      config.alerts.smtpPass
  );
}

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.alerts.smtpHost,
      port: config.alerts.smtpPort,
      secure: config.alerts.smtpSecure,
      auth: {
        user: config.alerts.smtpUser,
        pass: config.alerts.smtpPass
      }
    });
  }

  return transporter;
}

function safeErrorMessage(error) {
  if (!error) return 'Unknown error';
  return error.message || String(error);
}

function buildAlertText({ title, orderId, stage, error }) {
  const lines = [
    `Title: ${title}`,
    `Time: ${new Date().toISOString()}`,
    `Order ID: ${orderId || 'unknown'}`,
    `Stage: ${stage || 'unknown'}`,
    `Error: ${safeErrorMessage(error)}`
  ];

  return lines.join('\n');
}

async function sendDiscordAlert(messageText) {
  if (!hasDiscordConfig()) {
    return;
  }

  await axios.post(
    config.alerts.discordWebhookUrl,
    { content: `Dropship Alert\n\n${messageText}` },
    { timeout: 10000 }
  );
}

async function sendEmailAlert(subject, messageText) {
  if (!hasEmailConfig()) {
    return;
  }

  const mailer = getTransporter();
  await mailer.sendMail({
    from: config.alerts.fromEmail,
    to: config.alerts.toEmail,
    subject,
    text: messageText
  });
}

export async function sendFailureAlert({ title, orderId, stage, error }) {
  const messageText = buildAlertText({ title, orderId, stage, error });
  const subject = `[Dropship Alert] ${title}${orderId ? ` (Order ${orderId})` : ''}`;

  const tasks = [sendDiscordAlert(messageText), sendEmailAlert(subject, messageText)];
  const results = await Promise.allSettled(tasks);

  results.forEach((result) => {
    if (result.status === 'rejected') {
      console.error('Alert delivery failed:', result.reason?.message || result.reason);
    }
  });
}
