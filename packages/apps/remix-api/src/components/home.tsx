import { css, Style } from 'hono/css';

const headerClass = css`
  padding: 1rem 2rem;
`;

export const Home = () => {
  return (
    <html>
      <head>
        <Style />
      </head>
      <body>
        <div className={headerClass}>
          <h2>remix-worker</h2>
          <p>worker for remix-app, powered by cloudflare workers.</p>
          <a href="/auth/oauth">OAuth</a>
        </div>
      </body>
    </html>
  );
};
