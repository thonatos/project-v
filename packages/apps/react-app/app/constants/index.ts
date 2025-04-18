export const REMIX_URL = import.meta.env.VITE_REMIX_URL || 'https://remix.implements.io';

export const REMIX_API = import.meta.env.VITE_REMIX_API || 'https://remix-api.implements.io';

export const REMIX_WEB = {
  baseUrl: REMIX_URL,
  base: {
    name: 'ρV',
    creator: 'ρV',
    description: 'undefined project - ρV',
    keywords: 'Remix, React, TypeScript, Tailwind CSS',
  },
  twitter: {
    card: 'summary_large_image',
  },
  openGraph: {
    image: `https://s.implements.io/remix/og.png`,
    width: '800',
    height: '400',
  },
};

export const OSS_PROJECTS = [
  {
    name: 'Remix',
    desc: 'Remix is a full stack web framework that lets you focus on the user interface and work back through web standards to deliver a fast, slick, and resilient user experience. People are gonna love using your stuff.',
    href: 'https://remix.run/',
  },
  {
    name: 'Shadcn/ui',
    desc: 'Beautifully designed components that you can copy and paste into your apps. Made with Tailwind CSS. Open source.',
    href: 'https://ui.shadcn.com/',
  },
  {
    name: 'Lucide',
    desc: 'Beautiful & consistent icons, Made by the community.',
    href: 'https://lucide.dev/',
  },
  {
    name: 'Tailwind CSS',
    desc: 'A utility-first CSS framework packed with classes like flex, pt-4, text-center and rotate-90 that can be composed to build any design, directly in your markup.',
    href: 'https://tailwindcss.com/',
  },
  {
    name: 'Jotai',
    desc: 'Primitive and flexible state management for React',
    href: 'https://jotai.org/',
  },
];

export const FINANCE_LINKS = [
  {
    name: 'MicroStrategy Portfolio Tracker',
    desc: 'Michael Saylor ⚡ (MicroStrategy) Portfolio Tracker.',
    href: 'https://saylortracker.com/',
  },
];
