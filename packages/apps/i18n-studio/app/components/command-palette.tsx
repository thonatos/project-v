'use client';

import * as React from 'react';
import { useFetcher, useNavigate } from 'react-router';
import {
  Boxes,
  BookOpen,
  CheckCircle2,
  Database,
  FileText,
  Languages,
  ListChecks,
  Moon,
  Plus,
  RefreshCw,
  Settings,
  Sun,
  Users,
} from 'lucide-react';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '~/components/ui/command';
import type { Theme } from '~/lib/theme';

export interface CommandNamespace {
  id: string;
  slug: string;
  name: string;
}

interface CommandPaletteProps {
  namespaces: CommandNamespace[];
  currentSlug?: string | null;
  isSuperuser?: boolean;
}

interface EntryHit {
  id: string;
  key: string;
}

interface EntriesResponse {
  result?: { entries?: EntryHit[] };
}

export function CommandPalette({ namespaces, currentSlug, isSuperuser }: CommandPaletteProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const navigate = useNavigate();
  const themeFetcher = useFetcher();
  const entryFetcher = useFetcher<EntriesResponse>();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName;
        const isEditing = tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable === true;
        // Allow Cmd+K to still toggle even from inputs unless palette already open
        if (isEditing && open) return;
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  React.useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query.trim()), 250);
    return () => window.clearTimeout(id);
  }, [query]);

  React.useEffect(() => {
    if (!open || debounced.length < 2 || !currentSlug) return;
    const params = new URLSearchParams({ prefix: debounced });
    entryFetcher.load(`/api/namespaces/${currentSlug}/entries?${params.toString()}`);
  }, [debounced, open, currentSlug]);

  const setTheme = (theme: Theme) => {
    themeFetcher.submit({ theme }, { method: 'post', action: '/api/theme', encType: 'application/json' });
    setOpen(false);
  };

  const navTo = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const matchedEntries: EntryHit[] = entryFetcher.data?.result?.entries?.slice(0, 8) ?? [];

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={currentSlug ? '搜索词条 / 跳转 / 命令…' : '跳转 / 命令…'}
      />
      <CommandList>
        <CommandEmpty>没有匹配的结果</CommandEmpty>

        {currentSlug ? (
          <CommandGroup heading="Navigate">
            <CommandItem onSelect={() => navTo(`/dashboard/${currentSlug}`)}>
              <Boxes className="size-4" />
              <span>Overview</span>
            </CommandItem>
            <CommandItem onSelect={() => navTo(`/dashboard/${currentSlug}/entries`)}>
              <FileText className="size-4" />
              <span>Entries</span>
            </CommandItem>
            <CommandItem onSelect={() => navTo(`/dashboard/${currentSlug}/tasks`)}>
              <ListChecks className="size-4" />
              <span>Tasks</span>
            </CommandItem>
            <CommandItem onSelect={() => navTo(`/dashboard/${currentSlug}/sync`)}>
              <RefreshCw className="size-4" />
              <span>Sync</span>
            </CommandItem>
            <CommandItem onSelect={() => navTo(`/dashboard/${currentSlug}/members`)}>
              <Users className="size-4" />
              <span>Members</span>
            </CommandItem>
            <CommandItem onSelect={() => navTo(`/dashboard/${currentSlug}/settings`)}>
              <Settings className="size-4" />
              <span>Settings</span>
            </CommandItem>
          </CommandGroup>
        ) : null}

        {namespaces.length > 0 ? (
          <CommandGroup heading="Switch namespace">
            {namespaces.map((ns) => (
              <CommandItem
                key={ns.id}
                value={`ns:${ns.slug} ${ns.name}`}
                onSelect={() => navTo(`/dashboard/${ns.slug}`)}
              >
                <Database className="size-4" />
                <span>{ns.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">{ns.slug}</span>
              </CommandItem>
            ))}
            <CommandItem onSelect={() => navTo('/dashboard/new')}>
              <Plus className="size-4" />
              <span>New namespace</span>
            </CommandItem>
          </CommandGroup>
        ) : null}

        {currentSlug && matchedEntries.length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Entries">
              {matchedEntries.map((entry) => (
                <CommandItem
                  key={entry.id}
                  value={`entry:${entry.key}`}
                  onSelect={() => navTo(`/dashboard/${currentSlug}/entries/${encodeURIComponent(entry.key)}`)}
                >
                  <Languages className="size-4" />
                  <span>{entry.key}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}

        <CommandSeparator />
        <CommandGroup heading="Theme">
          <CommandItem onSelect={() => setTheme('light')}>
            <Sun className="size-4" />
            <span>Light</span>
          </CommandItem>
          <CommandItem onSelect={() => setTheme('dark')}>
            <Moon className="size-4" />
            <span>Dark</span>
          </CommandItem>
          <CommandItem onSelect={() => setTheme('system')}>
            <CheckCircle2 className="size-4" />
            <span>System</span>
          </CommandItem>
        </CommandGroup>

        {isSuperuser ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="System">
              <CommandItem value="manage-locales" onSelect={() => navTo('/dashboard/locales')}>
                <Languages className="size-4" />
                <span>Manage locales</span>
              </CommandItem>
            </CommandGroup>
          </>
        ) : null}

        <CommandSeparator />
        <CommandGroup heading="Help">
          <CommandItem value="open-docs" onSelect={() => navTo('/docs')}>
            <BookOpen className="size-4" />
            <span>打开文档</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
