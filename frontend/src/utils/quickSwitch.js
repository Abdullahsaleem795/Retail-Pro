// Per-browser "who has signed in here before" list, used by the Login page
// to offer a PIN quick-switch tile instead of a full email+password form -
// built for shops running one shared PC where the owner, manager, and
// cashiers all use the same machine across a shift.
//
// Nothing sensitive lives here - no password, no token, no PIN. It's purely
// a UI convenience: which names to show as tiles. The actual authentication
// is still fully server-verified via POST /auth/pin-login on every tap.
const STORAGE_KEY = 'retailpro_quick_switch';

export const getRememberedUsers = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

// Called after any successful login (password or PIN) so the account shows
// up as a tile next time, without needing its own opt-in step.
export const rememberUser = ({ id, name, role, email, shopName }) => {
  const existing = getRememberedUsers().filter((u) => u.id !== id);
  const next = [{ id, name, role, email, shopName }, ...existing].slice(0, 8);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
};

export const forgetUser = (id) => {
  const next = getRememberedUsers().filter((u) => u.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
};
