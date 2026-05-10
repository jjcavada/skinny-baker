/* ===== AI CAKE DESIGNER ===== */
(function () {
  const form = document.getElementById('aiDesignerForm');
  if (!form) return;

  const promptEl = document.getElementById('aiPrompt');
  const countEl = document.getElementById('aiPromptCount');
  const chips = document.querySelectorAll('.ai-chip');
  const generateBtn = document.getElementById('aiGenerateBtn');
  const regenBtn = document.getElementById('aiRegenBtn');

  const emptyState = document.getElementById('aiEmptyState');
  const loadingState = document.getElementById('aiLoadingState');
  const loadingText = document.getElementById('aiLoadingText');
  const resultsEl = document.getElementById('aiResults');
  const selectedEl = document.getElementById('aiSelected');
  const selectedImg = document.getElementById('aiSelectedImg');
  const backBtn = document.getElementById('aiBackToGrid');
  const orderBtn = document.getElementById('aiOrderBtn');
  const errorState = document.getElementById('aiErrorState');
  const errorMsg = document.getElementById('aiErrorMsg');
  const retryBtn = document.getElementById('aiRetryBtn');

  const activeStyles = new Set();
  let lastPayload = null;
  let lastResults = [];

  promptEl.addEventListener('input', () => {
    countEl.textContent = promptEl.value.length;
  });

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

  function showOnly(node) {
    [emptyState, loadingState, resultsEl, selectedEl, errorState].forEach((n) => {
      if (n) n.hidden = (n !== node);
    });
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

  function buildPrompt(userText) {
    const styleString = activeStyles.size
      ? `Style: ${Array.from(activeStyles).join(', ')}.`
      : '';
    return [
      'A photorealistic 3D rendered cake on a clean elegant cake stand, professional product photography,',
      'soft studio lighting, beautiful bakery presentation, sharp focus, high detail, mouth-watering, magazine quality.',
      `Cake description: ${userText}.`,
      styleString,
      'No people, no text, no watermarks. Centered composition, neutral cream or warm wood background.'
    ].filter(Boolean).join(' ');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userText = promptEl.value.trim();
    if (!userText) return;

    const variations = parseInt(form.querySelector('input[name="variations"]:checked').value, 10);
    const fullPrompt = buildPrompt(userText);

    lastPayload = { prompt: fullPrompt, userText, variations, styles: Array.from(activeStyles) };
    await runGeneration(lastPayload);
  });

  retryBtn.addEventListener('click', () => {
    if (lastPayload) runGeneration(lastPayload);
  });

  regenBtn.addEventListener('click', () => {
    if (lastPayload) runGeneration(lastPayload);
  });

  async function runGeneration(payload) {
    showOnly(loadingState);
    startLoadingAnimation();
    generateBtn.disabled = true;
    regenBtn.disabled = true;

    try {
      const res = await fetch('/.netlify/functions/generate-cake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: payload.prompt,
          variations: payload.variations
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error (${res.status})`);
      }

      const data = await res.json();
      if (!data.images || !data.images.length) {
        throw new Error('No image returned. Try a different description.');
      }

      lastResults = data.images.map((dataUrl) => ({
        url: dataUrl,
        userText: payload.userText,
        styles: payload.styles
      }));

      renderResults(lastResults);
    } catch (err) {
      console.error('[ai-designer]', err);
      errorMsg.textContent = err.message || 'Something went wrong. Try again.';
      showOnly(errorState);
    } finally {
      stopLoadingAnimation();
      generateBtn.disabled = false;
      regenBtn.disabled = false;
      regenBtn.hidden = false;
    }
  }

  function renderResults(images) {
    // Clear existing tiles safely
    while (resultsEl.firstChild) resultsEl.removeChild(resultsEl.firstChild);
    resultsEl.dataset.count = images.length;

    images.forEach((img, idx) => {
      const tile = document.createElement('div');
      tile.className = 'ai-result-tile';
      const imgEl = document.createElement('img');
      imgEl.src = img.url;
      imgEl.alt = `AI cake design ${idx + 1}`;
      imgEl.loading = 'lazy';
      tile.appendChild(imgEl);
      tile.addEventListener('click', () => selectImage(img));
      resultsEl.appendChild(tile);
    });

    if (images.length === 1) {
      selectImage(images[0]);
    } else {
      showOnly(resultsEl);
    }
  }

  function selectImage(img) {
    selectedImg.src = img.url;
    try {
      sessionStorage.setItem('skinnyBakerAiCake', JSON.stringify({
        image: img.url,
        prompt: img.userText,
        styles: img.styles,
        ts: Date.now()
      }));
    } catch (e) {
      console.warn('Could not persist AI design', e);
    }
    orderBtn.href = 'pages/order.html?ai=1';
    showOnly(selectedEl);
  }

  backBtn.addEventListener('click', () => {
    if (lastResults.length > 1) {
      showOnly(resultsEl);
    } else {
      showOnly(emptyState);
      regenBtn.hidden = true;
    }
  });

})();
