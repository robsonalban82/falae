import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { paths } from '../../app/routes';
import { useOnboardingPending } from '../../app/useOnboardingState';
import { dailyGoalOptions, type DailyGoal } from '../../data/models';
import { t } from '../../i18n/pt-BR';
import { useProfile } from '../../stores/useProfile';
import { useSettings } from '../../stores/useSettings';
import { Button } from '../../ui/Button';
import { ArrowRightIcon } from '../../ui/icons';
import { Tuca } from '../../ui/Mascot/Tuca';
import { RadioPills } from '../../ui/RadioPills';

const STEPS = 3;

/** Route /boas-vindas — three steps, one at a time. Never asks for notifications. */
export function WelcomeScreen() {
  const pending = useOnboardingPending();
  const navigate = useNavigate();
  const settings = useSettings((s) => s.settings);
  const updateSettings = useSettings((s) => s.update);
  const completeOnboarding = useProfile((s) => s.completeOnboarding);
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState<DailyGoal>(20);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    // Focus moves to the new step's title (not on the very first paint).
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    heading.current?.focus();
  }, [step]);

  if (pending === null) return null;
  // Onboarding already done → path (while finishing, `busy` keeps this guard from racing the navigation).
  if (pending === false && !busy) return <Navigate to={paths.path} replace />;

  const beginner = async () => {
    setBusy(true);
    setSaveError(false);
    try {
      await completeOnboarding();
      void navigate(paths.path, { replace: true });
    } catch (err) {
      console.error('[falae] Could not finish onboarding', err);
      setSaveError(true);
      setBusy(false);
    }
  };

  const titles = [t.welcome.introTitle, t.welcome.goalTitle, t.welcome.levelTitle];

  return (
    <main
      id="conteudo"
      className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]"
    >
      <div className="flex min-h-11 items-center justify-between">
        {step > 1 ? (
          <Button
            variant="ghost"
            className="min-h-11 px-4 py-1 text-base"
            onClick={() => setStep(step - 1)}
          >
            {t.welcome.back}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="flex gap-1.5">
            {Array.from({ length: STEPS }, (_, i) => (
              <span
                key={i}
                className={`h-2.5 rounded-full transition-[width] duration-200 motion-reduce:transition-none ${
                  i + 1 === step
                    ? 'w-6 bg-secondary'
                    : i + 1 < step
                      ? 'w-2.5 bg-secondary'
                      : 'w-2.5 bg-line-strong'
                }`}
              />
            ))}
          </span>
          <p role="status" className="text-sm font-bold text-ink-muted">
            {t.welcome.step(step, STEPS)}
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
        <Tuca mood={step === 1 ? 'happy' : step === 2 ? 'encouraging' : 'thinking'} size={150} />
        <h1 ref={heading} tabIndex={-1} className="text-3xl font-semibold">
          {titles[step - 1]}
        </h1>

        {step === 1 && <p className="text-lg text-ink-muted">{t.welcome.introBody}</p>}

        {step === 2 && (
          <div className="w-full text-left">
            <RadioPills
              name="welcome-goal"
              legend={t.welcome.goalBody}
              large
              options={dailyGoalOptions.map((xp) => ({
                value: xp,
                label: t.welcome.goals[xp].name,
                detail: t.welcome.goals[xp].detail,
              }))}
              value={goal}
              onChange={setGoal}
            />
          </div>
        )}

        {step === 3 && <p className="text-lg text-ink-muted">{t.welcome.levelBody}</p>}
      </div>

      <div className="flex flex-col gap-3">
        {step === 1 && (
          <Button block onClick={() => setStep(2)} trailing={<ArrowRightIcon />}>
            {t.welcome.start}
          </Button>
        )}
        {step === 2 && (
          <Button
            block
            onClick={() => {
              if (goal !== settings.dailyGoalXp) void updateSettings({ dailyGoalXp: goal });
              setStep(3);
            }}
            trailing={<ArrowRightIcon />}
          >
            {t.welcome.continue}
          </Button>
        )}
        {step === 3 && (
          <>
            <p role="alert" className="min-h-0 text-center font-bold text-danger empty:hidden">
              {saveError ? t.welcome.saveError : ''}
            </p>
            <Button block disabled={busy} onClick={() => void beginner()}>
              {t.welcome.beginner}
            </Button>
            <Button
              block
              variant="secondary"
              disabled={busy}
              aria-describedby="placement-hint"
              onClick={() => void navigate(paths.placement)}
            >
              {t.welcome.placement}
            </Button>
            <p id="placement-hint" className="-mt-1 text-center text-sm text-ink-muted">
              {t.welcome.placementHint}
            </p>
          </>
        )}
      </div>
    </main>
  );
}
