import { createContext, useContext, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

const ThemeContext = createContext({ grantee: null });

function hexToHsl(hex) {
  let r = 0, g = 0, b = 0;
  if (hex.length === 7) {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  }
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function applyTheme(grantee) {
  if (!grantee) return;
  const root = document.documentElement;
  if (grantee.primary_color) {
    root.style.setProperty('--primary', hexToHsl(grantee.primary_color));
    root.style.setProperty('--ring', hexToHsl(grantee.primary_color));
    root.style.setProperty('--grantee-primary', grantee.primary_color);
  }
  if (grantee.secondary_color) {
    root.style.setProperty('--grantee-secondary', grantee.secondary_color);
  }
}

function resetTheme() {
  const root = document.documentElement;
  root.style.removeProperty('--primary');
  root.style.removeProperty('--ring');
  root.style.removeProperty('--grantee-primary');
  root.style.removeProperty('--grantee-secondary');
}

export function ThemeProvider({ children }) {
  const [grantee, setGrantee] = useState(null);

  useEffect(() => {
    base44.auth.me().then(async (user) => {
      if (!user?.grantee_id) { resetTheme(); return; }
      try {
        const grantees = await base44.entities.Grantee.filter({ id: user.grantee_id }, '-created_date', 1);
        const g = grantees[0] || null;
        setGrantee(g);
        applyTheme(g);
      } catch {
        resetTheme();
      }
    }).catch(() => resetTheme());
  }, []);

  return (
    <ThemeContext.Provider value={{ grantee }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}