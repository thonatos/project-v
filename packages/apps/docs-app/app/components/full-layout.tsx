import { Footer } from './footer';
import { Header } from './header';

interface FullLayoutProps {
  children: React.ReactNode;
}

export function FullLayout({ children }: FullLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main id="main-content" className="flex flex-1 flex-col">
        <div className="w-full grow px-4 sm:px-6 lg:px-8 py-12">{children}</div>
      </main>
      <Footer />
    </div>
  );
}
