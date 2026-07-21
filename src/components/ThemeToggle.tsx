import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

// Read the current theme directly from the DOM class — no duplicate state.
function isDarkNow() {
  return document.documentElement.classList.contains('dark');
}

export function applyTheme(theme: 'light' | 'dark') {
  if (theme === 'dark') document.documentElement.classList.add('dark');
  else document.documentElement.classList.remove('dark');
  try { localStorage.setItem('gtm_theme', theme); } catch {}
}

// Initialize on first load: stored pref → OS pref → dark default.
(function initTheme() {
  try {
    const stored = localStorage.getItem('gtm_theme');
    if (stored === 'light' || stored === 'dark') { applyTheme(stored); return; }
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) { applyTheme('dark'); return; }
  } catch {}
  applyTheme('dark');
})();

export function ThemeToggle({ className = '' }: { className?: string }) {
  // Mirror the DOM class so the icon stays correct regardless of who changed the theme.
  const [dark, setDark] = useState(isDarkNow);

  useEffect(() => {
    const observer = new MutationObserver(() => setDark(isDarkNow()));
    observer.observe(document.documentElement, { attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const toggle = () => applyTheme(dark ? 'light' : 'dark');

  return (
    <button
      type="button"
      onClick={toggle}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label="Toggle dark mode"
      className={`h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer ${className}`}
    >
      {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
