// SMTP email notifications for the platform operator.
// Same graceful-degradation pattern as whatsappService: falls back to a
// logged no-op when SMTP isn't configured, so local dev/tests never fail on
// a missing credential.
const nodemailer = require('nodemailer');

const isConfigured = () =>
  Boolean(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS);

let cachedTransporter = null;
const getTransporter = () => {
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: Number(process.env.EMAIL_PORT) === 465,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
  }
  return cachedTransporter;
};

const sendMail = async ({ to, subject, text }) => {
  if (!to) {
    console.warn(`[email] no recipient configured - would have sent "${subject}"`);
    return { skipped: true };
  }
  if (!isConfigured()) {
    console.warn(`[email] SMTP not configured - would have sent to ${to}: ${subject}`);
    return { skipped: true };
  }

  return getTransporter().sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to,
    subject,
    text,
  });
};

// Fired the moment a shop submits an upgrade request (i.e. reports they've
// paid) - this is the actionable "go verify this payment" moment for the
// admin, same trigger point as the existing WhatsApp ping in
// shopController.requestSubscriptionUpgrade.
const sendUpgradePurchaseNotification = async ({
  to, shopName, ownerName, plan, paymentChannel, transactionId,
}) => {
  const planLabel = (plan || 'Pro').charAt(0).toUpperCase() + (plan || 'Pro').slice(1);
  const subject = `${planLabel} plan purchased by ${ownerName || shopName}`;
  const text =
    `${ownerName || 'A shop owner'} (${shopName}) has requested the ${planLabel} plan.\n\n` +
    `Payment channel: ${paymentChannel || 'Bank/Transfer'}\n` +
    `Transaction ID: ${transactionId || 'N/A'}\n\n` +
    `Verify the payment and activate the subscription from the Platform Console.`;

  try {
    return await sendMail({ to, subject, text });
  } catch (err) {
    // A broken SMTP config must never block the shop's own upgrade request -
    // the WhatsApp ping and in-app notification already carry this signal.
    console.error('[email] failed to send upgrade purchase notification:', err.message);
    return { error: err.message };
  }
};

module.exports = { isConfigured, sendMail, sendUpgradePurchaseNotification };
