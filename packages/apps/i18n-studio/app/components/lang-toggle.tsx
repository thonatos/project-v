'use client';

import { useFetcher } from 'react-router';
import { useTranslation } from 'react-i18next';

import { ToggleGroup, ToggleGroupItem } from '~/components/ui/toggle-group';
import i18n from '~/i18n/config';
import { isLang, type Lang } from '~/lib/i18n';

interface LangToggleProps {
  lang: Lang;
  className?: string;
}

export function LangToggle({ lang, className }: LangToggleProps) {
  const fetcher = useFetcher();
  const { t } = useTranslation('common');

  const setLang = (next: Lang) => {
    void i18n.changeLanguage(next);
    fetcher.submit({ lang: next }, { method: 'post', action: '/api/lang', encType: 'application/json' });
  };

  return (
    <ToggleGroup
      type="single"
      value={lang}
      onValueChange={(v) => {
        if (isLang(v)) setLang(v);
      }}
      aria-label={t('lang.label')}
      size="sm"
      className={className}
      data-slot="lang-toggle"
    >
      <ToggleGroupItem value="zh-cn" aria-label={t('lang.zh')} type="button">
        {t('lang.zh')}
      </ToggleGroupItem>
      <ToggleGroupItem value="en-us" aria-label={t('lang.en')} type="button">
        {t('lang.en')}
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
