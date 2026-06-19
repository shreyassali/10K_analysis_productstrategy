import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `You are a senior product strategy analyst. Analyze a 10-K annual report and return ONLY a valid JSON object (no markdown, no explanation, no code fences) with this exact structure:

{
  "snapshot": {
    "company": "Company name",
    "filing": "Form 10-K",
    "fy": "Fiscal year ended [date]",
    "model": "Business model type",
    "modelPill": "p-purple"
  },
  "financials": {
    "metrics": [
      { "label": "Total revenue", "value": "$XXB", "delta": "↑ X% YoY" },
      { "label": "Fastest-growing segment", "value": "$XXB", "delta": "↑ X% YoY" },
      { "label": "Gross margin", "value": "XX%", "delta": "↑ from XX%" },
      { "label": "R&D spend", "value": "$XXB", "delta": "X% of revenue" },
      { "label": "Operating margin", "value": "XX%", "delta": "↑ from XX%" },
      { "label": "Free cash flow", "value": "$XXB", "delta": "capex $XXB" }
    ]
  },
  "momentum": {
    "segments": [
      { "name": "Segment name", "revenue": "$XXB", "growth": "↑ +X%", "margin": "~XX% margin", "pct": 45, "color": "#4f8ef7" }
    ]
  },
  "products": {
    "groups": [
      {
        "name": "Group name",
        "color": "#2dd4a0",
        "items": [
          {
            "name": "Product name",
            "tags": ["platform"],
            "desc": "One sentence description of what it does and why it matters strategically.",
            "kpis": [
              { "name": "Revenue", "value": "$XXB", "source": "10-K" },
              { "name": "YoY growth", "value": "+X%", "source": "10-K" },
              { "name": "Key metric", "value": "not disclosed", "source": "track via earnings call" }
            ]
          }
        ]
      }
    ]
  },
  "matrix": {
    "quadrants": [
      { "label": "Double down — high growth + core fit", "items": ["Product A", "Product B"] },
      { "label": "Grow carefully — high growth, watch margin", "items": ["Product C"] },
      { "label": "Defend & optimize — core but maturing", "items": ["Product D"] },
      { "label": "Reassess — declining or low strategic fit", "items": ["Product E"] }
    ]
  },
  "threats": {
    "items": [
      { "level": "High", "title": "Threat title", "text": "Threat description with PM implication for roadmap." },
      { "level": "Medium", "title": "Threat title", "text": "..." },
      { "level": "Watch", "title": "Threat title", "text": "..." }
    ]
  },
  "bets": {
    "items": [
      { "signal": "Explicit", "title": "Bet name", "text": "What the bet is with specific filing data.", "watch": "KPI to track" },
      { "signal": "Implied", "title": "Bet name", "text": "...", "watch": "..." },
      { "signal": "Speculative", "title": "Bet name", "text": "...", "watch": "..." }
    ]
  },
  "actions": {
    "columns": [
      { "title": "Top 3 product priorities", "items": ["Priority 1", "Priority 2", "Priority 3"] },
      { "title": "Top 3 metrics to instrument", "items": ["Metric 1 — why it matters", "Metric 2", "Metric 3"] },
      { "title": "Top 3 risks to roadmap", "items": ["Risk 1 and what to do", "Risk 2", "Risk 3"] }
    ]
  }
}

Rules:
- Return ONLY the JSON object. No markdown fences, no preamble, no trailing text.
- Use actual numbers from the filing. Never invent figures.
- When a KPI is not disclosed: value = "not disclosed", source = "track via earnings call"
- pct in momentum = estimated % of total revenue as integer 0-100
- modelPill: one of p-blue p-teal p-purple p-amber
- Segment colors: #4f8ef7 (blue) #2dd4a0 (teal) #a78bfa (purple) #f59e0b (amber) #f87171 (red) #4ade80 (green)
- Include 6 financial metrics, 3-6 segments, 3-5 product groups (2-5 products each), all 4 matrix quadrants populated, 4-5 threats, 4-5 bets, 3 action columns with 3 items each`;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

async function fetch10K(url) {
  // Use native fetch (Node 18+ built-in — no node-fetch needed)
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });
    clearTimeout(timer);

    if (!res.ok) throw new Error(`SEC EDGAR returned HTTP ${res.status}`);
    const html = await res.text();

    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#\d+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 18000);
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error('Timed out fetching 10-K from SEC EDGAR (>20s)');
    throw e;
  }
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { url, companyName } = body;
  if (!url) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'url is required' }) };
  }

  const apiKey = event.headers['x-api-key'] || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 401, headers: CORS,
      body: JSON.stringify({ error: 'Anthropic API key required — enter it in the UI field' }),
    };
  }

  // Step 1: Fetch 10-K
  let content;
  try {
    content = await fetch10K(url);
  } catch (e) {
    return {
      statusCode: 502, headers: CORS,
      body: JSON.stringify({ error: `Failed to fetch 10-K: ${e.message}` }),
    };
  }

  if (!content || content.length < 500) {
    return {
      statusCode: 502, headers: CORS,
      body: JSON.stringify({ error: 'Fetched 10-K content was too short — the URL may not point to a valid filing' }),
    };
  }

  // Step 2: Analyze with Claude
  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Analyze this 10-K filing for ${companyName || 'the company'} and return the PM strategy dashboard JSON.\n\n10-K content:\n---\n${content}\n---\n\nReturn only the JSON object.`,
      }],
    });

    const rawText = message.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const clean = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start === -1) throw new Error('Claude did not return valid JSON');

    const parsed = JSON.parse(clean.slice(start, end + 1));
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ data: parsed }) };

  } catch (e) {
    return {
      statusCode: 500, headers: CORS,
      body: JSON.stringify({ error: `Analysis failed: ${e.message}` }),
    };
  }
};
