// Minimal ESC/POS command builder for 58mm (32 col) / 80mm (48 col) thermal
// receipt printers. This is a byte-level protocol - there's no JSON response
// to sanity-check, so it has NOT been verified against real hardware in this
// environment (no thermal printer available here). The command set below
// (ESC @, ESC a, ESC E, GS V) is the widely-supported common subset most
// cheap ESC/POS-compatible printers implement the same way, but exact
// behavior can still vary by model - test against your real printer before
// relying on this for daily use.

const ESC = 0x1b;
const GS = 0x1d;

const encoder = new TextEncoder();

class ReceiptBuilder {
  constructor(columns = 32) {
    this.columns = columns;
    this.bytes = [];
  }

  raw(...codes) {
    this.bytes.push(...codes);
    return this;
  }

  text(str) {
    this.bytes.push(...encoder.encode(str));
    return this;
  }

  line(str = '') {
    return this.text(str).raw(0x0a);
  }

  init() {
    return this.raw(ESC, 0x40); // ESC @ - reset printer
  }

  align(mode) {
    // 0 = left, 1 = center, 2 = right
    return this.raw(ESC, 0x61, mode);
  }

  bold(on) {
    return this.raw(ESC, 0x45, on ? 1 : 0);
  }

  doubleHeight(on) {
    return this.raw(GS, 0x21, on ? 0x01 : 0x00);
  }

  divider(char = '-') {
    return this.line(char.repeat(this.columns));
  }

  // Two-column row: label left, value right-aligned, padded to `columns`.
  row(left, right) {
    const space = this.columns - left.length - right.length;
    return this.line(space > 0 ? left + ' '.repeat(space) + right : `${left} ${right}`);
  }

  feed(lines = 1) {
    return this.raw(0x0a).raw(...Array(Math.max(0, lines - 1)).fill(0x0a));
  }

  cut() {
    return this.raw(GS, 0x56, 0x00); // GS V 0 - full cut
  }

  build() {
    return new Uint8Array(this.bytes);
  }
}

const money = (n) => `Rs ${Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
const truncate = (str, len) => (str.length > len ? `${str.slice(0, len - 1)}.` : str);

// sale: the same shape Sales.jsx/POS.jsx already work with (items[], subtotal,
// discount, tax, totalAmount, paymentMethod, receiptNumber, createdAt).
export function buildReceiptBytes(sale, shop, { columns = 32 } = {}) {
  const b = new ReceiptBuilder(columns);
  b.init().align(1).bold(true).doubleHeight(true);
  b.line(shop?.name || 'RetailPro');
  b.doubleHeight(false).bold(false);
  if (shop?.address) b.line(truncate(shop.address, columns));
  if (shop?.phone) b.line(shop.phone);
  b.feed(1);

  b.align(0);
  b.line(`Receipt: ${sale.receiptNumber}`);
  b.line(new Date(sale.createdAt).toLocaleString('en-PK'));
  if (sale.customerId?.name) b.line(`Customer: ${sale.customerId.name}`);
  b.divider();

  sale.items.forEach((item) => {
    b.line(truncate(item.name, columns));
    b.row(`  ${item.quantity} x ${money(item.unitPrice)}`, money(item.subtotal));
  });
  b.divider();

  b.row('Subtotal', money(sale.subtotal));
  if (Number(sale.discount) > 0) b.row('Discount', `-${money(sale.discount)}`);
  if (Number(sale.tax) > 0) b.row('Tax', money(sale.tax));
  b.bold(true);
  b.row('TOTAL', money(sale.totalAmount));
  b.bold(false);
  b.row('Paid via', (sale.paymentMethod || '').toUpperCase());
  b.divider();

  b.align(1);
  b.line('Thank you for shopping with us!');
  b.feed(3);
  b.cut();

  return b.build();
}
