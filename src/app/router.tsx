import { createBrowserRouter } from 'react-router';
import { AppLayout } from './AppLayout';
import { ComingSoon } from './ComingSoon';
import { paths } from './routes';
import { Showcase } from '../features/showcase/Showcase';

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: paths.path, element: <Showcase /> },
      { path: paths.practice, element: <ComingSoon /> },
      { path: paths.profile, element: <ComingSoon /> },
      { path: paths.settings, element: <ComingSoon /> },
      { path: paths.tip(), element: <ComingSoon /> },
    ],
  },
  // Full-screen flows (no navigation bar).
  { path: paths.welcome, element: <ComingSoon /> },
  { path: paths.placement, element: <ComingSoon /> },
  { path: paths.lesson(), element: <ComingSoon /> },
  { path: '*', element: <ComingSoon /> },
]);
