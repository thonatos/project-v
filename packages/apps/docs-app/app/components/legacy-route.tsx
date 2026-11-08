import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { PageShell } from './page-shell';

interface LegacyRouteProps {
  destination: string;
  title: string;
  description: string;
}

export function LegacyRoute({ destination, title, description }: LegacyRouteProps) {
  const navigate = useNavigate();

  useEffect(() => {
    navigate(destination, { replace: true });
  }, [destination, navigate]);

  return (
    <PageShell width="reading">
      <section className="migration-note" aria-labelledby="migration-title">
        <p className="section-kicker">页面已迁移</p>
        <h1 id="migration-title">{title}</h1>
        <p>{description}</p>
        <Link className="text-link" to={destination}>
          前往新页面 →
        </Link>
      </section>
    </PageShell>
  );
}
