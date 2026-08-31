/**
 * Mock auth store. Everything lives in localStorage — no server calls.
 * Passwords are stored as a lightweight FNV-1a hash so they're not plaintext
 * in devtools, but this is NOT real security. Do not port to production.
 */

const USERS_KEY = 'gtm_auth_users';
const CURRENT_KEY = 'gtm_auth_current';
const RESET_KEY = 'gtm_auth_resets';

// Demo credentials seeded on first load so evaluators can sign in without
// registering. Exposed on the login screen as a one-click autofill chip.
export const DEMO_CREDENTIALS = {
  email: 'demo@aimarketpulse.com',
  password: 'demo1234',
  name: 'Demo Analyst',
} as const;

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  avatarColor: string;
}

interface StoredUser extends AuthUser {
  passwordHash: string;
}

interface ResetTicket {
  token: string;
  email: string;
  expiresAt: number;
}

// Non-cryptographic hash — just enough to keep passwords from being obvious
// in localStorage inspection. FNV-1a on the utf-8 bytes.
function hashPassword(pw: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < pw.length; i++) {
    h ^= pw.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function randomId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

// Deterministic avatar tint from the email so the same account always shows
// the same color across sessions.
function colorFromEmail(email: string): string {
  const palette = [
    '#f97316', '#eab308', '#22c55e', '#14b8a6',
    '#0ea5e9', '#6366f1', '#a855f7', '#ec4899',
  ];
  let h = 0;
  for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function loadUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as StoredUser[]) : [];
  } catch {
    return [];
  }
}

function saveUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function loadResets(): ResetTicket[] {
  try {
    const raw = localStorage.getItem(RESET_KEY);
    const tickets = raw ? (JSON.parse(raw) as ResetTicket[]) : [];
    // Drop expired tickets on every read so the store doesn't grow forever.
    const now = Date.now();
    return tickets.filter((t) => t.expiresAt > now);
  } catch {
    return [];
  }
}

function saveResets(tickets: ResetTicket[]) {
  localStorage.setItem(RESET_KEY, JSON.stringify(tickets));
}

function toPublic(u: StoredUser): AuthUser {
  const { passwordHash: _pw, ...rest } = u;
  return rest;
}

// Idempotent — creates the demo account if it does not already exist. Called
// once on app boot so the login page's autofill chip always works, even for a
// brand-new browser profile with an empty user list.
export function ensureDemoUser() {
  const users = loadUsers();
  if (users.some((u) => u.email === DEMO_CREDENTIALS.email)) return;
  const stored: StoredUser = {
    id: 'usr-demo',
    email: DEMO_CREDENTIALS.email,
    name: DEMO_CREDENTIALS.name,
    createdAt: new Date().toISOString(),
    avatarColor: colorFromEmail(DEMO_CREDENTIALS.email),
    passwordHash: hashPassword(DEMO_CREDENTIALS.password),
  };
  users.push(stored);
  saveUsers(users);
}

export function getCurrentUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(CURRENT_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function setCurrentUser(user: AuthUser | null) {
  if (user) {
    localStorage.setItem(CURRENT_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(CURRENT_KEY);
  }
}

export interface AuthResult {
  ok: boolean;
  error?: string;
  user?: AuthUser;
}

export function registerUser(name: string, email: string, password: string): AuthResult {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();
  if (!cleanName) return { ok: false, error: 'Name is required' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { ok: false, error: 'Enter a valid email address' };
  }
  if (password.length < 6) {
    return { ok: false, error: 'Password must be at least 6 characters' };
  }
  const users = loadUsers();
  if (users.some((u) => u.email === cleanEmail)) {
    return { ok: false, error: 'An account with this email already exists' };
  }
  const stored: StoredUser = {
    id: randomId('usr'),
    email: cleanEmail,
    name: cleanName,
    createdAt: new Date().toISOString(),
    avatarColor: colorFromEmail(cleanEmail),
    passwordHash: hashPassword(password),
  };
  users.push(stored);
  saveUsers(users);
  const publicUser = toPublic(stored);
  setCurrentUser(publicUser);
  return { ok: true, user: publicUser };
}

export function loginUser(email: string, password: string): AuthResult {
  const cleanEmail = email.trim().toLowerCase();
  const users = loadUsers();
  const match = users.find((u) => u.email === cleanEmail);
  if (!match || match.passwordHash !== hashPassword(password)) {
    return { ok: false, error: 'Email or password is incorrect' };
  }
  const publicUser = toPublic(match);
  setCurrentUser(publicUser);
  return { ok: true, user: publicUser };
}

export function logoutUser() {
  setCurrentUser(null);
}

export interface ResetRequest {
  ok: boolean;
  error?: string;
  token?: string;
  resetUrl?: string;
}

// Mock forgot-password flow: creates a 30-min token tied to the email and
// returns a URL the UI shows via toast + console (no email actually sent).
// Returns ok: true even for unknown emails so an attacker can't enumerate
// accounts — but only actually stores a token for real accounts.
export function requestPasswordReset(email: string): ResetRequest {
  const cleanEmail = email.trim().toLowerCase();
  const users = loadUsers();
  const match = users.find((u) => u.email === cleanEmail);
  if (!match) {
    return { ok: true };
  }
  const token = randomId('rst').replace(/-/g, '');
  const ticket: ResetTicket = {
    token,
    email: cleanEmail,
    expiresAt: Date.now() + 30 * 60 * 1000,
  };
  const tickets = loadResets().filter((t) => t.email !== cleanEmail);
  tickets.push(ticket);
  saveResets(tickets);
  const resetUrl = `${window.location.origin}${window.location.pathname}#/reset-password?token=${token}`;
  return { ok: true, token, resetUrl };
}

export function verifyResetToken(token: string): { ok: boolean; email?: string; error?: string } {
  const cleaned = token.trim();
  if (!cleaned) return { ok: false, error: 'Missing reset token' };
  const tickets = loadResets();
  const match = tickets.find((t) => t.token === cleaned);
  if (!match) return { ok: false, error: 'This reset link is invalid or has expired' };
  return { ok: true, email: match.email };
}

export function resetPassword(token: string, newPassword: string): AuthResult {
  if (newPassword.length < 6) {
    return { ok: false, error: 'Password must be at least 6 characters' };
  }
  const verified = verifyResetToken(token);
  if (!verified.ok || !verified.email) {
    return { ok: false, error: verified.error ?? 'Invalid token' };
  }
  const users = loadUsers();
  const idx = users.findIndex((u) => u.email === verified.email);
  if (idx === -1) return { ok: false, error: 'Account no longer exists' };
  users[idx] = { ...users[idx], passwordHash: hashPassword(newPassword) };
  saveUsers(users);
  const tickets = loadResets().filter((t) => t.token !== token);
  saveResets(tickets);
  return { ok: true, user: toPublic(users[idx]) };
}
