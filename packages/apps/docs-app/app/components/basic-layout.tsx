import { Footer } from './footer';
import { Header } from './header';

interface BasicLayoutProps {
  children: React.ReactNode;
}

export function BasicLayout({ children }: BasicLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main id="main-content" className="flex flex-1 flex-col">
        <div className="w-full grow px-4 sm:px-6 lg:px-8 py-12 lg:max-w-7xl lg:mx-auto">{children}</div>
      </main>
      <Footer />
    </div>
  );
}
