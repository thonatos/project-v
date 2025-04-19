import React from 'react';
import { cn } from '~/lib/utils';

export const Logo: React.FC<Props> = ({ title, description, className }) => (
  <section className={cn('flex items-baseline justify-center gap-2 min-w-[200px]', className)}>
    <h1 className="text-md text-indigo-200">{title}</h1>
    {description && <p className="text-xs opacity-55 text-violet-500">{description}</p>}
  </section>
);

export default Logo;

interface Props {
  title: string;
  description?: string;
  className?: string;
}
