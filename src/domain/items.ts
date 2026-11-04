/** The part of an item that maps and cards show (unit and bank items both fit). */
export type MapItemShape = {
  id: string;
  en: string;
  pt: string | readonly string[];
};

export const joinSenses = (pt: string | readonly string[]): string =>
  typeof pt === 'string' ? pt : pt.join(', ');
