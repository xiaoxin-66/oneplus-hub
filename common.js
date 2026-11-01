(function securityGuard() {
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('keydown', e => {
    if (e.key === 'F12' || e.keyCode === 123) { e.preventDefault(); return false; }
    if (e.ctrlKey && e.shiftKey && /^[IicjJ]$/.test(e.key)) { e.preventDefault(); return false; }
    if (e.ctrlKey && /^[Uu]$/.test(e.key)) { e.preventDefault(); return false; }
  });
})();

(function engine() {
  const planet = document.getElementById('planet-bg');
  if (planet) {
    let startTime = sessionStorage.getItem('planet_start_time');
    if (!startTime) {
      startTime = Date.now();
      sessionStorage.setItem('planet_start_time', startTime);
    }
    function renderLoop() {
      planet.style.transform = `rotate(${((Date.now() - parseInt(startTime)) / 60000) * 360}deg)`;
      requestAnimationFrame(renderLoop);
    }
    requestAnimationFrame(renderLoop);
  }

  function spawnMeteor() {
    const meteor = document.createElement('div');
    meteor.classList.add('meteor');
    meteor.style.left = (Math.random() * (window.innerWidth + 500) - 100) + 'px';
    meteor.style.top = (Math.random() * (window.innerHeight - 200) - 400) + 'px';
    const duration = Math.random() * 2 + 5; 
    meteor.style.animation = `meteorFall ${duration}s linear forwards`;
    document.body.appendChild(meteor);
    setTimeout(() => { meteor.remove(); }, (duration + 0.5) * 1000);
  }
  function meteorLoop() {
    if (Math.random() > 0.4) spawnMeteor();
    setTimeout(meteorLoop, Math.random() * 3000 + 2000);
  }
  setTimeout(meteorLoop, 1000);
})();