import { Github } from 'lucide-react';
import { Link, NavLink } from 'react-router';

const sections = [
  { to: '/docs', label: 'Docs' },
  { to: '/blog', label: 'Blog' },
  { to: '/projects', label: 'Projects' },
];

function SectionLinks() {
  return sections.map((item) => (
    <NavLink
      key={item.to}
      to={item.to}
      className={({ isActive }) => `site-nav-link${isActive ? ' site-nav-link-active' : ''}`}
    >
      {item.label}
    </NavLink>
  ));
}

export function Header() {
  return (
    <header className="site-header">
      <nav className="site-header-inner" aria-label="主导航">
        <div className="site-brand-row">
          <Link to="/" className="site-brand" aria-label="ρV 首页">
            <span translate="no" className="site-brand-mark">
              ρV
            </span>
            <span translate="no" className="site-brand-name">
              undefined project.
            </span>
          </Link>
          <div className="hidden items-center md:flex">
            <SectionLinks />
          </div>
          <a
            href="https://github.com/thonatos/project-v"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="访问 GitHub 仓库"
            className="site-github"
          >
            <Github aria-hidden="true" className="size-4" />
          </a>
        </div>
        <div className="site-mobile-nav md:hidden">
          <SectionLinks />
        </div>
      </nav>
    </header>
  );
}
