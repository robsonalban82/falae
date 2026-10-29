import { Navigate, Outlet } from 'react-router';
import { t } from '../i18n/pt-BR';
import { paths } from './routes';
import { useOnboardingPending } from './useOnboardingState';

/** Sends a brand-new learner to /boas-vindas; shows a skeleton while deciding (no path flash). */
export function OnboardingGate() {
  const pending = useOnboardingPending();
  if (pending === null) {
    return (
      <div
        aria-busy="true"
        aria-label={t.path.loading}
        className="mx-auto max-w-2xl animate-pulse space-y-6 px-4 pt-6"
      >
        <div className="h-14 rounded-card bg-surface-2" />
        <div className="h-24 rounded-card bg-surface-2" />
      </div>
    );
  }
  if (pending) return <Navigate to={paths.welcome} replace />;
  return <Outlet />;
}
