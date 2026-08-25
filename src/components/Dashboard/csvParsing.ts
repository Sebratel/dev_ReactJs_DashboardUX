/**
 * Ported parsing/aggregation logic from the vanilla-JS reference dashboard
 * (GERAL_-_An_lises_Tags_Matrix.html). Pure functions only — no DOM access.
 */

/* ════════════════════════════════════ CSV PARSER ════════════════════════════════════ */

export function detectSep(firstLine: string): string {
  let sep = ';';
  let best = -1;
  [';', ',', '\t'].forEach((c) => {
    const n = String(firstLine || '').split(c).length - 1;
    if (n > best) {
      best = n;
      sep = c;
    }
  });
  return best > 0 ? sep : ';';
}

export function splitCSVLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (c === sep && !inQ) {
      result.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  result.push(cur);
  return result;
}

export function parseCSV(text: string): Record<string, string>[] {
  text = String(text || '').replace(/^﻿/, '');
  const sep = detectSep(text.split('\n')[0]);
  const lines = text.split('\n');
  const headers = splitCSVLine(lines[0], sep);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cells = splitCSVLine(lines[i], sep);
    const obj: Record<string, string> = {};
    headers.forEach((h, j) => (obj[h.trim()] = (cells[j] || '').trim()));
    rows.push(obj);
  }
  return rows;
}

/* ════════════════════════════════════ GENERIC HELPERS ════════════════════════════════════ */

export function nrm(s: unknown): string {
  return (s === null || s === undefined ? '' : String(s))
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function findKey(keys: string[], patterns: RegExp[]): string | null {
  for (const p of patterns) {
    const k = keys.find((x) => p.test(nrm(x)));
    if (k) return k;
  }
  return null;
}

export function toInt(v: unknown): number {
  const n = parseInt(String(v === null || v === undefined ? '' : v).replace(/[^0-9-]/g, ''), 10);
  return isNaN(n) ? 0 : n;
}

export function pctOf(a: number, b: number): number {
  return b ? (a / b) * 100 : 0;
}

export function nf(v: number | undefined | null): string {
  return (v || 0).toLocaleString('pt-BR');
}

export function toSecs(s: string): number {
  try {
    const [h, m, sc] = s.split(':');
    return +h * 3600 + +m * 60 + +sc;
  } catch {
    return 0;
  }
}

export function fmtSecs(s: number): string {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  const sc = s % 60;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h ? `${h}h ${mm}m` : `${m}min ${sc}s`;
}

export function getHour(s: string): number {
  try {
    const parts = s.split(' ');
    const t = parts[1] ? parts[1] : parts[0];
    return +t.split(':')[0];
  } catch {
    return -1;
  }
}

export function parseDateEntry(s: string | null | undefined): Date | null {
  if (!s || s === '-') return null;
  try {
    const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    return new Date(s.split(' ')[0]);
  } catch {
    return null;
  }
}

/* ════════════════════════════════════ TAG TAXONOMY ════════════════════════════════════ */

export function cleanTags(raw: string | undefined): string[] {
  if (!raw || raw === '-') return [];
  return raw
    .replace(/"/g, '')
    .split('||')
    .map((t) => t.trim())
    .filter((t) => t);
}

export function isBot(t: string): boolean {
  return t.includes('morpheus') || t.includes('_IA_') || t.includes('_inicio') || t.includes('_start');
}
export function isSupportBot(t: string): boolean {
  return t.toLowerCase().includes('suporte') || t.toLowerCase().includes('financeiro') || t.toLowerCase().includes('morpheus_ia_financeiro');
}
export function isComercialBot(t: string): boolean {
  return t.toLowerCase().includes('comercial') || t.toLowerCase().includes('morpheus_ia_comercial');
}
export function friendlyTag(t: string): string {
  if (t === 'morpheus_ia_financeiro') return 'Bot Financeiro';
  if (t === 'suporte_IA_inicio') return 'Suporte Técnico';
  if (t === 'morpheus_ia_comercial') return 'Bot Comercial';
  if (t === 'comercial_IA_inicio') return 'Comercial';
  return t;
}
export function tagClass(t: string): 'support' | 'comercial' | 'bot' | '' {
  if (isSupportBot(t)) return 'support';
  if (isComercialBot(t)) return 'comercial';
  if (isBot(t)) return 'bot';
  return '';
}
export function isMktTag(t: string): boolean {
  return t.toLowerCase().startsWith('marketing') || t === 'MelhorPlano';
}

/* ════════════════════════════════════ ROW MODEL ════════════════════════════════════ */

export type Row = {
  protocolo: string;
  contato: string;
  telefone: string;
  canal: string;
  entrada: string;
  hora: number;
  status: string;
  tipo: string;
  recorrencia: string;
  tag_raw: string;
  tag_list: string[];
  user_tags: string[];
  bot_tags: string[];
  went_support: boolean;
  went_comercial: boolean;
  sem_tag: boolean;
  atend_secs: number;
  observacao: string;
  ativo_rec: string;
};

export function buildRows(csvRows: Record<string, string>[]): Row[] {
  return csvRows.map((r) => {
    const tagRaw = r['Tag'] || '';
    const tagList = cleanTags(tagRaw);
    const userTags = tagList.filter((t) => !isBot(t));
    const botTags = tagList.filter((t) => isBot(t));
    const wentSupport = tagList.some((t) => isSupportBot(t));
    const wentComercial = tagList.some((t) => isComercialBot(t));
    const atendSecs = toSecs(r['Tempo de Atendimento'] || '0:0:0');
    const hora = getHour(r['Data de Entrada'] || '');
    return {
      protocolo: r['Protocolo'] || '',
      contato: r['Contato'] || '-',
      telefone: r['Telefone'] || '-',
      canal: r['Canal'] || '-',
      entrada: r['Data de Entrada'] || '-',
      hora,
      status: r['Status'] || '-',
      tipo: r['Tipo'] || '-',
      recorrencia: r['Recorrência'] || '-',
      tag_raw: tagRaw,
      tag_list: tagList,
      user_tags: userTags,
      bot_tags: botTags,
      went_support: wentSupport,
      went_comercial: wentComercial,
      sem_tag: tagList.length === 0,
      atend_secs: atendSecs,
      observacao: r['Observação'] || '',
      ativo_rec: r['Ativo/Receptivo?'] || '-',
    };
  });
}

export function hasTag(r: Row, tag: string): boolean {
  return r.tag_list.some((t) => t.trim() === tag);
}

export function isEncerramentoISA(r: Row): boolean {
  if (hasTag(r, 'ISA_SUPORTE_TÉCNICO_ENCERRAMENTO')) return true;
  if (hasTag(r, 'ISA_SUPORTE_TÉCNICO_ENCERRAMENTO_INATIVIDADE')) return true;
  if (hasTag(r, 'ISA_SEGUNDA_VIA_BOLETOS') && hasTag(r, 'ISA_GERAL_ENCERRAMENTO')) return true;
  if (hasTag(r, 'ISA_DESBLOQUEIO_CONFIANÇA') && hasTag(r, 'ISA_GERAL_ENCERRAMENTO')) return true;
  return false;
}

export function isCsOk(r: Row): boolean {
  return hasTag(r, 'CS_CX_72HRS_OK');
}
export function isCsNok(r: Row): boolean {
  return hasTag(r, 'CS_CX_72HRS_NOK');
}

export function csDateKey(r: Row): string {
  const d = parseDateEntry(r.entrada);
  return d ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` : 'Sem data';
}

export function inDateRange(d: Date | null, from?: string, to?: string): boolean {
  if (!from && !to) return true;
  if (!d) return false;
  if (from && d < new Date(from)) return false;
  if (to && d > new Date(to + 'T23:59:59')) return false;
  return true;
}

/* ════════════════════════════════════ HSM ════════════════════════════════════ */

export type HsmAgg = {
  data: string;
  hsm: string;
  enviadas: number;
  entregues: number;
  lidas: number;
  respondidas: number;
  falhas: number;
};

export type HsmMsg = {
  data: string;
  hsm: string;
  raw: string;
  st: 'respondida' | 'lida' | 'entregue' | 'falha' | 'enviada' | 'outros';
  motivo: string;
  fone: string;
  proto: string;
};

export function hsmDateKey(v: string): string {
  const d = parseDateEntry(v);
  if (d && !isNaN(d.getTime())) return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  const t = (v || '').toString().trim().split(' ')[0];
  return t || 'Sem data';
}

export function classifyHsmStatus(v: string): HsmMsg['st'] {
  const s = nrm(v);
  if (!s) return 'outros';
  if (/respond|replied/.test(s)) return 'respondida';
  if (/falh|erro|error|fail|rejeit|nao entreg|undeliver|invalid|expir|cancel|bloque|recusad/.test(s)) return 'falha';
  if (/nao lid|nao vis|unread/.test(s)) return 'entregue';
  if (/\blid|\bread|visualiz/.test(s)) return 'lida';
  if (/entreg|delivered/.test(s)) return 'entregue';
  if (/envi|sent|submit|process|pendent|aguard|fila|queue/.test(s)) return 'enviada';
  return 'outros';
}

export function parseHsmCsv(txt: string): { agg: HsmAgg[]; msgs: HsmMsg[]; byProto: Map<string, HsmMsg>; mode: 'analitico' | 'agregado' } {
  const rows = parseCSV(txt);
  if (!rows.length) throw new Error('CSV vazio ou ilegível');
  const keys = Object.keys(rows[0]);
  const kStatus = findKey(keys, [/^status/, /situacao/, /^estado/]);
  const kEnv = findKey(keys, [/^enviad/, /^envios?$/, /^sent/]);
  const kEnt = findKey(keys, [/^entregue/, /^delivered/]);
  const kLid = findKey(keys, [/^lida/, /^read/]);
  const kData = findKey(keys, [/^data$/, /^data.*(envio|disparo|criac|mensagem|hsm)/, /^data/, /envio/, /criad/, /^dt/]);
  const kHsm = findKey(keys, [/^hsm$/, /template/, /^hsm/, /campanha/, /nome.*(hsm|template|campanha)/, /^nome$/]);
  const kFone = findKey(keys, [/telefone|celular|^numero|destinatario|^destino|msisdn|phone|whats/]);
  const kHsmProto = findKey(keys, [/^prot/, /prot.*atend|atend.*prot/, /protocolo/, /cod.*atend/]);

  const ERR_PRIO = [
    /motivo|reason/,
    /(erro|error|falha|fail).*(desc|detalh|mensag|texto)/,
    /(desc|detalh).*(erro|error|falha)/,
    /^erro$|^error$|^falha$|^mensagem de erro|erro de/,
    /(codigo|code).*(erro|error|falha)|(erro|error|falha).*(codigo|code)/,
    /detalhe.*(status|entrega)|status.*detalhe/,
  ];
  const errKeys: string[] = [];
  ERR_PRIO.forEach((p) =>
    keys.forEach((k) => {
      if (k !== kStatus && errKeys.length < 3 && !errKeys.includes(k) && p.test(nrm(k))) errKeys.push(k);
    })
  );

  const agg: Record<string, HsmAgg> = {};
  const bump = (data: string, hsm: string): HsmAgg => {
    const k = data + '||' + hsm;
    if (!agg[k]) agg[k] = { data, hsm, enviadas: 0, entregues: 0, lidas: 0, respondidas: 0, falhas: 0 };
    return agg[k];
  };
  const msgs: HsmMsg[] = [];
  let mode: 'analitico' | 'agregado';

  if (kStatus) {
    mode = 'analitico';
    rows.forEach((r) => {
      const raw = (r[kStatus] || '').toString().trim();
      const dataRaw = kData ? r[kData] : '';
      if (!raw && !dataRaw) return;
      const data = hsmDateKey(dataRaw);
      const hsm = ((kHsm ? r[kHsm] : '') || '').toString().trim() || '(sem template)';
      const st = classifyHsmStatus(raw);

      let motivo = errKeys
        .map((k) => (r[k] || '').toString().trim())
        .filter((v) => v && nrm(v) !== nrm(raw) && !/^(-|0|n\/a|na|null|undefined|sem)$/i.test(v))
        .join(' · ');
      if (!motivo && st === 'falha') {
        motivo = raw.split(/\s*[-–—:|]\s*/).slice(1).join(' - ').trim();
      }

      msgs.push({
        data,
        hsm,
        raw: raw || '(sem status)',
        st,
        motivo,
        fone: ((kFone ? r[kFone] : '') || '').toString().trim(),
        proto: ((kHsmProto ? r[kHsmProto] : '') || '').toString().trim(),
      });
      const a = bump(data, hsm);
      a.enviadas++;
      if (st === 'entregue' || st === 'lida' || st === 'respondida') a.entregues++;
      if (st === 'lida' || st === 'respondida') a.lidas++;
      if (st === 'respondida') a.respondidas++;
      if (st === 'falha') a.falhas++;
    });
  } else if (kEnv || kEnt || kLid) {
    mode = 'agregado';
    rows.forEach((r) => {
      const e = toInt(kEnv ? r[kEnv] : 0);
      const d = toInt(kEnt ? r[kEnt] : 0);
      const l = toInt(kLid ? r[kLid] : 0);
      if (!e && !d && !l) return;
      const data = hsmDateKey(kData ? r[kData] : '');
      const hsm = ((kHsm ? r[kHsm] : '') || '').toString().trim() || '(sem template)';
      const a = bump(data, hsm);
      a.enviadas += e;
      a.entregues += d;
      a.lidas += l;
    });
    Object.values(agg).forEach((a) => {
      a.falhas = Math.max(a.enviadas - a.entregues, 0);
    });
  } else {
    throw new Error('não encontrei coluna de Status nem colunas Enviadas/Entregues/Lidas neste CSV');
  }

  const byProto = new Map<string, HsmMsg>();
  msgs.forEach((m) => {
    const p = String(m.proto || '').replace(/\D/g, '');
    if (p && !byProto.has(p)) byProto.set(p, m);
  });

  const out = Object.values(agg);
  if (!out.length) throw new Error('nenhuma linha válida encontrada');
  return { agg: out, msgs, byProto, mode };
}

export function sumHsm(rows: HsmAgg[]) {
  return rows.reduce(
    (a, r) => {
      a.enviadas += r.enviadas;
      a.entregues += r.entregues;
      a.lidas += r.lidas;
      a.falhas += r.falhas;
      a.respondidas += r.respondidas || 0;
      return a;
    },
    { enviadas: 0, entregues: 0, lidas: 0, falhas: 0, respondidas: 0 }
  );
}

export function sortDateKeys(a: string, b: string): number {
  const da = parseDateEntry(a);
  const db = parseDateEntry(b);
  return (da ? da.getTime() : 0) - (db ? db.getTime() : 0);
}

/* ════════════════════════════════════ ENVCX (Data Hub) ════════════════════════════════════ */

export type EnvCxRow = {
  ts: Date | null;
  tsLbl: string;
  protocolo: string;
  cod: string;
  nome: string;
  telefone: string;
  cidade: string;
  bairro: string;
  contrato: string;
  statusRaw: string;
  msg: string;
  codigoErro: string;
  motivoErro: string;
  gerado: boolean;
  ord: number;
};

export type EnvCxEnriched = EnvCxRow & {
  atend: Row | null;
  via: string;
  res: 'ok' | 'nok' | 'semresp' | 'naoachado';
  primeiro: boolean;
  hsm: HsmMsg | null;
};

const ENVCX_COLS = [
  'id',
  'data_envio',
  'cod_atendimento',
  'prot_atendimento',
  'cliente_nome',
  'telefone',
  'cliente_cidade',
  'cliente_bairro',
  'cliente_contrato',
  'status_envio',
  'mensagem_envio',
];

function parseTs(v: string): Date | null {
  const s = String(v || '').trim();
  if (!s) return null;
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  m = s.match(/(\d{2})\/(\d{2})\/(\d{4})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  return null;
}
const p2 = (n: number) => String(n).padStart(2, '0');
export function fmtTs(d: Date | null): string {
  return d ? `${p2(d.getDate())}/${p2(d.getMonth() + 1)} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}` : '—';
}
export function fmtTsCurto(d: Date | null): string {
  return d ? `${p2(d.getDate())}/${p2(d.getMonth() + 1)} ${p2(d.getHours())}:${p2(d.getMinutes())}` : '—';
}

function splitErro(msg: string): { codigo: string; motivo: string } {
  const m = String(msg || '').match(/^\s*\[([^\]]+)\]\s*(.*)$/);
  if (m) return { codigo: m[1].trim(), motivo: (m[2] || '').trim() || m[1].trim() };
  return { codigo: '', motivo: String(msg || '').trim() };
}

export function parseEnvCxCsv(txt: string): { rows: EnvCxRow[]; semCabecalho: boolean } {
  const texto = String(txt || '').replace(/^﻿/, '');
  const linhas = texto.split('\n').filter((l) => l.trim());
  if (!linhas.length) throw new Error('CSV vazio ou ilegível');

  const sep = detectSep(linhas[0]);
  const c0 = splitCSVLine(linhas[0], sep).map((c) => c.trim());
  const HDR_TOKENS =
    /^(id|data|hora|data[_ -]?envio|dt[_ -]?envio|data[_ -]?hora|cod[_ -]?atendimento|codigo|prot[_ -]?atendimento|protocolo|prot|cliente[_ -]?nome|nome|telefone|celular|cliente[_ -]?cidade|cidade|municipio|cliente[_ -]?bairro|bairro|cliente[_ -]?contrato|contrato|status[_ -]?envio|status|situacao|mensagem[_ -]?envio|mensagem|msg|retorno)$/;
  const temCabecalho = c0.filter((c) => HDR_TOKENS.test(nrm(c))).length >= 2;
  const semCabecalho = !temCabecalho;

  let rows: Record<string, string>[];
  if (temCabecalho) {
    rows = parseCSV(texto);
  } else {
    rows = linhas.map((l) => {
      const c = splitCSVLine(l, sep);
      const o: Record<string, string> = {};
      ENVCX_COLS.forEach((k, i) => {
        o[k] = (c[i] || '').trim();
      });
      return o;
    });
  }

  const keys = Object.keys(rows[0]);
  const kData = findKey(keys, [/data.*envio|envio.*data/, /^data|^dt|^hora|criad|created/]);
  const kProto = findKey(keys, [/^prot/, /prot.*atend|atend.*prot/, /protocolo/]);
  const kCod = findKey(keys, [/cod.*atend|atend.*cod/, /^cod(igo)?$/]);
  const kNome = findKey(keys, [/cliente.*nome|nome.*cliente/, /^nome/, /razao/]);
  const kFone = findKey(keys, [/telefone|celular|whats|^fone/]);
  const kCidade = findKey(keys, [/cidade|municipio/]);
  const kBairro = findKey(keys, [/bairro/]);
  const kContrato = findKey(keys, [/contrato/]);
  const kStatus = findKey(keys, [/status.*envio/, /^status/, /^situacao/]);
  const kMsg = findKey(keys, [/mensagem.*envio/, /^mensagem/, /^msg/, /retorno|resultado/]);

  if (!kStatus && !kMsg) throw new Error('não encontrei as colunas status_envio / mensagem_envio');

  const val = (r: Record<string, string>, k: string | null) => ((k ? r[k] : '') || '').toString().trim();

  const out: EnvCxRow[] = rows
    .map((r) => {
      const statusRaw = val(r, kStatus);
      const msg = val(r, kMsg);
      const gerado = /^(1|s|sim|true|ok)$/i.test(statusRaw) || (!statusRaw && /sucesso/i.test(msg));
      const err = gerado ? { codigo: '', motivo: '' } : splitErro(msg);
      const ts = parseTs(val(r, kData));
      return {
        ts,
        tsLbl: fmtTs(ts),
        protocolo: val(r, kProto),
        cod: val(r, kCod),
        nome: val(r, kNome) || '(sem nome)',
        telefone: val(r, kFone),
        cidade: val(r, kCidade) || '(sem cidade)',
        bairro: val(r, kBairro) || '(sem bairro)',
        contrato: val(r, kContrato),
        statusRaw,
        msg: msg || (gerado ? 'Atendimento gerado com sucesso' : 'Não gerado'),
        codigoErro: err.codigo,
        motivoErro: err.motivo,
        gerado,
        ord: 0,
      };
    })
    .filter((r) => r.telefone || r.protocolo || r.nome !== '(sem nome)');

  if (!out.length) throw new Error('nenhuma linha válida encontrada');

  out.forEach((r, i) => {
    r.ord = i;
  });
  out.sort((a, b) => {
    if (a.ts && b.ts) return a.ts.getTime() - b.ts.getTime();
    if (a.ts) return -1;
    if (b.ts) return 1;
    return a.ord - b.ord;
  });
  return { rows: out, semCabecalho };
}

const FONE_LENS = [11, 10, 9, 8];
function phoneKeys(v: string): string[] {
  const d = String(v || '').replace(/\D/g, '');
  return FONE_LENS.filter((l) => d.length >= l).map((l) => l + ':' + d.slice(-l));
}

export function buildRowIndex(rows: Row[]) {
  const byPhone = new Map<string, Row>();
  const byProto = new Map<string, Row>();
  rows.forEach((r) => {
    phoneKeys(r.telefone).forEach((k) => {
      if (!byPhone.has(k)) byPhone.set(k, r);
    });
    const p = String(r.protocolo || '').replace(/\D/g, '');
    if (p && !byProto.has(p)) byProto.set(p, r);
  });
  return { byPhone, byProto };
}

function matchEnvCx(e: EnvCxRow, idx: { byPhone: Map<string, Row>; byProto: Map<string, Row> }): { r: Row | null; via: string } {
  const proto = String(e.protocolo || '').replace(/\D/g, '');
  if (proto && idx.byProto.has(proto)) return { r: idx.byProto.get(proto)!, via: 'protocolo' };
  const cod = String(e.cod || '').replace(/\D/g, '');
  if (cod && idx.byProto.has(cod)) return { r: idx.byProto.get(cod)!, via: 'cod. atendimento' };
  for (const k of phoneKeys(e.telefone)) {
    if (idx.byPhone.has(k)) return { r: idx.byPhone.get(k)!, via: 'telefone' };
  }
  return { r: null, via: '' };
}

export function envCxEnriched(
  envcxRows: EnvCxRow[],
  rows: Row[],
  hsmByProto: Map<string, HsmMsg>,
  from?: string,
  to?: string
): EnvCxEnriched[] {
  const idx = buildRowIndex(rows);
  const vistos = new Set<Row>();
  return envcxRows
    .filter((e) => {
      if (!from && !to) return true;
      if (!e.ts) return true;
      if (from && e.ts < new Date(from)) return false;
      if (to && e.ts > new Date(to + 'T23:59:59')) return false;
      return true;
    })
    .map((e) => {
      const { r, via } = matchEnvCx(e, idx);
      let res: EnvCxEnriched['res'] = 'naoachado';
      if (r) res = isCsOk(r) ? 'ok' : isCsNok(r) ? 'nok' : 'semresp';
      const primeiro = !r || !vistos.has(r);
      if (r) vistos.add(r);

      let hsmMsg: HsmMsg | null = null;
      if (hsmByProto.size) {
        const pe = String(e.protocolo || '').replace(/\D/g, '');
        if (pe && hsmByProto.has(pe)) hsmMsg = hsmByProto.get(pe)!;
        if (!hsmMsg && r) {
          const pa = String(r.protocolo || '').replace(/\D/g, '');
          if (pa && hsmByProto.has(pa)) hsmMsg = hsmByProto.get(pa)!;
        }
      }
      return { ...e, atend: r, via, res, primeiro, hsm: hsmMsg };
    });
}

export const PAL = ['#2563eb', '#15803d', '#b45309', '#6d28d9', '#dc2626', '#0f766e', '#c2410c', '#be185d'];

export const STATUS_COLORS: Record<string, [string, string]> = {
  Finalizado: ['var(--color-success-soft)', 'var(--color-success)'],
  Automático: ['#fbf2da', '#854d0e'],
  'Finalizado por inatividade': ['#fbf4e9', '#b45309'],
  'Em pesquisa': ['var(--color-danger-soft)', 'var(--color-danger)'],
};
