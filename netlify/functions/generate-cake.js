// Netlify Function: generate-cake
// Calls Google Gemini 2.5 Flash Image ("nano banana") to generate cake designs.
// Requires env var: GEMINI_API_KEY

const MODEL = 'gemini-2.5-flash-image';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server is missing GEMINI_API_KEY env var.' })
    };
  }

  let prompt;
  let variations = 1;
  try {
    const body = JSON.parse(event.body || '{}');
    prompt = (body.prompt || '').toString().trim();
    variations = Math.max(1, Math.min(3, parseInt(body.variations, 10) || 1));
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  if (!prompt || prompt.length < 5) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Prompt is too short.' }) };
  }
  if (prompt.length > 2000) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Prompt is too long.' }) };
  }

  try {
    // Run N requests in parallel for variations
    const requests = Array.from({ length: variations }, (_, i) =>
      callGemini(apiKey, addVariationSeed(prompt, i))
    );
    const settled = await Promise.allSettled(requests);

    const images = [];
    const errors = [];
    settled.forEach((r) => {
      if (r.status === 'fulfilled' && r.value) images.push(r.value);
      else if (r.status === 'rejected') errors.push(r.reason?.message || 'Unknown error');
    });

    if (!images.length) {
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({
          error: errors[0] || 'Image generation failed. Please try again.'
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ images })
    };
  } catch (err) {
    console.error('[generate-cake]', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || 'Internal error' })
    };
  }
};

function addVariationSeed(prompt, idx) {
  const seeds = [
    '',
    'Show a slightly different angle and lighting. Variation B.',
    'Different angle, alternate decoration arrangement. Variation C.'
  ];
  return seeds[idx] ? `${prompt} ${seeds[idx]}` : prompt;
}

async function callGemini(apiKey, prompt) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    let errMsg = `Gemini error ${res.status}`;
    try {
      const parsed = JSON.parse(errText);
      errMsg = parsed?.error?.message || errMsg;
    } catch { /* keep default */ }
    throw new Error(errMsg);
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const imgPart = parts.find((p) => p.inlineData && p.inlineData.data);
  if (!imgPart) {
    const textPart = parts.find((p) => p.text);
    throw new Error(textPart?.text || 'Gemini returned no image.');
  }
  const mime = imgPart.inlineData.mimeType || 'image/png';
  return `data:${mime};base64,${imgPart.inlineData.data}`;
}
