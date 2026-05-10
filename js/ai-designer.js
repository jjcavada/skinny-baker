/* ===== AI CAKE DESIGNER ===== */
(function () {
  const form = document.getElementById('aiDesignerForm');
  if (!form) return;

  const promptEl = document.getElementById('aiPrompt');
  const countEl = document.getElementById('aiPromptCount');
  const chips = document.querySelectorAll('.ai-chip');
  const generateBtn = document.getElementById('aiGenerateBtn');
  const regenBtn = document.getElementById('aiRegenBtn');

  const defaultState = document.getElementById('aiDefaultState');
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

  // Reference image upload elements
  const fileInput = document.getElementById('aiFile');
  const uploadEmpty = document.getElementById('aiUploadEmpty');
  const uploadFilled = document.getElementById('aiUploadFilled');
  const uploadPreview = document.getElementById('aiUploadPreview');
  const uploadName = document.getElementById('aiUploadName');
  const uploadRemove = document.getElementById('aiUploadRemove');

  const activeStyles = new Set();
  let lastPayload = null;
  let lastResults = [];
  let referenceImage = null; // { dataUrl, mimeType, base64 }

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

  function showOnly(node) {
    [defaultState, loadingState, resultsEl, selectedEl, errorState].forEach((n) => {
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
      ? `Style cues: ${Array.from(activeStyles).join(', ')}.`
      : '';
    const refLine = referenceImage
      ? 'Use the attached reference photo as inspiration for the design — incorporate its likeness, theme, or imagery onto the cake (e.g. printed edible image, hand-piped portrait, themed decoration).'
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

  async function runGeneration(payload) {
    showOnly(loadingState);
    startLoadingAnimation();
    generateBtn.disabled = true;
    regenBtn.disabled = true;

    try {
      const body = { prompt: payload.prompt };
      if (payload.reference) {
        body.referenceImage = {
          mimeType: payload.reference.mimeType,
          data: payload.reference.base64
        };
      }

      const res = await fetch('/.netlify/functions/generate-cake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
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
    while (resultsEl.firstChild) resultsEl.removeChild(resultsEl.firstChild);
    resultsEl.dataset.count = images.length;

    if (images.length === 1) {
      selectImage(images[0]);
      return;
    }

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
    showOnly(resultsEl);
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
      showOnly(defaultState);
      regenBtn.hidden = true;
    }
  });

})();
