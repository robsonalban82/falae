import { useEffect } from 'react';
import { t } from '../../../i18n/pt-BR';
import { speak, stopSpeaking } from '../../../services/speech';
import { SpeakerButton } from './SpeakerButton';
import { TextAnswer } from './TextAnswer';
import type { ExerciseProps } from './types';
import { NoVoiceNotice } from '../../../ui/NoVoiceNotice';

export function ListenType({
  exercise,
  disabled,
  onChange,
  onSubmit,
}: ExerciseProps<'listen-type'>) {
  useEffect(() => {
    // Autoplay may be blocked until the first user gesture; the buttons always work.
    speak(exercise.textEn).catch(() => {});
    return stopSpeaking;
  }, [exercise.textEn]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">{t.lesson.instructions['listen-type']}</h2>
      <div className="flex items-end justify-center gap-6 py-2">
        <div className="flex flex-col items-center gap-1">
          <SpeakerButton text={exercise.textEn} label={t.lesson.listen} size="lg" />
          <span aria-hidden="true" className="text-sm font-bold text-ink-muted">
            {t.lesson.listen}
          </span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <SpeakerButton text={exercise.textEn} label={t.lesson.listenSlow} slow />
          <span aria-hidden="true" className="text-sm font-bold text-ink-muted">
            {t.lesson.slowShort}
          </span>
        </div>
      </div>
      <NoVoiceNotice />
      <TextAnswer
        lang="en"
        disabled={disabled}
        onChange={(value) => onChange(value.trim() ? { kind: 'text', value } : null)}
        onSubmit={onSubmit}
      />
    </div>
  );
}
