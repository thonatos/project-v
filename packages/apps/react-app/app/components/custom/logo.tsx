import React from 'react';

export const Logo: React.FC<Props> = ({ title, description }) => (
  <section className="logo">
    <h1 className="title">{title}</h1>
    {description && <p className="description">{description}</p>}
  </section>
);

export default Logo;

interface Props {
  title: string;
  description?: string;
}
