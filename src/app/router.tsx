import { createBrowserRouter, type RouteObject } from 'react-router';
import { AppLayout } from './AppLayout';
import { ComingSoon } from './ComingSoon';
import { paths } from './routes';
import { PathScreen } from '../features/path/PathScreen';

/** Dev-only design showcase (also in E2E builds for the UX screenshots); never in the production bundle. */
const devRoutes: RouteObject[] =
  import.meta.env.DEV || import.meta.env.VITE_E2E === '1'
    ? [
        {
          path: '/dev/showcase',
          lazy: async () => ({
            Component: (await import('../features/showcase/Showcase')).Showcase,
          }),
        },
      ]
    : [];

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: paths.path, element: <PathScreen /> },
      { path: paths.practice, element: <ComingSoon /> },
      { path: paths.profile, element: <ComingSoon /> },
      { path: paths.settings, element: <ComingSoon /> },
      {
        path: paths.tip(),
        lazy: async () => ({ Component: (await import('../features/tip/TipScreen')).TipScreen }),
      },
      ...devRoutes,
    ],
  },
  // Full-screen flows (no navigation bar).
  { path: paths.welcome, element: <ComingSoon /> },
  { path: paths.placement, element: <ComingSoon /> },
  {
    path: paths.lesson(),
    lazy: async () => ({
      Component: (await import('../features/lesson/LessonScreen')).LessonScreen,
    }),
  },
  { path: '*', element: <ComingSoon /> },
]);
