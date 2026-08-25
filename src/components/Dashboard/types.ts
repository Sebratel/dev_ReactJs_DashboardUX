export type TabKey = 'atendimento' | 'hsm' | 'cx';

export type DrawerState = {
  title: string;
  predicate: (r: import('./csvParsing').Row) => boolean;
} | null;
