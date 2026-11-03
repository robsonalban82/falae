import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './router';
import { useSettings } from '../stores/useSettings';
import { applyTheme } from '../services/theme';
import { useReminderScheduler } from './useReminderScheduler';
import { UpdateNotice } from './UpdateNotice';

export function App() {
  const load = useSettings((s) => s.load);
  const theme = useSettings((s) => s.settings.theme);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => applyTheme(theme), [theme]);
  useReminderScheduler();

  return (
    <>
      <UpdateNotice />
      <RouterProvider router={router} />
    </>
  );
}
