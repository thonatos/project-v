'use client';

import * as React from 'react';
import { Check, Languages } from 'lucide-react';
import { useFetcher } from 'react-router';
import { useTranslation } from 'react-i18next';

import { Button } from '~/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '~/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import { cn } from '~/lib/utils';
import i18n from '~/i18n/config';
import { LOCALE_META } from '~/i18n/generated';
import { isLang, type Lang } from '~/lib/i18n';

interface LangToggleProps {
  lang: Lang;
  className?: string;
}

/** 当前语种的显示名:母语名优先,回退 label,再回退 code。 */
function displayName(code: string): string {
  const m = LOCALE_META.find((l) => l.code === code);
  return m?.nativeLabel ?? m?.label ?? code;
}

/**
 * UI 语言切换器。选项遍历 codegen 生成的 `LOCALE_META`,因此新增语种(加 locale
 * 目录 + 重跑 codegen)即自动出现,无需改本组件;基于 Command + Popover,语种数量
 * 为 3+ 时仍可用(可搜索、不撑爆横向空间)。
 */
export function LangToggle({ lang, className }: LangToggleProps) {
  const [open, setOpen] = React.useState(false);
  const fetcher = useFetcher();
  const { t } = useTranslation('common');

  const setLang = (next: Lang) => {
    void i18n.changeLanguage(next);
    fetcher.submit({ lang: next }, { method: 'post', action: '/api/lang', encType: 'application/json' });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          role="combobox"
          aria-expanded={open}
          aria-label={t('lang.label')}
          className={cn('gap-1.5', className)}
          data-slot="lang-toggle"
        >
          <Languages className="size-4" />
          <span>{displayName(lang)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="end">
        <Command>
          <CommandInput placeholder={t('lang.label')} />
          <CommandList>
            <CommandEmpty>{t('lang.label')}</CommandEmpty>
            <CommandGroup>
              {LOCALE_META.map((opt) => {
                const selected = opt.code === lang;
                return (
                  <CommandItem
                    key={opt.code}
                    value={`${opt.code} ${opt.nativeLabel ?? ''} ${opt.label} ${opt.englishLabel}`}
                    onSelect={() => {
                      if (isLang(opt.code)) setLang(opt.code);
                    }}
                  >
                    <Check className={cn('mr-2 size-4', selected ? 'opacity-100' : 'opacity-0')} />
                    <span>{opt.nativeLabel ?? opt.label}</span>
                    <span className="ml-auto font-mono text-xs text-muted-foreground">{opt.code}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
