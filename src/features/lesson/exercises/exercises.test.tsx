import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Exercise } from '../../../content/schema';
import { ExerciseView } from './exerciseRegistry';

/** Testing Library coverage of the 7 exercise types (rendered through the registry). */

function setup(exercise: Exercise, disabled = false) {
  const onChange = vi.fn();
  const onSubmit = vi.fn();
  const onSkip = vi.fn();
  const utils = render(
    <ExerciseView
      exercise={exercise}
      disabled={disabled}
      onChange={onChange}
      onSubmit={onSubmit}
      onSkip={onSkip}
      sound={false}
    />,
  );
  return { ...utils, onChange, onSubmit, onSkip, user: userEvent.setup() };
}

const mc: Exercise = {
  id: 'c-mc',
  type: 'multiple-choice',
  itemIds: ['x'],
  prompt: 'Qual destas significa "olá"?',
  options: [{ text: 'hello', emoji: '👋' }, { text: 'thanks' }, { text: 'bye' }],
  answer: 'hello',
};
const fill: Exercise = {
  id: 'c-fb',
  type: 'fill-blank',
  itemIds: ['x'],
  sentence: 'I ___ thirty years old.',
  options: ['am', 'have', 'is'],
  answer: 'am',
  translationPt: 'Eu tenho trinta anos.',
};
const bank: Exercise = {
  id: 'c-wb',
  type: 'word-bank',
  itemIds: ['x'],
  promptPt: 'Prazer em te conhecer.',
  answer: 'Nice to meet you.',
  distractors: ['know', 'for'],
};
const tt: Exercise = {
  id: 'c-tt',
  type: 'translate-typing',
  itemIds: ['x'],
  promptEn: 'Thanks a lot!',
  accepted: ['Muito obrigado'],
};
const lt: Exercise = {
  id: 'c-lt',
  type: 'listen-type',
  itemIds: ['x'],
  textEn: 'Nice to meet you.',
};
const sp: Exercise = {
  id: 'c-sp',
  type: 'speak',
  itemIds: ['x'],
  textEn: 'Hello, my name is Ana.',
};
const pairs: Exercise = {
  id: 'c-mp',
  type: 'match-pairs',
  itemIds: ['x'],
  pairs: [
    { en: 'hello', pt: 'olá' },
    { en: 'thanks', pt: 'obrigado' },
    { en: 'bye', pt: 'tchau' },
    { en: 'please', pt: 'por favor' },
  ],
};

describe('multiple-choice', () => {
  it('selects by click and by keys 1–4, and marks options as English', async () => {
    const { user, onChange } = setup(mc);
    const group = screen.getByRole('radiogroup', { name: mc.prompt });
    expect(group).toBeInTheDocument();
    await user.keyboard('1');
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'choice', value: 'hello' });
    expect(screen.getByRole('radio', { name: /hello/ })).toBeChecked();
    await user.click(screen.getByText('thanks'));
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'choice', value: 'thanks' });
    expect(screen.getByRole('radio', { name: /thanks/ })).toBeChecked();
    expect(screen.getByText('hello').closest('[lang]')).toHaveAttribute('lang', 'en');
  });

  it('ignores keys beyond the number of options and when disabled', async () => {
    const { user, onChange, rerender } = setup(mc);
    await user.keyboard('4');
    await user.keyboard('0');
    expect(onChange).not.toHaveBeenCalled();
    rerender(
      <ExerciseView
        exercise={mc}
        disabled
        onChange={onChange}
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        sound={false}
      />,
    );
    await user.keyboard('2');
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: /thanks/ })).toBeDisabled();
  });

  it('number keys still work after an option got focus by click (mixed mouse + keyboard) (fixed)', async () => {
    const { user, onChange } = setup(mc);
    await user.click(screen.getByText('thanks')); // focuses the hidden radio input
    await user.keyboard('3');
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'choice', value: 'bye' });
  });
});

describe('fill-blank', () => {
  it('shows the chosen word in the gap and the translation', async () => {
    const { user, onChange } = setup(fill);
    expect(screen.getByText(/Eu tenho trinta anos/)).toBeInTheDocument();
    await user.keyboard('1');
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'choice', value: 'am' });
    const sentence = screen.getByText(
      (_, el) => el?.tagName === 'P' && /^I\s*am\s*thirty/.test(el.textContent ?? ''),
    );
    expect(sentence).toBeInTheDocument();
  });
});

describe('word-bank', () => {
  it('builds the sentence from tiles, removes tiles, and reports null when empty', async () => {
    const { user, onChange } = setup(bank);
    for (const w of ['Nice', 'to', 'meet', 'you']) {
      await user.click(screen.getByRole('button', { name: `Adicionar "${w}"` }));
    }
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'text', value: 'Nice to meet you' });
    // used tiles cannot be added twice
    expect(screen.getByRole('button', { name: 'Adicionar "Nice"' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Remover "to"' }));
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'text', value: 'Nice meet you' });
    for (const w of ['Nice', 'meet', 'you']) {
      await user.click(screen.getByRole('button', { name: `Remover "${w}"` }));
    }
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('tile order is stable across remounts (reload keeps tiles in place)', () => {
    const order = () =>
      screen
        .getAllByRole('button', { name: /^Adicionar/ })
        .map((b) => b.textContent)
        .join(',');
    const a = setup(bank);
    const first = order();
    a.unmount();
    setup(bank);
    expect(order()).toBe(first);
  });

  it('distractors are offered as tiles', () => {
    setup(bank);
    expect(screen.getByRole('button', { name: 'Adicionar "know"' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adicionar "for"' })).toBeInTheDocument();
  });
});

describe('translate-typing / listen-type', () => {
  it('translate: textarea in PT, Enter submits, Shift+Enter does not, blank → null', async () => {
    const { user, onChange, onSubmit } = setup(tt);
    const box = screen.getByRole('textbox', { name: 'Sua resposta' });
    expect(box).toHaveAttribute('lang', 'pt');
    expect(box).toHaveAttribute('autocorrect', 'off');
    expect(box).toHaveAttribute('spellcheck', 'false');
    await user.type(box, '   ');
    expect(onChange).toHaveBeenLastCalledWith(null);
    await user.clear(box);
    await user.type(box, 'Muito obrigado');
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'text', value: 'Muito obrigado' });
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    expect(onSubmit).not.toHaveBeenCalled();
    await user.keyboard('{Enter}');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('listen: English textarea and both speaker buttons, without crashing when TTS is missing', async () => {
    const { user } = setup(lt);
    expect(screen.getByRole('textbox')).toHaveAttribute('lang', 'en');
    await user.click(screen.getByRole('button', { name: 'Ouvir' }));
    await user.click(screen.getByRole('button', { name: 'Ouvir devagar' }));
    // the sentence itself must not be visible (it is a listening exercise)
    expect(screen.queryByText('Nice to meet you.')).toBeNull();
  });

  it('disabled locks the field', () => {
    setup(tt, true);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });
});

describe('speak', () => {
  afterEach(() => {
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
  });

  it('"Não posso falar agora" calls onSkip and is hidden after checking', async () => {
    const { user, onSkip, rerender } = setup(sp);
    await user.click(screen.getByRole('button', { name: 'Não posso falar agora' }));
    expect(onSkip).toHaveBeenCalledTimes(1);
    rerender(
      <ExerciseView
        exercise={sp}
        disabled
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onSkip={onSkip}
        sound={false}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Não posso falar agora' })).toBeNull();
  });

  it('reports transcripts from a (fake) recognizer, and handles mic denial', async () => {
    type Rec = {
      onresult: ((e: unknown) => void) | null;
      onerror: ((e: { error: string }) => void) | null;
      onend: (() => void) | null;
    };
    let last: Rec | null = null;
    const instances: Rec[] = [];
    class FakeRecognition {
      onresult: Rec['onresult'] = null;
      onerror: Rec['onerror'] = null;
      onend: Rec['onend'] = null;
      constructor() {
        instances.push(this);
      }
      start() {
        last = instances[instances.length - 1] ?? null;
      }
      abort() {}
    }
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeRecognition;
    const { user, onChange } = setup(sp);
    await user.click(screen.getByRole('button', { name: 'Toque para falar' }));
    expect(screen.getByRole('button', { name: 'Ouvindo… fale agora' })).toBeDisabled();
    await act(async () => {
      last!.onresult!({
        results: [
          [{ transcript: 'hello my name is Ana' }, { transcript: 'hello my name is Anna' }],
        ],
      });
    });
    expect(onChange).toHaveBeenLastCalledWith({
      kind: 'speech',
      transcripts: ['hello my name is Ana', 'hello my name is Anna'],
    });
    expect(screen.getByText(/Entendi:/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Toque para falar' }));
    await act(async () => last!.onerror!({ error: 'not-allowed' }));
    expect(screen.getByText(/Sem acesso ao microfone/)).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith(null);

    await user.click(screen.getByRole('button', { name: 'Toque para falar' }));
    await act(async () => last!.onend!());
    expect(screen.getByText(/Não ouvi nada/)).toBeInTheDocument();
  });
});

describe('match-pairs', () => {
  it('wrong pair shows a message, right pairs lock, the last pair auto-submits with mistake count', async () => {
    const { user, onSubmit, onChange } = setup(pairs);
    const btn = (name: string) =>
      screen.getByRole('button', { name: new RegExp(`^(✓ )?${name}$`) });
    await user.click(btn('hello'));
    expect(btn('hello')).toHaveAttribute('aria-pressed', 'true');
    await user.click(btn('tchau'));
    expect(screen.getByText('Esse par não combina. Tente de novo.')).toBeInTheDocument();
    await user.click(btn('olá'));
    await user.click(btn('hello')); // order PT→EN also works
    expect(btn('hello')).toBeDisabled();
    expect(screen.getByText('1 de 4 pares')).toBeInTheDocument();
    for (const [en, pt] of [
      ['thanks', 'obrigado'],
      ['bye', 'tchau'],
      ['please', 'por favor'],
    ] as const) {
      await user.click(btn(en));
      await user.click(btn(pt));
    }
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ kind: 'pairs', mistakes: 1 });
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'pairs', mistakes: 1 });
    expect(screen.getByText('Todos os pares certos!')).toBeInTheDocument();
  });

  it('tapping the same side twice just moves the selection', async () => {
    const { user } = setup(pairs);
    await user.click(screen.getByRole('button', { name: 'hello' }));
    await user.click(screen.getByRole('button', { name: 'bye' }));
    expect(screen.getByRole('button', { name: 'hello' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'bye' })).toHaveAttribute('aria-pressed', 'true');
  });
});
