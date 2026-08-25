import { Card } from './primitives';
import { friendlyTag, tagClass, STATUS_COLORS, type Row } from './csvParsing';

export function JourneyCard({ rows, onOpenDrawer }: { rows: Row[]; onOpenDrawer: (title: string, pred: (r: Row) => boolean) => void }) {
  const seqMap = new Map<string, { seq: string[]; rows: Row[] }>();
  rows.forEach((r) => {
    if (!r.tag_list.length) return;
    const key = r.tag_list.join(' || ');
    if (!seqMap.has(key)) seqMap.set(key, { seq: r.tag_list, rows: [] });
    seqMap.get(key)!.rows.push(r);
  });
  const sorted = [...seqMap.values()].sort((a, b) => b.rows.length - a.rows.length);

  return (
    <Card title="Jornada do Cliente no Bot (Caminho de Cliques)" full>
      <div className="dash-journey-flow">
        {sorted.map((item) => {
          const statusCounts = new Map<string, number>();
          item.rows.forEach((r) => statusCounts.set(r.status, (statusCounts.get(r.status) || 0) + 1));
          const topStatus = [...statusCounts.entries()].sort((a, b) => b[1] - a[1])[0];
          const sc = (topStatus && STATUS_COLORS[topStatus[0]]) || ['var(--color-nodata-soft)', 'var(--color-muted)'];
          return (
            <div
              key={item.seq.join('||')}
              className="dash-jflow-row"
              onClick={() => onOpenDrawer('Jornada: ' + item.seq.join(' → '), (r) => r.tag_list.join(' || ') === item.seq.join(' || '))}
            >
              <div className="dash-jflow-steps">
                {item.seq.map((t, i) => (
                  <span key={i}>
                    <span className={`dash-jflow-step ${tagClass(t)}`}>{friendlyTag(t)}</span>
                    {i < item.seq.length - 1 && <span className="dash-jflow-arr">→</span>}
                  </span>
                ))}
              </div>
              <div className="dash-jflow-count">{item.rows.length}×</div>
              <span className="dash-jflow-status" style={{ background: sc[0], color: sc[1] }}>
                {topStatus?.[0] || ''}
              </span>
            </div>
          );
        })}
        {!sorted.length && <div className="dash-empty">Nenhum dado de jornada disponível.</div>}
      </div>
    </Card>
  );
}
