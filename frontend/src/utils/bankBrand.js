// Monogram + brand colour for a payment method, so the upgrade screen can show
// a recognisable mark next to each bank instead of a wall of identical text.
//
// Not remote logo images: bank logos are trademarked, would need hosting/
// licensing, and a broken <img> on the billing screen looks far worse than a
// clean mark. For the four payment methods this platform actually settles
// through today (JazzCash, EasyPaisa, Meezan, HBL), `logo` names a hand-drawn
// SVG recreation in PaymentMonogram.jsx - same nominative use as any checkout
// page showing "we accept Visa" with a simple vector card mark, not a
// redistributed brand asset. Every other bank falls back to a tinted
// lettermark, which needs no licensing at all.
//
// Order matters - the first pattern that matches wins, so more specific names
// (Habib Metro, Bank Islami) must come before the looser ones they contain
// (HBL/Habib, Islami).
const BRANDS = [
  { match: /jazz\s*-?\s*cash/i, initials: 'JC', color: '#C8102E', logo: 'jazzcash' },
  { match: /easy\s*-?\s*paisa/i, initials: 'EP', color: '#00A651', logo: 'easypaisa' },

  { match: /habib\s*metro|metropolitan/i, initials: 'HM', color: '#004B87' },
  { match: /meezan/i, initials: 'MZ', color: '#00614A', logo: 'meezan' },
  { match: /\bhbl\b|habib\s*bank/i, initials: 'HBL', color: '#00954C', logo: 'hbl' },
  { match: /\bubl\b|united\s*bank/i, initials: 'UBL', color: '#0B4EA2' },
  { match: /\bmcb\b|muslim\s*commercial/i, initials: 'MCB', color: '#00693E' },
  { match: /\babl\b|allied\s*bank/i, initials: 'ABL', color: '#00539B' },
  { match: /alfalah|al\s*falah/i, initials: 'BAF', color: '#B01C2E' },
  { match: /faysal/i, initials: 'FBL', color: '#007A53' },
  { match: /\bjs\s*bank\b|\bjs\b/i, initials: 'JS', color: '#00263A' },
  { match: /askari/i, initials: 'AKBL', color: '#8C1D2C' },
  { match: /standard\s*chartered|\bscb\b/i, initials: 'SC', color: '#0473EA' },
  { match: /soneri/i, initials: 'SNR', color: '#E4681B' },
  { match: /summit/i, initials: 'SMT', color: '#12508F' },
  { match: /bank\s*of\s*punjab|\bbop\b/i, initials: 'BOP', color: '#046A38' },
  { match: /national\s*bank|\bnbp\b/i, initials: 'NBP', color: '#00573F' },
  { match: /dubai\s*islamic|\bdib\b/i, initials: 'DIB', color: '#00843D' },
  { match: /bank\s*islami|bankislami/i, initials: 'BIP', color: '#00776B' },
  { match: /al\s*baraka/i, initials: 'ABP', color: '#0F7B4F' },
  { match: /sindh\s*bank/i, initials: 'SNDH', color: '#00733E' },
  { match: /silk\s*bank/i, initials: 'SILK', color: '#7A2A82' },
  { match: /samba/i, initials: 'SMB', color: '#0A5C36' },
  { match: /first\s*women/i, initials: 'FWB', color: '#A6297C' },
  { match: /zarai|\bztbl\b/i, initials: 'ZTBL', color: '#2E6E3F' },
  { match: /khushhali/i, initials: 'KMBL', color: '#E36F1E' },
  { match: /\bmcb\s*islamic/i, initials: 'MIB', color: '#00693E' },
];

// Neutral, professional fallbacks for a bank we don't have brand colours for.
// Picked by a stable hash of the name so the same bank always gets the same
// colour instead of shuffling between renders.
const FALLBACK_COLORS = ['#334155', '#1E4E79', '#155E52', '#5B3A78', '#7A4B1E', '#8C1D2C'];

const hashString = (value) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

// "Meezan / HBL" -> "MH", "United Bank Limited" -> "UB": first letter of the
// first two meaningful words, skipping filler that would produce a useless
// mark ("Bank of Punjab" shouldn't become "BO").
const FILLER = /^(bank|of|the|limited|ltd|pakistan|and|company|co)$/i;

const deriveInitials = (name) => {
  const words = name.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const meaningful = words.filter((w) => !FILLER.test(w));
  const source = meaningful.length ? meaningful : words;
  if (!source.length) return '?';
  if (source.length === 1) return source[0].slice(0, 2).toUpperCase();
  return (source[0][0] + source[1][0]).toUpperCase();
};

export const getBankBrand = (name) => {
  const clean = (name || '').trim();
  if (!clean) return { initials: '?', color: FALLBACK_COLORS[0], logo: null };

  const known = BRANDS.find((b) => b.match.test(clean));
  if (known) return { initials: known.initials, color: known.color, logo: known.logo || null };

  return {
    initials: deriveInitials(clean),
    color: FALLBACK_COLORS[hashString(clean.toLowerCase()) % FALLBACK_COLORS.length],
    logo: null,
  };
};

export default getBankBrand;
