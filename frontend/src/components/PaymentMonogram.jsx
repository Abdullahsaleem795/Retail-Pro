import { getBankBrand } from '../utils/bankBrand';

// Hand-drawn vector recreations of the four payment marks this platform
// actually settles through, using each brand's real colours - the same
// nominative use as any checkout page showing a simplified Visa/Mastercard
// mark to identify an accepted payment method. Every other bank has no entry
// here and falls back to the tinted-lettermark tile in PaymentMonogram below,
// which needs no brand asset at all.
const LOGOS = {
  jazzcash: (
    <svg viewBox="0 0 100 100" width="100%" height="100%" role="img" aria-label="JazzCash">
      <rect width="100" height="100" rx="22" fill="#fff" />
      {/* Two interlocking paisley crescents - JazzCash's exchange mark. */}
      <path d="M 66 26 A 27 27 0 1 1 45 30 L 58 43 A 12 12 0 1 0 66 26 Z" fill="#E4032E" />
      <path d="M 34 74 A 27 27 0 1 1 55 70 L 42 57 A 12 12 0 1 0 34 74 Z" fill="#FFC20E" />
    </svg>
  ),
  easypaisa: (
    <svg viewBox="0 0 100 100" width="100%" height="100%" role="img" aria-label="EasyPaisa">
      <rect width="100" height="100" rx="22" fill="#fff" />
      {/* Stylised "e": a solid black blob with an off-centre eye, green swoosh beneath. */}
      <ellipse cx="47" cy="38" rx="27" ry="23" fill="#111111" />
      <ellipse cx="53" cy="32" rx="12" ry="11" fill="#fff" />
      <path d="M16 56 Q 48 94 85 53 Q 78 70 50 76 Q 25 80 16 56 Z" fill="#3CB043" />
    </svg>
  ),
  meezan: (
    <svg viewBox="0 0 100 100" width="100%" height="100%" role="img" aria-label="Meezan Bank">
      <circle cx="50" cy="50" r="48" fill="#00693E" />
      <circle cx="50" cy="50" r="44" fill="#4A2078" />
      <circle cx="50" cy="50" r="36" fill="#fff" />
      {/* Meezan's three-part triangle "mountain" emblem. */}
      <polygon points="50,29 39,50 61,50" fill="#00693E" stroke="#fff" strokeWidth="2" />
      <polygon points="26,69 39,50 50,69" fill="#00693E" stroke="#fff" strokeWidth="2" />
      <polygon points="74,69 61,50 50,69" fill="#00693E" stroke="#fff" strokeWidth="2" />
    </svg>
  ),
  hbl: (
    <svg viewBox="0 0 100 100" width="100%" height="100%" role="img" aria-label="HBL">
      <rect width="100" height="100" rx="22" fill="#00695C" />
      {/* HBL's double-chevron arrow mark, pointing right. */}
      <polygon points="52,50 24,22 12,22 40,50 12,78 24,78" fill="#fff" />
      <polygon points="76,50 48,22 36,22 64,50 36,78 48,78" fill="#C4D82E" />
    </svg>
  ),
};

// size: pixel width/height of the square tile. className merges onto the
// outer tile element so callers keep their existing spacing/hover styles.
export default function PaymentMonogram({ name, size = 44, className = '' }) {
  const brand = getBankBrand(name);
  const logo = brand.logo && LOGOS[brand.logo];

  const style = { width: size, height: size };

  if (logo) {
    return (
      <span className={`pay-mark pay-mark-logo ${className}`} style={style} aria-hidden="true">
        {logo}
      </span>
    );
  }

  return (
    <span className={`pay-mark pay-mark-letters ${className}`} style={{ ...style, backgroundColor: brand.color }} aria-hidden="true">
      {brand.initials}
    </span>
  );
}
