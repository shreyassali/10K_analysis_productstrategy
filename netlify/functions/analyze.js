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
      { "name": "Segment name", "revenue": "$XXB", "growth": "↑ +X%", "margin": "~XX% margin", "pct": 45, "color": "#185FA5" }
    ]
  },
  "products": {
    "groups": [
      {
        "name": "Group name",
        "color": "#1D9E75",
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
      { "level": "High", "title": "Threat title", "text": "Threat description with PM implication." },
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
- Segment colors: #185FA5 (blue) #1D9E75 (teal) #534AB7 (purple) #BA7517 (amber) #A32D2D (red) #3B6D11 (green)
- Include 6 financial metrics, 3-6 segments, 3-5 product groups (2-5 products each), all 4 matrix quadrants populated, 4-5 threats, 4-5 bets, 3 action columns with 3 items each`;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { pdfText, companyName } = body;
  if (!pdfText) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'pdfText is required' }) };
  }

  const apiKey = event.headers['x-api-key'] || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Anthropic API key required' }) };
  }

  try {
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Analyze this 10-K annual report text for ${companyName || 'the company'} and return the PM strategy dashboard JSON. Use real numbers from the document.\n\n10-K text:\n---\n${pdfText}\n---\n\nReturn only the JSON object.`,
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
    console.error('Error:', e);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: e.message || 'Analysis failed' }) };
  }
};
