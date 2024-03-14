import { createBrowserRouter } from 'react-router-dom';

import { Home } from './routes/home';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Home />,
  },
  {
    path: '/info',
    element: <div>Hello world!</div>,
  },
]);
