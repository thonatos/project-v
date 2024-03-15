import { createBrowserRouter } from 'react-router-dom';

import { Root } from './routes/root';
import { ErrorPage } from './errorPage';
import { Home } from './routes/home';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Root />,
    errorElement: <ErrorPage />,
    children: [
      {
        path: '/',
        element: <Home />,
      },
      {
        path: '/info',
        element: <div>info</div>,
      },
      {
        path: '/settings',
        element: <div>settings</div>,
      },
    ],
  },
]);
