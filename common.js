/* 防审查元素（体验层，非安全层） */
(function () {
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('keydown', e => {
    if (e.key === 'F12') { e.preventDefault(); return false; }
    if (e.ctrlKey && e.shiftKey && /^[IicjJ]$/.test(e.key)) { e.preventDefault(); return false; }
    if (e.ctrlKey && /^[Uu]$/.test(e.key)) { e.preventDefault(); return false; }
  });
})();