// Prints the narration lines of the story (title, scenes, end) as JSON.
// Run with tsx so the app's PT-BR copy stays the single source of the text.
import { t } from '../../src/i18n/pt-BR.ts';

const lines = [
  { id: 'title', text: `${t.story.title}.` },
  ...t.story.scenes.map((s, i) => ({ id: `scene-${i}`, text: s.text })),
  { id: 'end', text: t.story.end },
];
process.stdout.write(JSON.stringify(lines, null, 2));
