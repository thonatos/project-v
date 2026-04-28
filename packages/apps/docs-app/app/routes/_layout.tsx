import { Outlet } from 'react-router';
import { Header } from '~/components/header';
import { Footer } from '~/components/footer';

export default function Layout() {
  return (
    <div id="main-content" className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
