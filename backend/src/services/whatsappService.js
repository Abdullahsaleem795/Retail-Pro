// WhatsApp Cloud API integration.
// Chosen over Twilio because Meta's Cloud API has no per-message markup, which
// matters for low-margin kiryana/medical stores sending daily reports.
// Falls back to a no-op (logged) send when credentials aren't configured, so
// local development and tests never fail on a missing token.

const API_VERSION = 'v21.0';

const isConfigured = () =>
  Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN);

// Every phone number in this app is entered/stored in the local Pakistani
// format (e.g. "03001234567", what a shopkeeper actually types) - but both
// wa.me links and the WhatsApp Cloud API's `to` field require full
// international format with NO leading trunk 0 ("923001234567"). Passing the
// local form straight through (as this code did before) makes wa.me show
// "phone number shared via url is invalid" and would make a real Cloud API
// send fail outright - this silently broke every WhatsApp touchpoint
// (supplier orders, low-stock alerts, daily/weekly reports) for any number
// stored in the format everyone actually uses. Confirmed live: every real
// phone number in the production database was in this local format.
const normalizePakistaniPhone = (phone) => {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('92')) return digits; // already international
  if (digits.startsWith('0')) return `92${digits.slice(1)}`; // local trunk 0 -> country code
  if (digits.length === 10) return `92${digits}`; // e.g. "3001234567", no leading 0
  return digits; // unrecognized shape - pass through rather than guess wrong
};

const sendTextMessage = async (to, body) => {
  const target = normalizePakistaniPhone(to);

  if (!isConfigured()) {
    console.warn(`[whatsapp] not configured - would have sent to ${target}: ${body.slice(0, 60)}...`);
    return { skipped: true };
  }

  const url = `https://graph.facebook.com/${API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: target,
      type: 'text',
      text: { body },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`WhatsApp send failed (${response.status}): ${errorBody}`);
  }

  return response.json();
};

const money = (amount) => `Rs ${Number(amount || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;

const buildLowStockMessage = (shopName, products) => {
  const lines = products
    .slice(0, 15)
    .map((p) => `• ${p.name} — ${p.stockQuantity} ${p.unit} left`)
    .join('\n');
  const more = products.length > 15 ? `\n...and ${products.length - 15} more items` : '';
  return `*${shopName}* — Low Stock Alert\n\nThese items need restocking:\n\n${lines}${more}`;
};

const buildDailySalesMessage = (shopName, stats) =>
  `*${shopName}* — Daily Sales Report\n${stats.date}\n\n` +
  `Total Sales: ${money(stats.totalSales)}\n` +
  `Transactions: ${stats.transactions}\n` +
  `Gross Profit: ${money(stats.grossProfit)}\n` +
  `Expenses: ${money(stats.expenses)}\n` +
  `*Net Profit: ${money(stats.netProfit)}*`;

const buildWeeklyProfitMessage = (shopName, stats) =>
  `*${shopName}* — Weekly Profit Report\n${stats.from} to ${stats.to}\n\n` +
  `Revenue: ${money(stats.revenue)}\n` +
  `Cost of Goods: ${money(stats.cogs)}\n` +
  `Gross Profit: ${money(stats.grossProfit)}\n` +
  `Expenses: ${money(stats.expenses)}\n` +
  `*Net Profit: ${money(stats.netProfit)}*`;

const buildSupplierOrderDraft = (shopName, supplierName, items) => {
  const lines = items.map((i) => `• ${i.name} — ${i.quantity} ${i.unit}`).join('\n');
  return `Assalam-o-Alaikum ${supplierName},\n\nThis is *${shopName}*. We would like to order:\n\n${lines}\n\nPlease confirm availability and total. JazakAllah.`;
};

const buildWhatsAppUrl = (phone, text) => {
  const cleanPhone = normalizePakistaniPhone(phone);
  const encodedText = encodeURIComponent(text);
  return cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodedText}` : `https://wa.me/?text=${encodedText}`;
};

module.exports = {
  isConfigured,
  normalizePakistaniPhone,
  sendTextMessage,
  buildLowStockMessage,
  buildDailySalesMessage,
  buildWeeklyProfitMessage,
  buildSupplierOrderDraft,
  buildWhatsAppUrl,
};
