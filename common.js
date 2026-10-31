/* 防审查元素 */
(function () {
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('keydown', e => {
    if (e.key === 'F12') { e.preventDefault(); return false; }
    if (e.ctrlKey && e.shiftKey && /^[IicjJ]$/.test(e.key)) { e.preventDefault(); return false; }
    if (e.ctrlKey && /^[Uu]$/.test(e.key)) { e.preventDefault(); return false; }
  });
})();

/* 自动生成流星 */
(function createMeteors() {
  function spawnMeteor() {
    const meteor = document.createElement('div');
    meteor.classList.add('meteor');
    
    const startX = Math.random() * window.innerWidth + 300; // 起点稍微放宽
    const startY = Math.random() * window.innerHeight - 300;
    
    meteor.style.left = startX + 'px';
    meteor.style.top = startY + 'px';
    
    // 飞行时间稍微随机一点，有快有慢更真实
    const duration = Math.random() * 3 + 4; 
    meteor.style.animation = `meteorFall ${duration}s linear forwards`;
    
    document.body.appendChild(meteor);
    
    setTimeout(() => {
      meteor.remove();
    }, duration * 1000);
  }
  
  // 关键修改：间隔时间从 3000-7000 毫秒，缩短到 500-1500 毫秒
  function loop() {
    spawnMeteor();
    // 随机 0.5 秒到 1.5 秒生成一颗，实现满天流星雨
    setTimeout(loop, Math.random() * 1000 + 500); 
  }
  
  setTimeout(loop, 500); // 页面加载 0.5 秒后马上开始
})();