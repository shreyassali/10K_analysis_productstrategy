import { useState, useRef } from 'react';
import { FileSearch, ChevronRight, ExternalLink, X, Upload, FileText } from 'lucide-react';
import Dashboard from './Dashboard.jsx';
import { extractTextFromPDF } from './pdfExtract.js';

const COMPANIES = [
  { id: 'amazon', name: 'Amazon', ticker: 'AMZN', logo: 'A', color: '#f59e0b', fy: 'FY2024', pdfUrl: 'https://s2.q4cdn.com/299287126/files/doc_financials/2024/ar/amzn-20241231.pdf' },
  { id: 'google', name: 'Alphabet / Google', ticker: 'GOOGL', logo: 'G', color: '#4285f4', fy: 'FY2024', pdfUrl: 'https://abc.xyz/assets/c4/f5/b5b5e5534c30a35ea5ce7c03c3b0/2024-annual-report.pdf' },
  { id: 'meta', name: 'Meta Platforms', ticker: 'META', logo: 'M', color: '#0866ff', fy: 'FY2024', pdfUrl: 'https://s21.q4cdn.com/399680738/files/doc_financials/2024/ar/meta-20241231.pdf' },
];

const STEPS = [
  'Extracting text from PDF…',
  'Sending to Claude for analysis…',
  'Extracting segment revenues and KPIs…',
  'Building investment priority matrix…',
  'Analyzing competitive threats…',
  'Synthesizing PM action framework…',
  'Finalizing dashboard…',
];

const SYSTEM_PROMPT = `You are a senior product strategy analyst. Analyze a 10-K annual report and return ONLY a valid JSON object, no markdown, no explanation:

{
  "snapshot": {"company":"string","filing":"Form 10-K","fy":"string","model":"string","modelPill":"p-blue"},
  "financials": {"metrics":[{"label":"string","value":"string","delta":"string"}]},
  "momentum": {"segments":[{"name":"string","revenue":"string","growth":"string","margin":"string","pct":30,"color":"#185FA5"}]},
  "products": {"groups":[{"name":"string","color":"#1D9E75","items":[{"name":"string","tags":["platform"],"desc":"string","kpis":[{"name":"string","value":"string","source":"string"}]}]}]},
  "matrix": {"quadrants":[{"label":"Double down — high growth + core fit","items":["string"]},{"label":"Grow carefully — high growth, watch margin","items":["string"]},{"label":"Defend & optimize — core but maturing","items":["string"]},{"label":"Reassess — declining or low strategic fit","items":["string"]}]},
  "threats": {"items":[{"level":"High","title":"string","text":"string"}]},
  "bets": {"items":[{"signal":"Explicit","title":"string","text":"string","watch":"string"}]},
  "actions": {"columns":[{"title":"Top 3 product priorities","items":["string","string","string"]},{"title":"Top 3 metrics to instrument","items":["string","string","string"]},{"title":"Top 3 risks to roadmap","items":["string","string","string"]}]}
}

Rules: use real numbers only, never invent figures, include 6 metrics, 3-5 segments, 3-4 product groups with 2-4 products each, all 4 quadrants populated, 4-5 threats, 4-5 bets.`;

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function App() {
  const [selected, setSelected] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [dashboard, setDashboard] = useState(null);
  const [analyzedCompany, setAnalyzedCompany] = useState(null);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const companyName = selected?.name || pdfFile?.name?.replace(/\.pdf$/i, '') || 'the company';
  const canAnalyze = pdfFile && apiKey && !loading;

  const selectCompany = (c) => { setSelected(c); setDashboard(null); setError(null); };

  const handleFile = (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') { setError('Please upload a PDF file.'); return; }
    if (file.size > 50 * 1024 * 1024) { setError('PDF too large (max 50 MB).'); return; }
    setPdfFile(file);
    setDashboard(null);
    setError(null);
  };

  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); };
  const clearPdf = () => { setPdfFile(null); setDashboard(null); setError(null); if (fileInputRef.current) fileInputRef.current.value = ''; };

  const analyze = async () => {
    if (!pdfFile || !apiKey) return;
    setLoading(true);
    setError(null);
    setDashboard(null);
    setStep(0);

    const interval = setInterval(() => setStep(s => Math.min(s + 1, STEPS.length - 1)), 4000);

    try {
      // Step 1: Extract text from PDF in the browser
      let pdfText;
      try {
        pdfText = await extractTextFromPDF(pdfFile);
      } catch (e) {
        throw new Error(`Could not read PDF: ${e.message}`);
      }

      if (!pdfText || pdfText.trim().length < 500) {
        throw new Error('PDF appears empty or image-only (scanned). Use a text-based PDF from SEC EDGAR.');
      }

      setStep(1);

      // Step 2: Call Anthropic API directly from browser
      // No Netlify function needed — user's key, no server timeout limits
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-allow-browser': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 3000,
          system: SYSTEM_PROMPT,
          messages: [{
            role: 'user',
            content: `Analyze this 10-K for ${companyName} and return the JSON dashboard.\n\n${pdfText.slice(0, 20000)}`,
          }],
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Anthropic API error ${res.status}`);
      }

      const data = await res.json();
      const raw = data.content?.filter(b => b.type === 'text')?.map(b => b.text)?.join('') || '';
      const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const start = clean.indexOf('{');
      const end = clean.lastIndexOf('}');
      if (start === -1) throw new Error('No valid JSON in response');

      const parsed = JSON.parse(clean.slice(start, end + 1));
      setDashboard(parsed);
      setAnalyzedCompany(selected || { name: companyName, logo: companyName[0]?.toUpperCase() || '?', color: '#534AB7' });

    } catch (err) {
      setError(err.message || 'Analysis failed.');
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <div className="header">
        <div className="header-logo"><FileSearch size={17} color="white" /></div>
        <div>
          <div className="header-title">10-K PM strategy analyzer</div>
          <div className="header-sub">Upload a 10-K PDF to extract product KPIs, investment signals, and PM priorities</div>
        </div>
      </div>

      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
        Quick select — get PDF download link
      </div>
      <div className="company-grid" style={{ marginBottom: 8 }}>
        {COMPANIES.map(c => (
          <button key={c.id} className={`company-btn ${selected?.id === c.id ? 'active' : ''}`} onClick={() => selectCompany(c)}>
            <div className="c-logo" style={{ background: c.color }}>{c.logo}</div>
            <div className="c-name">{c.name}</div>
            <div className="c-ticker">{c.ticker}</div>
            <div className="c-fy">{c.fy} · Dec 31, 2024</div>
          </button>
        ))}
      </div>

      {selected && (
        <div style={{ background: 'var(--green-bg)', border: '0.5px solid var(--green-border)', borderRadius: 'var(--rs)', padding: '9px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileText size={14} style={{ color: 'var(--green)', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--green)', flex: 1 }}>Step 1 — download the {selected.name} FY2024 10-K PDF, then upload it below</span>
          <a href={selected.pdfUrl} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 12, fontWeight: 600, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
            Download PDF <ExternalLink size={11} />
          </a>
        </div>
      )}

      {/* Upload zone */}
      <div
        style={{
          background: dragOver ? 'var(--blue-bg)' : 'var(--bg2)',
          border: `${dragOver ? '2px' : '1.5px'} dashed ${dragOver ? 'var(--blue)' : pdfFile ? 'var(--green-border)' : 'var(--border2)'}`,
          borderRadius: 'var(--r)', padding: pdfFile ? '14px 16px' : '28px 16px',
          marginBottom: 12, textAlign: 'center',
          cursor: pdfFile ? 'default' : 'pointer', transition: 'all .15s',
        }}
        onClick={() => !pdfFile && fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <input ref={fileInputRef} type="file" accept=".pdf,application/pdf"
          style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />

        {pdfFile ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <FileText size={18} style={{ color: 'var(--green)' }} />
            </div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{pdfFile.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{formatBytes(pdfFile.size)} · text extracted in browser</div>
            </div>
            <button onClick={e => { e.stopPropagation(); clearPdf(); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4 }}>
              <X size={15} />
            </button>
          </div>
        ) : (
          <>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
              <Upload size={18} style={{ color: 'var(--text2)' }} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>
              {selected ? `Step 2 — upload the ${selected.name} PDF` : 'Upload your 10-K PDF'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>
              Drag and drop or <span style={{ color: 'var(--blue)', fontWeight: 500 }}>click to browse</span> · any size PDF
            </div>
          </>
        )}
      </div>

      {/* API key */}
      <div className="apikey-section">
        <span className="apikey-label">Anthropic API key</span>
        <input className="apikey-input" type="password" placeholder="sk-ant-…"
          value={apiKey} onChange={e => setApiKey(e.target.value)} />
      </div>
      <div className="apikey-hint" style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 14, paddingLeft: 2 }}>
        Your key goes directly to Anthropic — never stored or logged. Get one at console.anthropic.com
      </div>

      <button className="analyze-btn" onClick={analyze} disabled={!canAnalyze}>
        {loading ? (
          <>
            <div style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin .75s linear infinite' }} />
            {STEPS[step]}
          </>
        ) : (
          <>
            <ChevronRight size={15} />
            {!pdfFile ? 'Upload a PDF to get started' : !apiKey ? 'Enter your API key above' : `Analyze ${companyName} 10-K`}
          </>
        )}
      </button>

      {loading && (
        <div className="loading">
          <div className="spinner" />
          <div className="loading-title">Working through the annual report…</div>
          <div className="loading-step">{STEPS[step]}</div>
        </div>
      )}

      {error && <div className="error-box"><strong>Analysis failed:</strong> {error}</div>}
      {dashboard && !loading && <Dashboard data={dashboard} company={analyzedCompany} />}

      {!pdfFile && !loading && !dashboard && (
        <div className="empty">
          <div className="empty-icon">📄</div>
          <div className="empty-title">Upload a 10-K PDF to get started</div>
          <div className="empty-sub">Select a company above to get the PDF link, or drag in any 10-K PDF</div>
        </div>
      )}
    </div>
  );
}
