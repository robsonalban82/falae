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
