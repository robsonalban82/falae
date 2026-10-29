/** Route paths (PT-BR URLs, see docs/ARQUITETURA.md §13). */
export const paths = {
  path: '/',
  welcome: '/boas-vindas',
  placement: '/nivelamento',
  tip: (skillId = ':skillId') => `/dica/${skillId}`,
  lesson: (lessonId = ':lessonId') => `/licao/${lessonId}`,
  practice: '/praticar',
  profile: '/perfil',
  settings: '/config',
} as const;

/** One-off messages the path shows after a redirect (router location state). */
export type PathNotice = 'lessonLocked' | 'lessonNotFound' | 'tipNotFound';
