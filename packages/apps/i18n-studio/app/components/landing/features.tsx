import { Database, GitBranch, GitMerge, Languages, ListTodo, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';

interface Feature {
  icon: typeof GitMerge;
  /** i18n key under `landing.features.*` for both `.title` and `.body` */
  key: string;
}

const FEATURES: readonly Feature[] = [
  { icon: GitMerge, key: 'draftPublishHistory' },
  { icon: GitBranch, key: 'crossNamespaceSync' },
  { icon: ListTodo, key: 'taskCollaboration' },
  { icon: Zap, key: 'snapshotChannel' },
  { icon: Languages, key: 'systemLocaleDictionary' },
  { icon: Database, key: 'singleFileDeploy' },
];

export function Features() {
  const { t } = useTranslation();
  return (
    <section id="features">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:py-20">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-semibold tracking-tight">{t('landing.features.heading')}</h2>
          <p className="mt-3 text-muted-foreground">{t('landing.features.subheading')}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <Card key={f.key} className="transition-all hover:-translate-y-0.5 hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </span>
                    <CardTitle className="text-base">{t(`landing.features.${f.key}.title`)}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-6 text-muted-foreground">{t(`landing.features.${f.key}.body`)}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
