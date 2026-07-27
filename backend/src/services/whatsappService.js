// WhatsApp Cloud API integration.
// Chosen over Twilio because Meta's Cloud API has no per-message markup, which
// matters for low-margin kiryana/medical stores sending daily reports.
// Falls back to a no-op (logged) send when credentials aren't configured, so
// local development and tests never fail on a missing token.

const API_VERSION = 'v21.0';

const isConfigured = () =>
  Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN);

const sendTextMessage = async (to, body) => {
  if (!isConfigured()) {
    console.warn(`[whatsapp] not configured - would have sent to ${to}: ${body.slice(0, 60)}...`);
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
      to,
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

module.exports = {
  isConfigured,
  sendTextMessage,
  buildLowStockMessage,
  buildDailySalesMessage,
  buildWeeklyProfitMessage,
  buildSupplierOrderDraft,
};
