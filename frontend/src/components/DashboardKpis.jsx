import { useEffect, useState } from 'react';
import { api } from '../api/client';

/* Dashboard KPI visuals, last 3 calendar months.
   Inline and final inspections are shown side by side in every panel, never
   mixed: an inline fail is usually followed by a final inspection of the same
   goods, so a combined rate would count those pieces twice.
   Colour is functional: inline = blue (in production, chosen over the
   signal orange), final = confirm green (shipped quality, same green as Pass).
   Severity uses the badge colours (major red, minor amber, other grey). */
export const TYPES = [
  { key: 'inline', label: 'Inline', color: '#1F639B' },
  { key: 'final', label: 'Final', color: '#4F7A4A' },
];

const fmtN = (n) => (n >= 10000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : String(n));
const pct = (n, base) => (base ? (n / base) * 100 : 0);
const fmtPct = (n, base) => (base ? `${((n / base) * 100).toFixed(2)}%` : '—');
const totalDef = (m) => m.major_pcs + m.minor_pcs + m.other_pcs;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

function Legend() {
  return (
    <div className="kpi-legend">
      {TYPES.map((t) => <span key={t.key}><i style={{ background: t.color }} />{t.label}</span>)}
    </div>
  );
}

function useTooltip() {
  const [tip, setTip] = useState(null);
  const show = (e, content) => {
    const host = e.currentTarget.closest('.panel').getBoundingClientRect();
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ x: r.left - host.left + r.width / 2, y: r.top - host.top, content });
  };
  const hide = () => setTip(null);
  const node = tip ? (
    <div className="kpi-tip" style={{ left: tip.x, top: tip.y }}>{tip.content}</div>
  ) : null;
  return { show, hide, node };
}

/* 1. Overview — headline figures, inline next to final */
function Overview({ data }) {
  const rows = [
    { label: 'Defect rate', get: (d) => fmtPct(d.tiles.defects, d.tiles.pcs), big: true },
    { label: 'Pcs inspected', get: (d) => fmtN(d.tiles.pcs) },
    { label: 'Defects found', get: (d) => fmtN(d.tiles.defects) },
    { label: 'Inspections', get: (d) => String(d.tiles.inspections) },
    { label: 'Open fails', get: (d) => String(d.suppliers.reduce((s, x) => s + x.fails, 0)) },
  ];
  return (
    <div className="panel kpi-overview">
      <h3>Overview</h3>
      <div className="kpi-compare">
        <div className="kpi-compare-row head">
          <span />
          {TYPES.map((t) => <span key={t.key} style={{ color: t.color }}>{t.label}</span>)}
        </div>
        {rows.map((r) => (
          <div className={`kpi-compare-row${r.big ? ' big' : ''}`} key={r.label}>
            <span className="l">{r.label}</span>
            {TYPES.map((t) => (
              <span className="n" key={t.key} style={r.big ? { color: t.color } : undefined}>{r.get(data[t.key])}</span>
            ))}
          </div>
        ))}
      </div>
      <p className="kpi-note">Inline = checks during production · Final = before shipping. Open fails = failed and not yet passed on a later inspection of the same PO.</p>
    </div>
  );
}

/* 2. Defect rate trend — one orange and one green bar per month */
function Trend({ data }) {
  const t = useTooltip();
  const months = data.final.months.map((m, i) => ({ month: m.month, inline: data.inline.months[i] || m, final: m }));
  const rate = (d) => pct(totalDef(d), d.pcs);
  const max = Math.max(...months.flatMap((m) => TYPES.map((ty) => rate(m[ty.key]))), 0.5);
  return (
    <div className="panel kpi-trend" style={{ position: 'relative' }}>
      <h3>Defect rate by month</h3>
      <div className="kpi-cols">
        {months.map((m) => (
          <div className="kpi-col" key={m.month}>
            <div className="kpi-pair">
              {TYPES.map((ty) => {
                const d = m[ty.key];
                const r = rate(d);
                return (
                  <div className="kpi-bar-wrap" key={ty.key}
                    onMouseEnter={(e) => t.show(e, (
                      <>
                        <strong>{m.month} · {ty.label}</strong> · {fmtN(d.pcs)} pcs · {plural(d.inspections, 'inspection')}<br />
                        Major {fmtPct(d.major_pcs, d.pcs)} · Minor {fmtPct(d.minor_pcs, d.pcs)}
                        {d.other_pcs > 0 && <> · Other {fmtPct(d.other_pcs, d.pcs)}</>}<br />
                        Total {fmtPct(totalDef(d), d.pcs)}
                      </>
                    ))}
                    onMouseLeave={t.hide}>
                    <div className="v" style={{ color: ty.color }}>{d.pcs ? `${r.toFixed(1)}%` : '—'}</div>
                    <div className="bar-area">
                      <div className="seg" style={{ height: d.pcs ? Math.max(Math.round((r / max) * 146), 2) : 0, background: ty.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="m">{m.month}</div>
          </div>
        ))}
      </div>
      <Legend />
      {t.node}
    </div>
  );
}

/* 3. Top defect types — one bar per defect, split inline | final; severity as a badge */
function TopDefects({ defects }) {
  const t = useTooltip();
  const max = Math.max(...defects.map((d) => d.inline_pcs + d.final_pcs), 1);
  return (
    <div className="panel kpi-defects" style={{ position: 'relative' }}>
      <h3>Top defects · pcs found</h3>
      {defects.length === 0 && <p className="muted">No defects logged in the last 3 months.</p>}
      {defects.map((d) => (
        <div className="kpi-row" key={d.key}
          onMouseEnter={(e) => t.show(e, (
            <>
              <strong>{d.name_zh ? `${d.name_zh} ` : ''}{d.name_en}</strong><br />
              Inline {d.inline_pcs} pcs · Final {d.final_pcs} pcs · {d.classification === 'other' ? 'custom issues' : `${d.classification} defect`}
            </>
          ))}
          onMouseLeave={t.hide}>
          <div className="kpi-row-head">
            <span className="t">{d.name_zh ? <span className="zh">{d.name_zh} </span> : null}{d.name_en}</span>
            <span className={`badge ${d.classification === 'other' ? 'muted' : d.classification}`}>{d.classification}</span>
          </div>
          <div className="kpi-hbar">
            <div className="track kpi-split">
              {TYPES.map((ty) => (
                <div key={ty.key} className="fill" style={{ width: `${(d[`${ty.key}_pcs`] / max) * 100}%`, background: ty.color }} />
              ))}
            </div>
            <span className="v">
              <span style={{ color: TYPES[0].color }}>{d.inline_pcs}</span>
              <span className="sep">/</span>
              <span style={{ color: TYPES[1].color }}>{d.final_pcs}</span>
            </span>
          </div>
        </div>
      ))}
      <Legend />
      {t.node}
    </div>
  );
}

/* 4. Supplier scorecard — per supplier an inline and a final bar on a shared scale */
function Suppliers({ data }) {
  const t = useTooltip();
  const byId = {};
  for (const ty of TYPES) {
    for (const s of data[ty.key].suppliers) {
      byId[s.id] = byId[s.id] || { id: s.id, name: s.name, name_zh: s.name_zh };
      byId[s.id][ty.key] = s;
    }
  }
  const pcsOf = (s) => TYPES.reduce((n, ty) => n + (s[ty.key] ? s[ty.key].pcs : 0), 0);
  const list = Object.values(byId).sort((a, b) => pcsOf(b) - pcsOf(a));
  const max = Math.max(...list.flatMap((s) => TYPES.map((ty) => (s[ty.key] ? pct(s[ty.key].defect_pcs, s[ty.key].pcs) : 0))), 0.5);
  return (
    <div className="panel kpi-suppliers" style={{ position: 'relative' }}>
      <h3>Suppliers · defect % of inspected</h3>
      {list.length === 0 && <p className="muted">No inspections in the last 3 months.</p>}
      {list.map((s) => (
        <div className="kpi-row" key={s.id}>
          <div className="kpi-row-head"><span className="t">{s.name}</span></div>
          {TYPES.map((ty) => {
            const d = s[ty.key];
            return (
              <div className="kpi-typed" key={ty.key}
                onMouseEnter={(e) => d && t.show(e, (
                  <>
                    <strong>{s.name} · {ty.label}</strong><br />
                    {fmtN(d.pcs)} pcs inspected · {fmtN(d.defect_pcs)} defect pcs ({fmtPct(d.defect_pcs, d.pcs)})<br />
                    {plural(d.inspections, 'inspection')} · {plural(d.fails, 'open fail')}
                  </>
                ))}
                onMouseLeave={t.hide}>
                <span className="k" style={{ color: ty.color }}>{ty.label}</span>
                <div className="track">
                  <div className="fill" style={{ width: d ? `${Math.max((pct(d.defect_pcs, d.pcs) / max) * 100, 1)}%` : 0, background: ty.color }} />
                </div>
                <span className="v">{d ? fmtPct(d.defect_pcs, d.pcs) : '—'}</span>
                <span className="s">{d ? `${fmtN(d.pcs)} pcs · ${d.inspections} insp. · ${plural(d.fails, 'open fail')}` : `no ${ty.label.toLowerCase()} inspections in the last 3 months`}</span>
              </div>
            );
          })}
        </div>
      ))}
      {t.node}
    </div>
  );
}

export default function DashboardKpis() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get('/kpis').then(setData).catch(() => {}); }, []);
  if (!data || !data.inline || !data.final) return null;
  return (
    <>
      <h2>Last 3 months</h2>
      <div className="kpi-grid">
        <Overview data={data} />
        <Trend data={data} />
        <TopDefects defects={data.top_defects || []} />
        <Suppliers data={data} />
      </div>
    </>
  );
}
