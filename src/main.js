'use strict';
/* ================= startup & main loop ================= */
onSelectionChange=()=>{renderInspector();};
onDocChange=()=>{scheduleSave();renderPagebarSoft();};
let _pbKey='';function renderPagebarSoft(){const k=outsideCount(page())+'|'+doc.pages.map(p=>p.title).join('|')+doc.cur;if(k!==_pbKey){_pbKey=k;renderPagebar();}}
try{const th=localStorage.getItem('pid.theme');if(th)document.documentElement.dataset.theme=th;else if(window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.dataset.theme='dark';}catch(e){}
(function init(){
  let loaded=false;
  try{const t=localStorage.getItem('pid.doc');if(t){const d=normalizeDoc(JSON.parse(t));installDoc(d);loaded=true;}}catch(e){console.warn('Autosave could not be restored',e);}
  if(!loaded){doc=newDoc();reindex();loadExample('tank');}
  renderPalette();syncToolbar();
  setTimeout(()=>{fitIfDefault();},50);
})();
let last=performance.now(),acc=0,lastLive=0;
function frame(now){const real=Math.min(0.25,(now-last)/1000);last=now;
  if(Sim.running){acc+=real*Sim.speed;const dt=Sim.dt();const t0=performance.now();let n=0;
    while(acc>=dt&&performance.now()-t0<28){try{step(dt);}catch(e){console.error(e);Sim.running=false;syncToolbar();toast('Simulation stopped: '+e.message);break;}acc-=dt;n++;}
    if(acc>dt*3)acc=0;}
  if(now-lastLive>60){lastLive=now;try{updateLive();updateHud();updateAlarmList();}catch(e){console.error(e);}}
  Audio_.update();requestAnimationFrame(frame);}
requestAnimationFrame(frame);
let fitted=false;new ResizeObserver(()=>{if(!fitted&&svg.getBoundingClientRect().width>200){fitted=true;fitIfDefault();}else applyView();}).observe($('#canvasWrap'));
window.addEventListener('beforeunload',saveLocal);
setInterval(()=>{if(Sim.running)saveLocal();},15000);

