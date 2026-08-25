import { useMemo, useState } from 'react';
import { fmtSecs, tagClass, friendlyTag, STATUS_COLORS, type Row } from './csvParsing';
import type { DrawerState } from './types';

const TIPO_COLORS: Record<string, [string, string]> = {
  Automático: ['#fbf2da', '#854d0e'],
  Misto: ['#eff4ff', '#1e40af'],
  Humano: ['#f4f2fd', '#5b21b6'],
};

function StatusBadge({ s }: { s: string }) {
  const c = STATUS_COLORS[s] || ['var(--color-nodata-soft)', 'var(--color-muted)'];
  return (
    <span className="dash-badge" style={{ background: c[0], color: c[1] }}>
      {s}
    </span>
  );
}
function TipoBadge({ t }: { t: string }) {
  const c = TIPO_COLORS[t] || ['var(--color-nodata-soft)', 'var(--color-muted)'];
  return (
    <span className="dash-badge" style={{ background: c[0], color: c[1] }}>
      {t}
    </span>
  );
}

export function DrawerTable({ drawer, allRows, onClose }: { drawer: DrawerState; allRows: Row[]; onClose: () => void }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [recFilter, setRecFilter] = useState('');

  const baseRows = useMemo(() => (drawer ? allRows.filter(drawer.predicate) : []), [drawer, allRows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return baseRows.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (recFilter && r.recorrencia !== recFilter) return false;
      if (q && ![r.protocolo, r.contato, r.telefone, ...r.tag_list, r.observacao, r.status, r.recorrencia, r.tipo].join(' ').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [baseRows, search, statusFilter, recFilter]);

  if (!drawer) return null;

  return (
    <div className="dash-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dash-drawer">
        <div className="dash-drw-hdr">
          <h2>{drawer.title}</h2>
          <span className="dash-drw-badge">{baseRows.length}</span>
          <button className="dash-drw-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="dash-drw-search">
          <input type="text" placeholder="Buscar por nome, protocolo, tag, observação..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos os status</option>
            <option>Finalizado</option>
            <option>Automático</option>
            <option>Finalizado por inatividade</option>
            <option>Em pesquisa</option>
          </select>
          <select value={recFilter} onChange={(e) => setRecFilter(e.target.value)}>
            <option value="">Todas recorrências</option>
            <option>Reincidente</option>
            <option>Rechamada</option>
            <option>Recorrente</option>
          </select>
        </div>
        <div className="dash-drw-body">
          {filtered.length ? (
            <table className="dash-tbl">
              <thead>
                <tr>
                  <th>Protocolo</th>
                  <th>Contato</th>
                  <th>Telefone</th>
                  <th>Entrada</th>
                  <th>Status</th>
                  <th>Tipo</th>
                  <th>Jornada / Tags</th>
                  <th>Recorrência</th>
                  <th>T. Atend.</th>
                  <th>Observação</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={i}>
                    <td className="mono">{r.protocolo}</td>
                    <td className="bold">{r.contato}</td>
                    <td className="mono">{r.telefone}</td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{r.entrada}</td>
                    <td>
                      <StatusBadge s={r.status} />
                    </td>
                    <td>
                      <TipoBadge t={r.tipo} />
                    </td>
                    <td>
                      {r.tag_list.length ? (
                        r.tag_list.map((t, j) => (
                          <span key={j} className={`dash-tag-badge ${tagClass(t)}`}>
                            {friendlyTag(t)}
                          </span>
                        ))
                      ) : (
                        <span style={{ color: '#d1d5db', fontSize: 11 }}>sem tag</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12 }}>{r.recorrencia}</td>
                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtSecs(r.atend_secs)}</td>
                    <td className="dash-obs-td" title={r.observacao.replace(/"/g, '')}>
                      {r.observacao || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="dash-no-r">Nenhum resultado.</div>
          )}
        </div>
        <div className="dash-drw-foot">
          {filtered.length} de {baseRows.length} registro{baseRows.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}
