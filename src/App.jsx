import { useState } from 'react';
import { FileSearch, ChevronRight, ExternalLink, X } from 'lucide-react';
import Dashboard from './Dashboard.jsx';

const COMPANIES = [
  { id: 'amazon', name: 'Amazon', ticker: 'AMZN', logo: 'A', color: '#f59e0b', fy: 'FY2024 · Dec 31, 2024', url: 'https://www.sec.gov/Archives/edgar/data/0001018724/000101872425000004/amzn-20241231.htm' },
  { id: 'google', name: 'Alphabet / Google', ticker: 'GOOGL', logo: 'G', color: '#4285f4', fy: 'FY2024 · Dec 31, 2024', url: 'https://www.sec.gov/Archives/edgar/data/0001652044/000165204425000014/goog-20241231.htm' },
  { id: 'meta', name: 'Meta Platforms', ticker: 'META', logo: 'M', color: '#0866ff', fy: 'FY2024 · Dec 31, 2024', url: 'https://www.sec.gov/Archives/edgar/data/0001326801/000132680125000017/meta-20241231.htm' },
];

const STEPS = [
  'Fetching 10-K from SEC EDGAR…',
  'Parsing business overview and product sections…',
  'Extracting segment revenues and KPIs…',
  'Building investment priority matrix…',
  'Analyzing competitive threats…',
  'Synthesizing PM action framework…',
  'Finalizing dashboard…',
];

export default function App() {
  const [selected, setSelected] = useState(null);
  const [customUrl, setCustomUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [dashboard, setDashboard] = useState(null);
  const [analyzedCompany, setAnalyzedCompany] = useState(null);
  const [error, setError] = useState(null);

  const activeUrl = customUrl.trim() || selected?.url || '';
  const companyName = customUrl.trim() ? 'the company' : selected?.name || 'the company';

  const selectCompany = (c) => {
    setSelected(c);
    setCustomUrl('');
    setDashboard(null);
    setError(null);
  };

  const clearCustomUrl = () => {
    setCustomUrl('');
    setError(null);
  };

  const analyze = async () => {
    if (!activeUrl) return;
    setLoading(true);
    setError(null);
    setDashboard(null);
    setStep(0);

    const interval = setInterval(() => setStep(s => Math.min(s + 1, STEPS.length - 1)), 2500);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'x-api-key': apiKey } : {}),
        },
        body: JSON.stringify({ url: activeUrl, companyName }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Server error ${res.status}`);

      setDashboard(json.data);
      setAnalyzedCompany(customUrl.trim()
        ? { name: json.data?.snapshot?.company || 'Custom', logo: '?', color: '#a78bfa' }
        : selected
      );
    } catch (err) {
      setError(err.message || 'Analysis failed. Check server is running and API key is set.');
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  };

  const canAnalyze = activeUrl && !loading;

  return (
    <div className="app">
      {/* Header */}
      <div className="header">
        <div className="header-logo">
          <FileSearch size={17} color="white" />
        </div>
        <div>
          <div className="header-title">10-K PM strategy analyzer</div>
          <div className="header-sub">Extract product KPIs, investment signals, and PM priorities from annual reports</div>
        </div>
      </div>

      {/* Company selector */}
      <div className="company-grid">
        {COMPANIES.map(c => (
          <button key={c.id} className={`company-btn ${selected?.id === c.id && !customUrl ? 'active' : ''}`} onClick={() => selectCompany(c)}>
            <div className="c-logo" style={{ background: c.color }}>{c.logo}</div>
            <div className="c-name">{c.name}</div>
            <div className="c-ticker">{c.ticker}</div>
            <div className="c-fy">{c.fy}</div>
          </button>
        ))}
      </div>

      {/* URL section */}
      <div className="url-section">
        <div className="url-section-label">10-K source</div>

        {/* Show preset URL if a company is selected and no custom URL */}
        {selected && !customUrl && (
          <div className="url-preset">
            <span className="url-preset-label">SEC filing</span>
            <span className="url-preset-val">{selected.url}</span>
            <a href={selected.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text3)', flexShrink: 0 }}>
              <ExternalLink size={12} />
            </a>
          </div>
        )}

        <div className="url-divider">
          <div className="url-divider-line" />
          <span className="url-divider-text">or paste any 10-K URL</span>
          <div className="url-divider-line" />
        </div>

        <div className="url-input-wrap">
          <input
            className="url-input"
            type="url"
            placeholder="https://www.sec.gov/Archives/edgar/data/…/filing.htm"
            value={customUrl}
            onChange={e => { setCustomUrl(e.target.value); setSelected(null); setDashboard(null); setError(null); }}
          />
          {customUrl && (
            <button className="url-clear" onClick={clearCustomUrl}>
              <X size={13} style={{ display: 'inline' }} /> Clear
            </button>
          )}
        </div>
        {customUrl && (
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
            Custom URL — any SEC 10-K HTML filing link works
          </div>
        )}
      </div>

      {/* API key */}
      <div className="apikey-section">
        <span className="apikey-label">Anthropic API key</span>
        <input
          className="apikey-input"
          type="password"
          placeholder="sk-ant-…"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
        />
      </div>
      <div className="apikey-hint" style={{ fontSize: 11, color: 'var(--text3)', marginTop: -6, marginBottom: 12, paddingLeft: 2 }}>
        Your key is sent only to your local server and never stored. Get one at console.anthropic.com
      </div>

      {/* Analyze button */}
      <button className="analyze-btn" onClick={analyze} disabled={!canAnalyze}>
        {loading ? (
          <>
            <div style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin .75s linear infinite' }} />
            Analyzing…
          </>
        ) : (
          <>
            <ChevronRight size={15} />
            {activeUrl
              ? `Analyze ${customUrl ? 'custom 10-K' : selected?.name + ' 10-K'}`
              : 'Select a company or paste a URL'}
          </>
        )}
      </button>

      {/* Loading */}
      {loading && (
        <div className="loading">
          <div className="spinner" />
          <div className="loading-title">Reading the annual report…</div>
          <div className="loading-step">{STEPS[step]}</div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="error-box">
          <strong>Analysis failed:</strong> {error}
        </div>
      )}

      {/* Dashboard */}
      {dashboard && !loading && (
        <Dashboard data={dashboard} company={analyzedCompany} />
      )}

      {/* Empty states */}
      {!activeUrl && !loading && !dashboard && (
        <div className="empty">
          <div className="empty-icon">📊</div>
          <div className="empty-title">Choose a company or paste a 10-K URL</div>
          <div className="empty-sub">Select Amazon, Google, or Meta above, or paste any SEC EDGAR 10-K link</div>
        </div>
      )}

      {activeUrl && !loading && !dashboard && !error && (
        <div className="empty">
          <div className="empty-icon">🔍</div>
          <div className="empty-title">Ready to analyze</div>
          <div className="empty-sub">Click the button above to fetch and analyze the 10-K</div>
        </div>
      )}
    </div>
  );
}
