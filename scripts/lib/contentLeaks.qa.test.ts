import { describe, expect, it } from 'vitest';
import { contentMarkers, sceneLeaks } from './contentLeaks';

// QA: false positives / false negatives of the lazy-content leak check.

describe('contentMarkers (QA)', () => {
  it('a file with only short texts yields no marker (the check is silently skipped)', () => {
    const bank = {
      id: 'frases',
      title: 'Frases',
      sentences: [
        { id: 'fr-001', en: 'Nice to meet you.', pt: 'Prazer.' },
        { id: 'fr-002', en: 'How are you?', pt: 'Tudo bem?' },
      ],
    };
    expect(contentMarkers(bank, '')).toEqual([]);
  });

  it('texts with quotes, apostrophes or backslashes are never chosen', () => {
    const raw = { a: "That's a really long sentence here.", b: 'Ele disse "oi" bem alto, viu?' };
    expect(contentMarkers(raw, '')).toEqual([]);
  });

  it('ties are broken alphabetically and duplicates count once', () => {
    const raw = ['bbbbbbbbbbbbbbbbbbbb', 'aaaaaaaaaaaaaaaaaaaa', 'aaaaaaaaaaaaaaaaaaaa'];
    expect(contentMarkers(raw, '')).toEqual(['aaaaaaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbbbbbb']);
  });

  it('numbers, booleans and null are ignored; nested arrays are walked', () => {
    expect(
      contentMarkers({ n: 1, b: true, z: null, deep: [[['texto bem comprido aqui, ok']]] }, ''),
    ).toEqual(['texto bem comprido aqui, ok']);
  });

  it('common phrases that also live in the UI copy can be picked (false-positive risk)', () => {
    // If pt-BR.ts (initial JS) ever shows this sentence, check-prod-bundle would blame the bank.
    const bank = { sentences: [{ en: 'Nice to meet you, Ana.', pt: 'Prazer em te conhecer.' }] };
    expect(contentMarkers(bank, '')).toContain('Nice to meet you, Ana.');
  });

  it('does not pick texts with line breaks (they never match minified code)', () => {
    const raw = { intro: 'Primeira linha comprida\nsegunda linha comprida' };
    expect(contentMarkers(raw, '')).toEqual([]);
  });
});

describe('sceneLeaks (QA)', () => {
  it('JSX svg elements compile to jsx("svg") and are not flagged', () => {
    expect(sceneLeaks('jsx("svg",{viewBox:"0 0 24 24",children:jsx("path",{d:"M0"})})')).toEqual(
      [],
    );
  });

  it('flags <SVG> regardless of case', () => {
    expect(sceneLeaks('x="<SVG>"')).toEqual(['SVG embutido (<svg) no JS inicial']);
  });

  it('does not mistake a non-scene asset name for a hashed scene', () => {
    expect(sceneLeaks('icon="/assets/icon-settings.svg"')).toEqual([]);
  });
});
