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
  let referenceImage = null;
  try {
    const body = JSON.parse(event.body || '{}');
    prompt = (body.prompt || '').toString().trim();
    if (body.referenceImage && body.referenceImage.data && body.referenceImage.mimeType) {
      referenceImage = {
        mimeType: body.referenceImage.mimeType,
        data: body.referenceImage.data
      };
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

  try {
    const dataUrl = await callGemini(apiKey, prompt, referenceImage);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ images: [dataUrl] })
    };
  } catch (err) {
    console.error('[generate-cake]', err);
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: err.message || 'Image generation failed. Please try again.' })
    };
  }
};

async function callGemini(apiKey, prompt, referenceImage) {
  // If a reference image is provided, place it BEFORE the text per Gemini guidance
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

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      contents: [{ parts }]
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
  const responseParts = data?.candidates?.[0]?.content?.parts || [];
  const imgPart = responseParts.find((p) => p.inlineData && p.inlineData.data);
  if (!imgPart) {
    const textPart = responseParts.find((p) => p.text);
    throw new Error(textPart?.text || 'Gemini returned no image.');
  }
  const mime = imgPart.inlineData.mimeType || 'image/png';
  return `data:${mime};base64,${imgPart.inlineData.data}`;
}
