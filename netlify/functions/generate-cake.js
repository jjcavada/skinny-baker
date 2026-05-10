// Netlify Function: generate-cake
// Uses Pollinations.ai (free, FLUX model) for image generation.
// Optional: if GEMINI_API_KEY is set AND the user has billing enabled, fall back to Gemini.
// Pollinations does NOT support arbitrary reference images — that requires a paid model.

const POLLINATIONS_BASE = 'https://image.pollinations.ai/prompt';
const GEMINI_MODEL = 'gemini-2.5-flash-image';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let prompt;
  let referenceImage = null;
  try {
    const body = JSON.parse(event.body || '{}');
    prompt = (body.prompt || '').toString().trim();
    if (body.referenceImage && body.referenceImage.data && body.referenceImage.mimeType) {
      referenceImage = body.referenceImage;
    }
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  if (!prompt || prompt.length < 5) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Prompt is too short.' }) };
  }
  if (prompt.length > 2000) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Prompt is too long.' }) };
  }

  // If a reference image is attached AND Gemini key is set, try Gemini first (multimodal)
  // Otherwise use Pollinations (text-only, free).
  const hasGeminiKey = !!process.env.GEMINI_API_KEY;
  const useGemini = hasGeminiKey && referenceImage;

  try {
    const dataUrl = useGemini
      ? await callGemini(prompt, referenceImage)
      : await callPollinations(prompt);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ images: [dataUrl] })
    };
  } catch (err) {
    console.error('[generate-cake]', err);
    // If Gemini fails, fall back to Pollinations text-only
    if (useGemini) {
      try {
        const dataUrl = await callPollinations(prompt);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            images: [dataUrl],
            warning: 'Reference image was ignored (Gemini quota exceeded).'
          })
        };
      } catch (fallbackErr) {
        return {
          statusCode: 502,
          headers,
          body: JSON.stringify({ error: fallbackErr.message || 'Image generation failed.' })
        };
      }
    }
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: err.message || 'Image generation failed. Please try again.' })
    };
  }
};

async function callPollinations(prompt) {
  const seed = Math.floor(Math.random() * 1_000_000);
  // Use 'turbo' (SDXL-Turbo): much faster than flux, still good for product renders.
  // Identifying referrer reduces rate limiting.
  const params = new URLSearchParams({
    width: '768',
    height: '960',
    model: 'turbo',
    seed: String(seed),
    referrer: 'skinny-baker.netlify.app',
    enhance: 'true'
  });
  const url = `${POLLINATIONS_BASE}/${encodeURIComponent(prompt)}?${params.toString()}`;

  // Abort cleanly before Netlify timeout hits
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 24_000);

  let res;
  try {
    res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'Referer': 'https://skinny-baker.netlify.app' }
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Image generation took too long. Please try again.');
    }
    throw err;
  }
  clearTimeout(timeoutId);

  if (res.status === 429) {
    throw new Error('Image service is busy right now. Wait a few seconds and try again.');
  }
  if (!res.ok) {
    throw new Error(`Image service error (${res.status}). Try again.`);
  }

  const ct = res.headers.get('content-type') || '';
  if (!ct.startsWith('image/')) {
    throw new Error('Image service returned an unexpected response.');
  }

  const arrayBuffer = await res.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  return `data:${ct};base64,${base64}`;
}

async function callGemini(prompt, referenceImage) {
  const parts = [];
  if (referenceImage) {
    parts.push({
      inlineData: {
        mimeType: referenceImage.mimeType,
        data: referenceImage.data
      }
    });
  }
  parts.push({ text: prompt });

  const res = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': process.env.GEMINI_API_KEY
    },
    body: JSON.stringify({ contents: [{ parts }] })
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
  const responseParts = data?.candidates?.[0]?.content?.parts || [];
  const imgPart = responseParts.find((p) => p.inlineData && p.inlineData.data);
  if (!imgPart) {
    throw new Error('Gemini returned no image.');
  }
  const mime = imgPart.inlineData.mimeType || 'image/png';
  return `data:${mime};base64,${imgPart.inlineData.data}`;
}
