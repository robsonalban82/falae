import { t } from '../../../i18n/pt-BR';
import { En } from '../../../ui/En';
import { SpeakerButton } from './SpeakerButton';
import { TextAnswer } from './TextAnswer';
import type { ExerciseProps } from './types';
import { ttsSupported } from '../../../services/speech';
import { NoVoiceNotice } from '../../../ui/NoVoiceNotice';

export function TranslateTyping({
  exercise,
  disabled,
  onChange,
  onSubmit,
}: ExerciseProps<'translate-typing'>) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">{t.lesson.instructions['translate-typing']}</h2>
      <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-4">
        {ttsSupported() && <SpeakerButton text={exercise.promptEn} label={t.lesson.listen} />}
        <En className="text-xl font-bold">{exercise.promptEn}</En>
      </div>
      <NoVoiceNotice />
      <TextAnswer
        lang="pt"
        disabled={disabled}
        onChange={(value) => onChange(value.trim() ? { kind: 'text', value } : null)}
        onSubmit={onSubmit}
      />
    </div>
  );
}
