import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowRight, BookOpen } from 'lucide-react';

import { Button } from '~/components/ui/button';
import type { User } from '~/db/schema';

interface HeroProps {
  user: User | null;
}

export function Hero({ user }: HeroProps) {
  const { t } = useTranslation('landing');
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{t('hero.title')}</h1>
          <p className="mt-5 text-lg text-muted-foreground sm:text-xl">{t('hero.subtitle')}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {user ? (
              <Button asChild size="lg">
                <Link to="/dashboard">
                  {t('hero.enterDashboard')}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : (
              <Button asChild size="lg">
                <Link to="/login">
                  {t('hero.login')}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            )}
            <Button asChild size="lg" variant="outline">
              <Link to="/docs">
                <BookOpen className="size-4" />
                {t('hero.readDocs')}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
