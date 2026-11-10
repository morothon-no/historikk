(function () {
  // Launch switch: enable only when the honor page is ready for public discovery.
  const HONORS_NAVIGATION_ENABLED = false;
  if (HONORS_NAVIGATION_ENABLED) for (const nav of document.querySelectorAll('.navlinks,.mobile-menu nav')) {
    const link=document.createElement('a');link.href='heder.html';link.textContent='Menneskene bak Morothon';nav.appendChild(link);
  }
  const menu = document.querySelector('.mobile-menu');
  if (!menu) return;
  menu.addEventListener('click', event => {
    const link=event.target.closest('a');if(!link)return;menu.open=false;
    const url=new URL(link.href,location.href);
    if(url.origin===location.origin&&url.pathname===location.pathname&&url.hash){
      const target=document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if(target){if(!target.hasAttribute('tabindex'))target.tabIndex=-1;target.focus({preventScroll:true});}
    }
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary').focus(); } });
})();
