import { achievements } from '../domain/gamification/achievements';
import { t } from './pt-BR';

describe('achievement copy', () => {
  it('every achievement has a title and description in pt-BR, and nothing extra', () => {
    expect(Object.keys(t.achievements.list).sort()).toEqual(achievements.map((a) => a.id).sort());
  });
});
