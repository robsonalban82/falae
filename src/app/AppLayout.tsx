import type { ComponentType } from 'react';
import { NavLink, Outlet } from 'react-router';
import { t } from '../i18n/pt-BR';
import { PathIcon, PracticeIcon, ProfileIcon, SettingsIcon } from '../ui/icons';
import { paths } from './routes';

type Item = { to: string; label: string; Icon: ComponentType<{ filled?: boolean }> };

const items: Item[] = [
  { to: paths.path, label: t.nav.path, Icon: PathIcon },
  { to: paths.practice, label: t.nav.practice, Icon: PracticeIcon },
  { to: paths.profile, label: t.nav.profile, Icon: ProfileIcon },
  { to: paths.settings, label: t.nav.settings, Icon: SettingsIcon },
];

/** Bottom navigation on phones, side rail on wide screens. Active item: pill + filled icon + bold, not color alone. */
export function AppLayout() {
  return (
    <div className="min-h-dvh lg:flex">
      <a
        href="#conteudo"
        className="sr-only z-20 rounded-full bg-secondary px-4 py-2 font-bold text-on-secondary focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t.nav.skip}
      </a>
      <nav
        aria-label={t.nav.main}
        className="fixed inset-x-0 bottom-0 z-10 border-t-2 border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:sticky lg:top-[var(--notice-h,0px)] lg:h-[calc(100dvh-var(--notice-h,0px))] lg:w-60 lg:border-t-0 lg:border-r-2 lg:pb-0"
      >
        <p className="hidden px-6 pt-6 pb-4 font-display text-3xl font-semibold text-primary-shade lg:block dark:text-primary">
          {t.appName}
        </p>
        <ul className="grid grid-cols-4 lg:flex lg:flex-col lg:gap-1 lg:px-3">
          {items.map(({ to, label, Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end
                className={({ isActive }) =>
                  [
                    'group flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-2xl px-2 text-xs lg:min-h-12 lg:flex-row lg:justify-start lg:gap-3 lg:px-4 lg:text-base',
                    isActive
                      ? 'font-bold text-secondary lg:bg-surface-2'
                      : 'font-normal text-ink-muted',
                  ].join(' ')
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`flex h-8 w-14 items-center justify-center rounded-full lg:h-auto lg:w-auto ${
                        isActive ? 'bg-surface-2 lg:bg-transparent' : ''
                      }`}
                    >
                      <Icon filled={isActive} />
                    </span>
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <main
        id="conteudo"
        tabIndex={-1}
        className="mx-auto w-full max-w-2xl px-4 pt-6 pb-[calc(4rem+env(safe-area-inset-bottom)+1.5rem)] lg:pb-10"
      >
        <Outlet />
      </main>
    </div>
  );
}
