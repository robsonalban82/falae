import { useId, useState } from 'react';
import { t } from '../../../i18n/pt-BR';

type Props = {
  lang: 'en' | 'pt';
  disabled: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

/** Shared typing field: Enter submits, no autocorrect (it would "fix" English into Portuguese). */
export function TextAnswer({ lang, disabled, onChange, onSubmit }: Props) {
  const id = useId();
  const [value, setValue] = useState('');
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="sr-only">
        {t.lesson.yourAnswer}
      </label>
      <textarea
        id={id}
        lang={lang}
        rows={3}
        value={value}
        disabled={disabled}
        autoCapitalize="sentences"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder={lang === 'pt' ? t.lesson.answerPlaceholderPt : t.lesson.answerPlaceholderEn}
        onChange={(e) => {
          setValue(e.target.value);
          onChange(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            onSubmit();
          }
        }}
        className="w-full resize-none rounded-2xl border-2 border-line-strong bg-surface p-4 text-lg focus:border-secondary focus:outline-none disabled:opacity-80"
      />
    </div>
  );
}
