/* ===== ORDER PAGE — AI Design Banner =====
 * Reads design from sessionStorage when ?ai=1, lets user download or copy.
 */
(function () {
  const params = new URLSearchParams(window.location.search);
  if (params.get('ai') !== '1') return;

  let stored;
  try {
    stored = JSON.parse(sessionStorage.getItem('skinnyBakerAiCake') || 'null');
  } catch {
    stored = null;
  }
  if (!stored || !stored.image) return;

  const banner = document.getElementById('aiDesignBanner');
  const imgEl = document.getElementById('aiDesignBannerImg');
  const descEl = document.getElementById('aiDesignBannerDesc');
  const downloadBtn = document.getElementById('aiDownloadBtn');
  const copyBtn = document.getElementById('aiCopyPromptBtn');
  const copyLabel = document.getElementById('aiCopyLabel');
  if (!banner) return;

  imgEl.src = stored.image;
  descEl.textContent = `"${stored.prompt}"`;
  banner.hidden = false;

  // Download
  downloadBtn.addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = stored.image;
    a.download = `skinny-baker-ai-design-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

  // Copy description text
  copyBtn.addEventListener('click', async () => {
    const text = `My AI Cake Design Description:\n${stored.prompt}` +
      (stored.styles && stored.styles.length ? `\n\nStyle: ${stored.styles.join(', ')}` : '');
    try {
      await navigator.clipboard.writeText(text);
      copyLabel.textContent = 'Copied!';
      setTimeout(() => { copyLabel.textContent = 'Copy description'; }, 2000);
    } catch {
      copyLabel.textContent = 'Copy failed';
      setTimeout(() => { copyLabel.textContent = 'Copy description'; }, 2000);
    }
  });
})();
