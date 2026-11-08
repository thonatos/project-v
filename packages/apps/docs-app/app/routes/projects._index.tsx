import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router';
import { PageShell } from '~/components/page-shell';
import { projects } from '~/lib/projects';
import { pageTitle } from '~/lib/seo';

export function meta() {
  return [{ title: pageTitle('Projects') }, { name: 'description', content: '用于介绍项目的背景、设计与进展。' }];
}

export default function ProjectsIndex() {
  return (
    <PageShell width="contained">
      <header className="page-intro">
        <h1>Projects</h1>
        <p>用于介绍项目的背景、设计与进展。</p>
      </header>
      <div className="projects-list">
        {projects.map((project) => (
          <article key={project.slug} className="project-row">
            <div className="project-index-mark">{project.name.slice(0, 1)}</div>
            <div>
              <div className="project-meta">
                <span>{project.status}</span>
                <span>{project.platforms.join(' · ')}</span>
              </div>
              <h2>{project.name}</h2>
              <p className="project-tagline">{project.tagline}</p>
              <p>{project.description}</p>
            </div>
            <Link to={project.href} className="project-open">
              项目介绍 <ArrowUpRight aria-hidden="true" className="size-4" />
            </Link>
          </article>
        ))}
      </div>
    </PageShell>
  );
}
