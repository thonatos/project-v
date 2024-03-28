import { createBrowserRouter } from 'react-router-dom';

import { Root } from './routes/_index';
import { ErrorPage } from './errorPage';
import { Home } from './routes/home';
import { Settings } from './routes/settings';

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
        path: '/settings',
        element: <Settings />,
      },
    ],
  },
]);
