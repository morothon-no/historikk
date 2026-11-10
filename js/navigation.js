(function () {
  // Launch switch: enable only when the honor page is ready for public discovery.
  const HONORS_NAVIGATION_ENABLED = false;
  if (HONORS_NAVIGATION_ENABLED) for (const nav of document.querySelectorAll('.navlinks,.mobile-menu nav')) {
    const link=document.createElement('a');link.href='heder.html';link.textContent='Menneskene bak Morothon';nav.appendChild(link);
  }
  const menu = document.querySelector('.mobile-menu');
  if (!menu) return;
  menu.addEventListener('click', event => { if (event.target.closest('a')) menu.open = false; });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary').focus(); } });
})();
