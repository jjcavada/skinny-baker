/* ===== AI CAKE DESIGNER — Interactive Lab ===== */
(function () {
  const form = document.getElementById('aiDesignerForm');
  if (!form) return;

  // Form
  const promptEl = document.getElementById('aiPrompt');
  const countEl = document.getElementById('aiPromptCount');
  const chips = document.querySelectorAll('.ai-chip');
  const generateBtn = document.getElementById('aiGenerateBtn');
  const regenBtn = document.getElementById('aiRegenBtn');

  // Stage
  const cakeEl = document.getElementById('aiCakeDefault');
  const cakeImg = document.getElementById('aiCakeImg');
  const cakeTagText = document.getElementById('aiCakeTagText');
  const loadingState = document.getElementById('aiLoadingState');
  const loadingText = document.getElementById('aiLoadingText');
  const errorState = document.getElementById('aiErrorState');
  const errorMsg = document.getElementById('aiErrorMsg');
  const retryBtn = document.getElementById('aiRetryBtn');
  const actionBar = document.getElementById('aiActionBar');
  const orderBtn = document.getElementById('aiOrderBtn');

  // Upload
  const fileInput = document.getElementById('aiFile');
  const uploadEmpty = document.getElementById('aiUploadEmpty');
  const uploadFilled = document.getElementById('aiUploadFilled');
  const uploadPreview = document.getElementById('aiUploadPreview');
  const uploadName = document.getElementById('aiUploadName');
  const uploadRemove = document.getElementById('aiUploadRemove');

  const activeStyles = new Set();
  let lastPayload = null;
  let referenceImage = null;
  let lastGeneratedSrc = null;

  // ----- Char count -----
  promptEl.addEventListener('input', () => {
    countEl.textContent = promptEl.value.length;
  });

  // ----- Style chips -----
  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const style = chip.dataset.style;
      if (activeStyles.has(style)) {
        activeStyles.delete(style);
        chip.classList.remove('active');
      } else {
        activeStyles.add(style);
        chip.classList.add('active');
      }
    });
  });

  // ----- Reference image upload -----
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('Image is too large. Max 10MB.');
      fileInput.value = '';
      return;
    }
    try {
      const dataUrl = await readFileAsDataURL(file);
      const base64 = dataUrl.split(',')[1];
      referenceImage = {
        dataUrl,
        mimeType: file.type || 'image/jpeg',
        base64,
        name: file.name
      };
      uploadPreview.src = dataUrl;
      uploadName.textContent = file.name;
      uploadEmpty.hidden = true;
      uploadFilled.hidden = false;
    } catch (err) {
      console.error('File read failed', err);
      alert('Could not read image. Try another file.');
    }
  });

  uploadRemove.addEventListener('click', () => {
    referenceImage = null;
    fileInput.value = '';
    uploadFilled.hidden = true;
    uploadEmpty.hidden = false;
  });

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Read failed'));
      reader.readAsDataURL(file);
    });
  }

  // ----- State management — single source of truth -----
  function setState(name) {
    // Hide all overlays first
    loadingState.hidden = true;
    errorState.hidden = true;

    if (name === 'loading') loadingState.hidden = false;
    else if (name === 'error') errorState.hidden = false;
    // 'idle' just leaves the cake visible
  }

  const loadingPhrases = [
    'Sculpting your cake…',
    'Whipping the buttercream…',
    'Piping the details…',
    'Adding the finishing touches…'
  ];
  let loadingTimer = null;
  function startLoadingAnimation() {
    let i = 0;
    loadingText.textContent = loadingPhrases[0];
    loadingTimer = setInterval(() => {
      i = (i + 1) % loadingPhrases.length;
      loadingText.textContent = loadingPhrases[i];
    }, 3500);
  }
  function stopLoadingAnimation() {
    if (loadingTimer) clearInterval(loadingTimer);
    loadingTimer = null;
  }

  // ----- Build prompt -----
  function buildPrompt(userText) {
    const styleString = activeStyles.size
      ? `Style cues: ${Array.from(activeStyles).join(', ')}.`
      : '';
    const refLine = referenceImage
      ? 'Use the attached reference photo as inspiration — incorporate its likeness, theme, or imagery onto the cake (e.g. printed edible image, hand-piped portrait, themed decoration).'
      : '';
    return [
      'A photorealistic 3D rendered cake on a clean elegant cake stand, professional product photography,',
      'soft studio lighting, beautiful bakery presentation, sharp focus, high detail, mouth-watering, magazine quality.',
      `Cake description: ${userText}.`,
      styleString,
      refLine,
      'No people in the scene, no text overlays, no watermarks. Centered composition, neutral cream or warm wood background.'
    ].filter(Boolean).join(' ');
  }

  // ----- Submit -----
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userText = promptEl.value.trim();
    if (!userText) return;

    const fullPrompt = buildPrompt(userText);
    lastPayload = {
      prompt: fullPrompt,
      userText,
      styles: Array.from(activeStyles),
      reference: referenceImage
    };
    await runGeneration(lastPayload);
  });

  retryBtn.addEventListener('click', () => {
    if (lastPayload) runGeneration(lastPayload);
  });
  regenBtn.addEventListener('click', () => {
    if (lastPayload) runGeneration(lastPayload);
  });

  async function callApi(body) {
    const res = await fetch('/.netlify/functions/generate-cake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const e = new Error(err.error || `Server error (${res.status})`);
      e.status = res.status;
      throw e;
    }
    const data = await res.json();
    if (!data.images || !data.images.length) {
      throw new Error('No image returned. Try a different description.');
    }
    return data.images[0];
  }

  async function runGeneration(payload) {
    setState('loading');
    startLoadingAnimation();
    generateBtn.disabled = true;
    regenBtn.disabled = true;

    const body = { prompt: payload.prompt };
    if (payload.reference) {
      body.referenceImage = {
        mimeType: payload.reference.mimeType,
        data: payload.reference.base64
      };
    }

    try {
      let imageDataUrl;
      try {
        imageDataUrl = await callApi(body);
      } catch (firstErr) {
        // Auto-retry once after a short delay for transient errors (502 / busy / timeout)
        const transient = firstErr.status === 502 || /busy|too long|timeout/i.test(firstErr.message || '');
        if (!transient) throw firstErr;

        loadingText.textContent = 'Retrying…';
        await sleep(2500);
        imageDataUrl = await callApi(body);
      }

      applyGenerated(imageDataUrl, payload);
    } catch (err) {
      console.error('[ai-designer]', err);
      errorMsg.textContent = err.message || 'Something went wrong. Try again.';
      setState('error');
    } finally {
      stopLoadingAnimation();
      generateBtn.disabled = false;
      regenBtn.disabled = false;
    }
  }

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  function applyGenerated(dataUrl, payload) {
    lastGeneratedSrc = dataUrl;

    // Swap the floating cake image to the AI-generated one
    cakeImg.src = dataUrl;
    cakeImg.alt = `AI cake: ${payload.userText.slice(0, 80)}`;
    cakeEl.classList.add('is-generated');
    cakeTagText.textContent = 'AI Generated';

    // Clear overlays
    setState('idle');

    // Reveal regenerate + order
    regenBtn.hidden = false;
    actionBar.hidden = false;

    // Persist for order page
    try {
      sessionStorage.setItem('skinnyBakerAiCake', JSON.stringify({
        image: dataUrl,
        prompt: payload.userText,
        styles: payload.styles,
        ts: Date.now()
      }));
    } catch (e) {
      console.warn('Could not persist AI design', e);
    }
    orderBtn.href = 'pages/order.html?ai=1';
  }

})();
