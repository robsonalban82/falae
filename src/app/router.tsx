import { createBrowserRouter, type RouteObject } from 'react-router';
import { AppLayout } from './AppLayout';
import { ComingSoon } from './ComingSoon';
import { OnboardingGate } from './OnboardingGate';
import { paths } from './routes';
import { PathScreen } from '../features/path/PathScreen';

/** Dev-only design showcase (also in E2E builds for the UX screenshots); never in the production bundle. */
const devRoutes: RouteObject[] =
  import.meta.env.DEV || import.meta.env.VITE_E2E === '1'
    ? [
        {
          element: <AppLayout />,
          children: [
            {
              path: '/dev/showcase',
              lazy: async () => ({
                Component: (await import('../features/showcase/Showcase')).Showcase,
              }),
            },
          ],
        },
      ]
    : [];

export const router = createBrowserRouter(
  [
    {
      // First access goes to /boas-vindas (welcome, placement and /dev are not guarded).
      element: <OnboardingGate />,
      children: [
        {
          element: <AppLayout />,
          children: [
            { path: paths.path, element: <PathScreen /> },
            {
              path: paths.practice,
              lazy: async () => ({
                Component: (await import('../features/practice/PracticeScreen')).PracticeScreen,
              }),
            },
            {
              path: paths.profile,
              lazy: async () => ({
                Component: (await import('../features/profile/ProfileScreen')).ProfileScreen,
              }),
            },
            {
              path: paths.settings,
              lazy: async () => ({
                Component: (await import('../features/settings/SettingsScreen')).SettingsScreen,
              }),
            },
            {
              path: paths.tip(),
              lazy: async () => ({
                Component: (await import('../features/tip/TipScreen')).TipScreen,
              }),
            },
          ],
        },
        // Full-screen flows (no navigation bar).
        {
          path: paths.lesson(),
          lazy: async () => ({
            Component: (await import('../features/lesson/LessonScreen')).LessonScreen,
          }),
        },
        {
          path: paths.practiceSession,
          lazy: async () => ({
            Component: (await import('../features/practice/PracticeSession')).PracticeSession,
          }),
        },
      ],
    },
    ...devRoutes,
    {
      path: paths.welcome,
      lazy: async () => ({
        Component: (await import('../features/onboarding/WelcomeScreen')).WelcomeScreen,
      }),
    },
    {
      path: paths.placement,
      lazy: async () => ({
        Component: (await import('../features/placement/PlacementScreen')).PlacementScreen,
      }),
    },
    { path: '*', element: <ComingSoon /> },
  ],
  // GitHub Pages serves the app under /<repo>/ (VITE_BASE); '/' everywhere else.
  { basename: import.meta.env.BASE_URL },
);
