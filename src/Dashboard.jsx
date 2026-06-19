const pillClass = (type) => {
  const map = { hardware:'p-blue', subscription:'p-teal', platform:'p-purple', financial:'p-amber', advertising:'p-gray', cloud:'p-teal', enterprise:'p-purple', emerging:'p-amber', support:'p-amber', other:'p-gray' };
  return 'pill ' + (map[String(type).toLowerCase()] || 'p-gray');
};

const threatPill = (l) => ({ High:'p-red', Medium:'p-amber', Watch:'p-blue', Low:'p-gray' }[l] || 'p-gray');
const betPill = (s) => ({ Explicit:'p-green', Implied:'p-amber', Speculative:'p-purple' }[s] || 'p-gray');

const quadBorder = (label='') => {
  const l = label.toLowerCase();
  if (l.includes('double')) return { borderColor:'rgba(74,222,128,.4)', labelColor:'#4ade80' };
  if (l.includes('grow')) return { borderColor:'rgba(167,139,250,.4)', labelColor:'#a78bfa' };
  if (l.includes('defend')) return { borderColor:'rgba(79,142,247,.4)', labelColor:'#4f8ef7' };
  if (l.includes('reassess')) return { borderColor:'rgba(248,113,113,.4)', labelColor:'#f87171' };
  return { borderColor:'var(--border)', labelColor:'var(--text2)' };
};

const deltaClass = (d='') => {
  if (d.includes('↑') || d.includes('+')) return 'up';
  if (d.includes('↓') || (d.includes('-') && !d.startsWith('-$'))) return 'dn';
  return 'fl';
};

const colColors = ['#2dd4a0','#a78bfa','#f87171'];

function SecHead({ num, title }) {
  return (
    <div className="sec-head">
      <div className="sec-num">{num}</div>
      <span className="sec-title">{title}</span>
    </div>
  );
}

export default function Dashboard({ data, company }) {
  if (!data) return null;
  const { snapshot, financials, momentum, products, matrix, threats, bets, actions } = data;

  return (
    <div>
      {/* Company banner */}
      <div className="dash-head">
        <div className="dash-co-logo" style={{ background: company?.color || '#4f8ef7' }}>
          {company?.logo || snapshot?.company?.[0] || '?'}
        </div>
        <div style={{ flex: 1 }}>
          <div className="dash-co-name">{snapshot?.company || company?.name} · PM strategy dashboard</div>
          <div className="dash-co-sub">{snapshot?.filing} · {snapshot?.fy} · {snapshot?.model}</div>
        </div>
        <span className={`pill ${snapshot?.modelPill || 'p-blue'}`}>{snapshot?.model}</span>
      </div>

      {/* 1 Financial scorecard */}
      <div className="section">
        <SecHead num="1" title="Financial health scorecard" />
        <div className="metric-grid">
          {(financials?.metrics || []).map((m, i) => (
            <div className="metric-card" key={i}>
              <div className="m-label">{m.label}</div>
              <div className="m-val">{m.value}</div>
              {m.delta && <div className={`m-delta ${deltaClass(m.delta)}`}>{m.delta}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* 2 Revenue momentum */}
      <div className="section">
        <SecHead num="2" title="Revenue momentum map" />
        <div className="card" style={{ paddingBottom: 6 }}>
          {(momentum?.segments || []).map((s, i) => (
            <div className="bar-row" key={i}>
              <div className="bar-top">
                <span className="bar-name">{s.name}</span>
                <div className="bar-right">
                  <span className={deltaClass(s.growth)}>{s.growth}</span>
                  <span>{s.revenue}</span>
                  {s.margin && <span className="pill p-blue" style={{ fontSize: 10 }}>{s.margin}</span>}
                </div>
              </div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${Math.min(s.pct || 20, 100)}%`, background: s.color || '#4f8ef7' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3 Product catalog */}
      <div className="section">
        <SecHead num="3" title="Per-product catalog with PM KPIs" />
        {(products?.groups || []).map((group, gi) => (
          <div key={gi}>
            <div className="seg-head">
              <div className="seg-dot" style={{ background: group.color || '#4f8ef7' }} />
              {group.name}
            </div>
            {(group.items || []).map((prod, pi) => (
              <div className="card" key={pi}>
                <div className="card-header">
                  <span className="card-name">{prod.name}</span>
                  {(prod.tags || []).map((t, ti) => <span key={ti} className={pillClass(t)}>{t}</span>)}
                </div>
                {prod.desc && <div className="card-desc">{prod.desc}</div>}
                <div className="kpi-row">
                  {(prod.kpis || []).map((k, ki) => (
                    <div className="kpi-chip" key={ki}>
                      <div className="kpi-n">{k.name}</div>
                      <div className="kpi-v" style={{ color: k.value === 'not disclosed' ? 'var(--text3)' : 'var(--text)' }}>{k.value}</div>
                      {k.source && <div className="kpi-s">{k.source}</div>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* 4 Priority matrix */}
      <div className="section">
        <SecHead num="4" title="Investment priority matrix" />
        <div className="matrix-grid">
          {(matrix?.quadrants || []).map((q, i) => {
            const { borderColor, labelColor } = quadBorder(q.label);
            return (
              <div className="matrix-quad" key={i} style={{ borderColor }}>
                <div className="matrix-label" style={{ color: labelColor }}>{q.label}</div>
                <div className="matrix-tags">
                  {(q.items || []).map((item, ii) => <span className="matrix-tag" key={ii}>{item}</span>)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5 Threats */}
      <div className="section">
        <SecHead num="5" title="Competitive threat radar" />
        {(threats?.items || []).map((t, i) => (
          <div className="card threat-card" key={i}>
            <span className={`pill ${threatPill(t.level)}`} style={{ marginTop: 2, flexShrink: 0 }}>{t.level}</span>
            <div className="threat-body">
              <div className="threat-title">{t.title}</div>
              <div className="threat-text">{t.text}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 6 Strategic bets */}
      <div className="section">
        <SecHead num="6" title="Strategic bets & whitespace" />
        {(bets?.items || []).map((b, i) => (
          <div className="card" key={i}>
            <div className="bet-top">
              <span className="bet-title">{b.title}</span>
              <span className={`pill ${betPill(b.signal)}`} style={{ flexShrink: 0 }}>{b.signal}</span>
            </div>
            <div className="bet-text">{b.text}</div>
            {b.watch && <div className="bet-watch">Watch: {b.watch}</div>}
          </div>
        ))}
      </div>

      {/* 7 PM actions */}
      <div className="section">
        <SecHead num="7" title="PM action framework" />
        <div className="action-grid">
          {(actions?.columns || []).map((col, i) => (
            <div className="action-col" key={i}>
              <div className="action-col-title" style={{ color: colColors[i] || 'var(--text2)' }}>{col.title}</div>
              {(col.items || []).map((item, ii) => (
                <div className="action-item" key={ii}>
                  <span className="action-num">{ii + 1}</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
