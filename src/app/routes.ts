/** Route paths (PT-BR URLs, see docs/ARQUITETURA.md §13). */
export const paths = {
  path: '/',
  welcome: '/boas-vindas',
  placement: '/nivelamento',
  tip: (skillId = ':skillId') => `/dica/${skillId}`,
  lesson: (lessonId = ':lessonId') => `/licao/${lessonId}`,
  maps: '/mapas',
  map: (mapId = ':mapId') => `/mapas/${mapId}`,
  mapPractice: (mapId = ':mapId') => `/mapas/${mapId}/praticar`,
  collection: (collectionId = ':collectionId') => `/mapas/colecoes/${collectionId}`,
  practice: '/praticar',
  practiceSession: '/praticar/sessao',
  profile: '/perfil',
  settings: '/config',
} as const;

/** One-off messages the path shows after a redirect (router location state). */
export type PathNotice = 'lessonLocked' | 'lessonNotFound' | 'tipNotFound';
