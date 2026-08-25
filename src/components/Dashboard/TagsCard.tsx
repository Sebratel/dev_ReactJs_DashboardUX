import { Card, BarList, type BarItem } from './primitives';
import { PAL, type Row } from './csvParsing';

export function TagsCard({ rows, onOpenDrawer }: { rows: Row[]; onOpenDrawer: (title: string, pred: (r: Row) => boolean) => void }) {
  const counts = new Map<string, number>();
  let semTag = 0;
  rows.forEach((r) => {
    if (!r.user_tags.length) {
      semTag++;
      return;
    }
    r.user_tags.forEach((t) => counts.set(t, (counts.get(t) || 0) + 1));
  });
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const total = rows.length || 1;

  const items: BarItem[] = sorted.map(([lbl, v], i) => ({
    key: lbl,
    label: lbl,
    value: v,
    pct: (v / total) * 100,
    color: PAL[i % PAL.length],
    onClick: () => onOpenDrawer(lbl, (r) => r.user_tags.includes(lbl)),
  }));
  if (semTag) {
    items.push({
      key: '__sem_tag__',
      label: 'Sem tag',
      value: semTag,
      pct: (semTag / total) * 100,
      color: 'var(--color-nodata)',
      onClick: () => onOpenDrawer('Sem tag identificada', (r) => r.sem_tag),
    });
  }

  return (
    <Card title="Motivo do Contato" onClick={() => onOpenDrawer('Motivo do Contato', () => true)}>
      <BarList items={items} />
    </Card>
  );
}
