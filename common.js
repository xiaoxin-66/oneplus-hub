/* ================= 深度安全防护 (防调试、防审查) ================= */
(function securityGuard() {
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('keydown', e => {
    if (e.key === 'F12' || e.keyCode === 123) { e.preventDefault(); return false; }
    if (e.ctrlKey && e.shiftKey && /^[IicjJ]$/.test(e.key)) { e.preventDefault(); return false; }
    if (e.ctrlKey && /^[Uu]$/.test(e.key)) { e.preventDefault(); return false; }
  });
})();

/* ================= 终极引擎：完全由 JS 接管星球旋转 ================= */
(function planetEngine() {
  // 1. 插入背景元素
  const bgHTML = `
    <div class="nebula" aria-hidden="true"></div>
    <div class="stars" aria-hidden="true"></div>
    <div class="planet" aria-hidden="true" id="planet-bg"></div>
    <div class="orb orb-1" aria-hidden="true"></div>
    <div class="orb orb-2" aria-hidden="true"></div>
  `;
  document.body.insertAdjacentHTML('afterbegin', bgHTML);

  const planet = document.getElementById('planet-bg');
  
  // 2. 获取/记录全局统一的绝对时间戳
  let startTime = sessionStorage.getItem('planet_start_time');
  if (!startTime) {
    startTime = Date.now();
    sessionStorage.setItem('planet_start_time', startTime);
  }
  
  startTime = parseInt(startTime);

  // 3. 渲染循环：使用 requestAnimationFrame 确保高精度不卡顿
  function renderLoop() {
    const elapsed = Date.now() - startTime;
    // 60秒转一圈 (360度)
    const angle = (elapsed / 60000) * 360;
    
    if (planet) {
      planet.style.transform = `rotate(${angle}deg)`;
    }
    
    requestAnimationFrame(renderLoop);
  }
  
  // 启动引擎
  requestAnimationFrame(renderLoop);

  // 4. 流星生成逻辑 (大幅减少数量和频率)
  function spawnMeteor() {
    const meteor = document.createElement('div');
    meteor.classList.add('meteor');
    const startX = Math.random() * (window.innerWidth + 500) - 100;
    const startY = Math.random() * (window.innerHeight - 200) - 400; 
    meteor.style.left = startX + 'px';
    meteor.style.top = startY + 'px';
    const duration = Math.random() * 2 + 5; 
    meteor.style.animation = `meteorFall ${duration}s linear forwards`;
    document.body.appendChild(meteor);
    setTimeout(() => { meteor.remove(); }, (duration + 0.5) * 1000);
  }

  function meteorLoop() {
    // 降低概率：60% 的概率单次只出现 1 颗，40% 的概率不出现
    const rand = Math.random();
    if (rand > 0.4) {
      spawnMeteor();
    }
    
    // 间隔时间拉长到 2.5秒 到 6秒 之间才尝试生成下一次
    setTimeout(meteorLoop, Math.random() * 3500 + 2500);
  }
  
  setTimeout(meteorLoop, 1000);
})();