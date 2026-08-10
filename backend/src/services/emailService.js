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

const sendMail = async ({ to, subject, text, html }) => {
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
    html,
  });
};

// Only ever interpolates our own known-shape strings (shop/owner names,
// payment channel, TRX id) into the HTML body below - escaped so a shop
// owner can't smuggle markup into an email that opens in the admin's inbox.
const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Fired the moment a shop submits an upgrade request (i.e. reports they've
// paid) - this is the actionable "go verify this payment" moment for the
// admin, same trigger point as the existing WhatsApp ping in
// shopController.requestSubscriptionUpgrade. `confirmUrl` is the signed
// one-click activation link (see utils/activationToken.js) - included as a
// real button in the HTML body, and as a plain URL in the text fallback for
// clients that strip HTML.
const sendUpgradePurchaseNotification = async ({
  to, shopName, ownerName, plan, paymentChannel, transactionId, confirmUrl,
}) => {
  const planLabel = (plan || 'Pro').charAt(0).toUpperCase() + (plan || 'Pro').slice(1);
  const subject = `${planLabel} plan purchased by ${ownerName || shopName}`;
  const text =
    `${ownerName || 'A shop owner'} (${shopName}) has requested the ${planLabel} plan.\n\n` +
    `Payment channel: ${paymentChannel || 'Bank/Transfer'}\n` +
    `Transaction ID: ${transactionId || 'N/A'}\n\n` +
    (confirmUrl
      ? `Verify the payment, then confirm & activate here:\n${confirmUrl}\n\n(Opens the Platform Console - you'll still need your admin key.)`
      : 'Verify the payment and activate the subscription from the Platform Console.');

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;">
      <p>${escapeHtml(ownerName || 'A shop owner')} (<strong>${escapeHtml(shopName)}</strong>) has requested the <strong>${escapeHtml(planLabel)}</strong> plan.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
        <tr><td style="padding:4px 0;color:#6b7280;">Payment channel</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(paymentChannel || 'Bank/Transfer')}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">Transaction ID</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(transactionId || 'N/A')}</td></tr>
      </table>
      ${confirmUrl ? `
        <p><a href="${confirmUrl}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600;">Confirm &amp; Activate</a></p>
        <p style="font-size:12px;color:#6b7280;">Verify the payment first. Opening this link still requires your admin key - it does not bypass that.</p>
      ` : '<p>Verify the payment and activate the subscription from the Platform Console.</p>'}
    </div>
  `;

  try {
    return await sendMail({ to, subject, text, html });
  } catch (err) {
    // A broken SMTP config must never block the shop's own upgrade request -
    // the WhatsApp ping and in-app notification already carry this signal.
    console.error('[email] failed to send upgrade purchase notification:', err.message);
    return { error: err.message };
  }
};

module.exports = { isConfigured, sendMail, sendUpgradePurchaseNotification };
