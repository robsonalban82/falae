import type { ItemLookup, MapItemShape } from './lines';
import type { RevealMapShape } from './reveal';

/** Small map in the shape of mm-to-be, copied by hand (domain tests never import content). */
export const fixtureMap = {
  branches: [
    {
      nodes: [
        {
          tag: 'regra',
          title: 'Cada pessoa',
          lines: [
            { ref: 'u1-im', hint: 'ser ou estar' },
            { en: 'you **are**', pt: 'você é / está' },
            { note: 'Em inglês o verbo nunca some.' },
          ],
        },
        {
          tag: 'vocabulario',
          lines: [{ ref: 'xa-happy' }, { ref: 'u1-im' }, { ref: 'missing' }],
        },
      ],
    },
    {
      nodes: [
        {
          tag: 'erro-comum',
          lines: [{ wrong: "Yes, I'm.", right: 'Yes, I am.', note: 'Resposta curta.' }],
        },
      ],
    },
  ],
} satisfies RevealMapShape;

export const fixtureItems: Record<string, MapItemShape> = {
  'u1-im': { id: 'u1-im', en: "(I'm) fine", pt: ['estou', 'sou'] },
  'xa-happy': { id: 'xa-happy', en: 'happy', pt: ['feliz'] },
};

export const fixtureLookup: ItemLookup = (id) => fixtureItems[id];
