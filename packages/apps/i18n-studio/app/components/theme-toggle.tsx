'use client';

import * as React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useFetcher } from 'react-router';

import { ToggleGroup, ToggleGroupItem } from '~/components/ui/toggle-group';
import type { Theme } from '~/lib/theme';

interface ThemeToggleProps {
  theme: Theme;
  className?: string;
}

export function ThemeToggle({ theme, className }: ThemeToggleProps) {
  const fetcher = useFetcher();

  const setTheme = (next: Theme) => {
    fetcher.submit({ theme: next }, { method: 'post', action: '/api/theme', encType: 'application/json' });
  };

  return (
    <ToggleGroup
      type="single"
      value={theme}
      onValueChange={(v) => {
        if (v === 'light' || v === 'dark' || v === 'system') setTheme(v);
      }}
      aria-label="主题切换"
      size="icon"
      className={className}
    >
      <ToggleGroupItem value="light" aria-label="Light">
        <Sun className="size-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="dark" aria-label="Dark">
        <Moon className="size-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="system" aria-label="System">
        <Monitor className="size-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

/**
 * Sync `<html>` class with `prefers-color-scheme` while theme is `system`.
 * No-op when theme is `light` or `dark` — those are already pinned by the
 * server-rendered `<html>` className.
 */
export function useSystemThemeSync(theme: Theme): void {
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const html = document.documentElement;
    if (theme === 'dark') {
      html.classList.add('dark');
      return;
    }
    if (theme === 'light') {
      html.classList.remove('dark');
      return;
    }
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      if (mql.matches) html.classList.add('dark');
      else html.classList.remove('dark');
    };
    apply();
    mql.addEventListener('change', apply);
    return () => mql.removeEventListener('change', apply);
  }, [theme]);
}
