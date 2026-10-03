'use strict';
/* ================= files ================= */
async function saveFile(name,data,mime){
  try{if(window.claude&&typeof claude.use==='function'){const d=await claude.use('downloads');if(d){try{await d.save({filename:name,data});toast('Saved '+name);return;}catch(e){if(e&&e.code==='declined'){toast('Save cancelled');return;}}}}}catch(e){}
  const blob=data instanceof Blob?data:new Blob([data],{type:mime||'application/octet-stream'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);toast('Saved '+name);}
function serializeDoc(){return{app:'pid-designer',v:2,cur:doc.cur,fluids:doc.fluids,pages:doc.pages.map(p=>({id:p.id,title:p.title,sheet:p.sheet,orient:p.orient,view:p.view,
  comps:p.comps.map(c=>{const o=serComp(c);if(c.type==='vessel'&&c.s)o.s={vol:c.s.vol,T:c.s.T,comp:Array.from(c.s.comp)};return o;}),
  conns:p.conns.map(w=>({id:w.id,kind:w.kind,from:w.from,to:w.to,anchors:w.anchors||[],cond:w.cond,fluid:w.fluid}))}))};}
function mergeDefaults(def,saved){const o=clone(def);if(!saved||typeof saved!=='object')return o;for(const k of Object.keys(def)){if(!(k in saved))continue;const d=def[k],s=saved[k];
  if(d&&typeof d==='object'&&!Array.isArray(d)){o[k]=mergeDefaults(d,s);}else if(Array.isArray(d)){if(Array.isArray(s))o[k]=clone(s);}else if(typeof d===typeof s||d===null)o[k]=s;else if(typeof d==='number'&&!isNaN(+s))o[k]=+s;else if(typeof d==='boolean')o[k]=!!s;}return o;}
function normalizeDoc(o){
  if(!o||typeof o!=='object')throw new Error('Not a P&ID document');
  let pages=o.pages;if(!Array.isArray(pages)){const cs=o.comps||o.components;if(Array.isArray(cs))pages=[{title:o.title||'Drawing 1',sheet:o.sheet,orient:o.orient,comps:cs,conns:o.conns||o.connections||o.pipes||[]}];else throw new Error('No pages or components found in file');}
  const d={v:2,fluids:FDEF.map((f,i)=>{const s=o.fluids&&o.fluids[i];return{name:(s&&typeof s.name==='string'&&s.name)||f[0],color:(s&&/^#[0-9a-f]{3,8}$/i.test(s.color||''))?s.color:f[1]};}),pages:[],cur:0};
  const seen=new Set(),tags=new Set();
  for(const sp of pages){const pg=newPage(typeof sp.title==='string'&&sp.title?sp.title:'Drawing '+(d.pages.length+1));if(sp.id&&!d.pages.some(q=>q.id===sp.id))pg.id=sp.id;
    pg.sheet=['none','A4','A3'].includes(sp.sheet)?sp.sheet:'A3';pg.orient=sp.orient==='portrait'?'portrait':'landscape';if(sp.view&&isFinite(sp.view.x)&&isFinite(sp.view.y)&&isFinite(sp.view.k))pg.view={x:sp.view.x,y:sp.view.y,k:clamp(sp.view.k,.12,3.5)};
    const remap={};
    for(const sc of (sp.comps||[])){if(!sc||!TYPES[sc.type])continue;const T=TYPES[sc.type];const c={id:String(sc.id||uid()),type:sc.type,tag:String(sc.tag||''),x:snap(+sc.x||0),y:snap(+sc.y||0),orient:sc.orient==='v'?'v':(sc.orient==='h'?'h':(T.orient||'h')),locked:!!sc.locked,p:mergeDefaults(T.defaults(),sc.p)};
      if(c.type==='pi'||c.type==='ti'){if(sc.orient!=='v'&&sc.orient!=='h')c.orient='h';}
      if(seen.has(c.id)){const n=uid();remap[c.id]=n;c.id=n;}seen.add(c.id);
      if(!T.notag){if(!c.tag)c.tag=nextTagIn(T.prefix,tags);if(tags.has(c.tag))c.tag=retag(c.tag,tags);tags.add(c.tag);}else c.tag=c.tag||'NOTE';
      if(sc.s&&c.type==='vessel')c._saved=sc.s;pg.comps.push(c);}
    const ids=new Set(pg.comps.map(c=>c.id));const cid=id=>remap[id]||id;
    let conns=(sp.conns||[]).filter(w=>w&&w.from&&w.to).map(w=>({id:String(w.id||uid()),kind:['pipe','disc','ana'].includes(w.kind)?w.kind:'pipe',from:{c:cid(w.from.c),p:w.from.p},to:{c:cid(w.to.c),p:w.to.p},anchors:Array.isArray(w.anchors)?w.anchors.filter(a=>a&&isFinite(a.x)&&isFinite(a.y)).map(a=>({x:+a.x,y:+a.y})):[],cond:isFinite(w.cond)?+w.cond:50,fluid:w.fluid==null?-1:+w.fluid}));
    // migrate inline PI/TI (pipe in/out ports) to taps
    for(const c of pg.comps.filter(q=>q.type==='pi'||q.type==='ti')){const inn=conns.filter(w=>w.to.c===c.id&&w.to.p==='in'),out=conns.filter(w=>w.from.c===c.id&&w.from.p==='out');
      if(inn.length||out.length){const up=inn[0],dn=out[0];conns=conns.filter(w=>!inn.includes(w)&&!out.includes(w));
        if(up&&dn)conns.push({id:uid(),kind:'pipe',from:up.from,to:dn.to,anchors:[],cond:50,fluid:-1}),conns.push({id:uid(),kind:'pipe',from:{c:c.id,p:'tap'},to:up.from,anchors:[],cond:50,fluid:-1});
        else if(up)conns.push({id:uid(),kind:'pipe',from:{c:c.id,p:'tap'},to:up.from,anchors:[],cond:50,fluid:-1});}}
    pg.conns=conns;d.pages.push(pg);}
  if(!d.pages.length)throw new Error('The file has no pages');
  d.cur=clamp(Math.floor(+o.cur||0),0,d.pages.length-1);
  // validate connections against ports
  const all=new Map();d.pages.forEach(p=>p.comps.forEach(c=>all.set(c.id,c)));const cids=new Set();
  for(const pg of d.pages){pg.conns=pg.conns.filter(w=>{const a=all.get(w.from.c),b=all.get(w.to.c);if(!a||!b)return false;const prev=byId;return true;});
    for(const w of pg.conns){if(cids.has(w.id))w.id=uid();cids.add(w.id);}}
  return d;}
function nextTagIn(prefix,used){let max=100;for(const t of used)if(t.startsWith(prefix)){const r=t.slice(prefix.length);if(/^\d+$/.test(r))max=Math.max(max,+r);}return prefix+(max+1);}
function installDoc(d){closeEdit&&closeEdit();doc=d;reindex();
  for(const pg of doc.pages){pg.conns=pg.conns.filter(w=>{const a=byId.get(w.from.c),b=byId.get(w.to.c);return a&&b&&portPos(a,w.from.p)&&portPos(b,w.to.p);});}
  for(const c of allComps()){resetRuntime(c);if(c._saved){const s=c._saved;c.s.vol=clamp(+s.vol||0,0,c.p.vmax*1.2);c.s.T=+s.T||c.p.temp;if(Array.isArray(s.comp)&&s.comp.length===NF)c.s.comp=Float64Array.from(s.comp);c.s.lvl=c.s.vol/c.p.vmax*100;delete c._saved;}}
  Sim.t=0;Sim.tIn=Sim.drained=Sim.over=Sim.fixx=0;dirtyNet();ensureNet();for(const n of NODES.values()){n.h=0;n.wet=false;}Sim.inv0=invNow();Sim.invChange=0;Sim.err=0;streams(0);
  V.sel=new Set();V.selW=new Set();renderAll();syncToolbar();renderPagebar();renderInspector();setTimeout(fitIfDefault,0);}
function fitIfDefault(){const v=page().view;if((v.x===20&&v.y===20&&v.k===1)||v.k<=0.121)fitView();}
function openJsonText(text){try{const d=normalizeDoc(JSON.parse(text));installDoc(d);toast('Opened document ('+d.pages.length+' page'+(d.pages.length>1?'s':'')+')');onDocChange();}catch(e){toast('Could not open file: '+e.message);}}
let saveT=null;
function saveLocal(){try{localStorage.setItem('pid.doc',JSON.stringify(serializeDoc()));}catch(e){}}
function scheduleSave(){clearTimeout(saveT);saveT=setTimeout(saveLocal,600);}

/* ================= audio (alarm horn) ================= */
const Audio_={ctx:null,osc:null,gain:null,sound:true,
  init(){if(this.ctx)return;try{const C=window.AudioContext||window.webkitAudioContext;this.ctx=new C();this.osc=this.ctx.createOscillator();this.gain=this.ctx.createGain();this.osc.type='sawtooth';this.gain.gain.value=0;this.osc.connect(this.gain).connect(this.ctx.destination);this.osc.start();}catch(e){this.ctx=null;}},
  freq(tone,t){switch(tone){case'pulse':return[900,(t%1)<.5?1:0];case'warble':return[Math.floor(t*6)%2?700:950,1];case'whoop':return[400+600*((t%1.6)/1.6),1];case'yelp':return[600+600*((t%.3)/.3),1];default:return[800,1];}},
  set(tone,vol){if(!this.ctx)return;if(this.ctx.state==='suspended')this.ctx.resume();const t=performance.now()/1000;if(!tone||vol<=0){this.gain.gain.setTargetAtTime(0,this.ctx.currentTime,.02);return;}
    const[f,g]=this.freq(tone,t);this.osc.frequency.setTargetAtTime(f,this.ctx.currentTime,.01);this.gain.gain.setTargetAtTime(g*.18*vol/100,this.ctx.currentTime,.01);},
  update(){if(!this.ctx)return;if(!Sim.running||!this.sound){this.set(null,0);return;}
    for(const c of page().comps)if(c.type==='horn'&&c.s.tone&&!c.s.silenced){this.set(c.s.tone,c.p.vol);return;}this.set(null,0);},
  preview(tone,vol){this.init();if(!this.ctx)return;this._pv=performance.now()+1500;const iv=setInterval(()=>{if(performance.now()>this._pv){clearInterval(iv);this.set(null,0);}else this.set(tone,vol);},40);}};

/* ================= palette ================= */
const CATS=['Process','Valves','Instruments','Control','Alarms','Notes','I/O','Math','Logic','Timers','Analog','SIS'];
let pTab=(()=>{try{return localStorage.getItem('pid.tab')||'Process';}catch(e){return'Process';}})();
function renderPalette(){const q=$('#pSearch').value.trim().toLowerCase();const tabs=$('#ptabs');
  tabs.innerHTML=CATS.map(c=>`<button data-tab="${c}" class="${!q&&c===pTab?'on':''}">${c}</button>`).join('');
  let list=ORDER.filter(id=>{const T=TYPES[id];if(q)return(T.name+' '+T.prefix+' '+T.cat+' '+id).toLowerCase().includes(q);return T.cat===pTab;});
  $('#pcount').textContent=q?`${list.length} result${list.length===1?'':'s'}`:'';
  $('#plist').innerHTML=list.map(id=>{const T=TYPES[id];return`<div class="pitem" draggable="true" data-type="${id}"><div class="pi">${esc(T.icon||T.prefix)}</div><div>${esc(T.name)}<small>${T.cat}${T.notag?'':' · '+esc(T.prefix)+'101'}</small></div></div>`;}).join('')||'<div class="note">No matches</div>';}
$('#ptabs').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(!b)return;pTab=b.dataset.tab;try{localStorage.setItem('pid.tab',pTab);}catch(x){}$('#pSearch').value='';renderPalette();});
$('#pSearch').addEventListener('input',renderPalette);
$('#plist').addEventListener('dragstart',e=>{const it=e.target.closest('[data-type]');if(!it)return;e.dataTransfer.setData('text/plain','pid:'+it.dataset.type);e.dataTransfer.effectAllowed='copy';});
$('#plist').addEventListener('click',e=>{const it=e.target.closest('[data-type]');if(!it)return;const r=svg.getBoundingClientRect();const v=page().view;addComp(it.dataset.type,(r.width/2-v.x)/v.k,(r.height/2-v.y)/v.k);toast('Added '+TYPES[it.dataset.type].name);checkOutside();});
const cvw=$('#canvasWrap');cvw.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';});
cvw.addEventListener('drop',e=>{const t=e.dataTransfer.getData('text/plain');if(!t.startsWith('pid:'))return;e.preventDefault();const w=toWorld(e);addComp(t.slice(4),w.x,w.y);checkOutside();});

/* ================= inspector ================= */
const insp=$('#inspBody');
function copyBtns(){return`<div class="btnrow">${['copy:Copy','cut:Cut','paste:Paste','dup:Duplicate','del:Delete'].map(x=>{const[a,l]=x.split(':');return`<button class="btn sm${a==='del'?' warn':''}" data-gact="${a}">${l}</button>`;}).join('')}</div>`;}
function renderInspector(){const cs=selComps();const pg=page();
  if(!cs.length&&V.selW.size){const w=pg.conns.find(q=>V.selW.has(q.id));if(w)return insp.innerHTML=connInsp(w);}
  if(!cs.length){insp.innerHTML=pageInsp();return;}
  if(cs.length>1){const lk=cs.filter(c=>c.locked).length;insp.innerHTML=`<h3>${cs.length} items selected</h3>${copyBtns()}<div class="btnrow"><button class="btn sm" data-gact="lock">${lk===cs.length?'Unlock selection':'Lock in place'}</button></div><div class="note">${lk} locked. Shift/Ctrl-click toggles, Shift-drag box-selects. Locked items can't be dragged or deleted.</div>`;return;}
  const c=cs[0],T=TYPES[c.type];
  const head=`<h3>${esc(T.name)}</h3>`+(T.notag?'':H.row('Tag',`<input type="text" data-f="tag" value="${esc(c.tag)}">`))+
    (T.rot?H.row('Orientation',`<select data-f="orient"><option value="h"${c.orient==='h'?' selected':''}>Horizontal${c.type==='vessel'?' (drum)':''}</option><option value="v"${c.orient==='v'?' selected':''}>Vertical${c.type==='vessel'?' (standing)':''}</option></select>`):'')+
    H.row('Lock in place',`<input type="checkbox" data-f="locked"${c.locked?' checked':''}>`)+copyBtns();
  insp.innerHTML=head+T.insp(c);
  const sl=$('[data-live-slider]');if(sl)sl.value=clamp(c.s.vol/c.p.vmax*100,0,100);}
function connInsp(w){const a=byId.get(w.from.c),b=byId.get(w.to.c);const pa=portPos(a,w.from.p),pb=portPos(b,w.to.p);const tap=pa.dir==='tap'||pb.dir==='tap';
  const kind={pipe:tap?'Instrument tap':'Pipe',disc:'Discrete signal wire',ana:'Analog signal wire (0–100% / 4–20 mA)'}[w.kind];
  return`<h3>${kind}</h3><div class="note">${esc(a.tag)}.${w.from.p} → ${esc(b.tag)}.${w.to.p}</div>`+
   (w.kind==='pipe'&&!tap?H.row('Conductance (L/s per √m)',`<input type="number" data-w="cond" step="any" min="0.1" value="${w.cond}">`)+H.row('Fluid override',`<select data-w="fluid"><option value="-1">— carries what flows —</option>${doc.fluids.map((f,i)=>`<option value="${i}"${+w.fluid===i?' selected':''}>${esc(f.name)}</option>`).join('')}</select>`):'')+
   (w.kind==='disc'&&portPos(a,w.from.p).off?`<div class="note" style="color:var(--accent)">The source alarm is disabled — the wire is inactive.</div>`:'')+
   `<div class="isec">Routing</div><div class="btnrow"><button class="btn sm" data-wact="tidy">Tidy this route</button><button class="btn sm" data-wact="clear">Clear anchors</button><button class="btn sm warn" data-wact="del">Delete line</button></div><div class="note">Double-click the line to add an anchor, drag anchors to reshape (10 px snap), double-click an anchor to remove it. Anchors: ${(w.anchors||[]).length}.</div>`;}
function pageInsp(){const pg=page();const n=outsideCount(pg);
  return`<h3>Drawing</h3>`+H.row('Page title',`<input type="text" data-pg="title" value="${esc(pg.title)}">`)+`<div class="note">Sheet ${doc.pages.indexOf(pg)+1} of ${doc.pages.length} · ${pg.sheet==='none'?'no sheet':pg.sheet+' '+pg.orient}${n?` · <b style="color:var(--accent)">${n} outside border</b>`:''}</div>`+
   `<div class="btnrow"><button class="btn sm" data-gact="lockall">Lock all</button><button class="btn sm" data-gact="paste">Paste</button></div>`+
   H.sec('Fluids (shared by all pages)')+doc.fluids.map((f,i)=>`<div class="fluidrow"><input type="color" data-fl="${i}" data-k="color" value="${esc(f.color)}"><input type="text" data-fl="${i}" data-k="name" value="${esc(f.name)}"></div>`).join('')+
   H.sec('Quick help')+`<div class="note">Drag a component from the palette (or tap it). Drag from a round <b>output</b> port to a hollow <b>input</b> port to pipe; diamond ports are discrete wires, square ports analog wires. Drag empty space to pan, wheel to zoom, Shift-drag to box select. Space = run/pause, / = search, Ctrl+C/X/V/D copy/cut/paste/duplicate, Ctrl+L lock, Del delete.</div>`;}
insp.addEventListener('input',onField);insp.addEventListener('change',onField);
function onField(e){const el=e.target;const c=selComps()[0];
  if(el.dataset.fl!=null){const f=doc.fluids[+el.dataset.fl];f[el.dataset.k]=el.value;for(const w of page().conns)w._cs='';for(const k of allComps()){k._symS=null;k._labS=null;}onDocChange();return;}
  if(el.dataset.pg!=null){page()[el.dataset.pg]=el.value;renderSheet();renderPagebar();onDocChange();return;}
  if(el.dataset.w){const w=page().conns.find(q=>V.selW.has(q.id));if(!w)return;let v=el.value;if(el.dataset.w==='cond')v=Math.max(.1,parseFloat(v)||50);else v=parseInt(v);w[el.dataset.w]=v;w._cs='';onDocChange();return;}
  if(el.hasAttribute('data-live-slider')){if(!c)return;const v=+el.value;Sim.rebase(()=>{c.s.vol=v/100*c.p.vmax;c.s.lvl=v;});onDocChange();return;}
  if(el.hasAttribute('data-ncells')){if(e.type!=='change'||!c)return;const n=clamp(parseInt(el.value)||0,0,48);c.p.cells=Array.from({length:48},(_,i)=>i<n);renderComp(c,false);renderInspector();onDocChange();return;}
  if(!c)return;const T=TYPES[c.type];
  if(el.dataset.f){const f=el.dataset.f;if(f==='tag'){if(e.type!=='change')return;let v=el.value.trim()||c.tag;const u=uniqueTag(v,c);if(u!==v)toast(`Tag ${v} is in use — renamed ${u}`);c.tag=u;el.value=u;}
    else if(f==='locked'){if(e.type!=='change')return;c.locked=el.checked;}
    else if(f==='orient'){if(e.type!=='change')return;c.orient=el.value;}
    dirtyNet();renderComp(c);onDocChange();if(f!=='tag')renderInspector();return;}
  const path=el.dataset.p;if(!path)return;const t=el.dataset.t;
  if((el.tagName==='SELECT'||t==='b'||el.type==='color')&&e.type==='input'&&el.type!=='color')return;
  let v;if(t==='n'){v=parseFloat(el.value);if(Number.isNaN(v))return;}else if(t==='b')v=el.checked;else v=el.value;
  if(path==='__orient'){if(e.type!=='change')return;c.orient=v;}else setp(c.p,path,v);
  if(T.onChange)T.onChange(c,path);dirtyNet();renderComp(c);onDocChange();
  if(el.hasAttribute('data-rr')&&e.type==='change')renderInspector();}
insp.addEventListener('click',e=>{const c=selComps()[0];
  const g=e.target.closest('[data-gact]');if(g){gAction(g.dataset.gact);return;}
  const wa=e.target.closest('[data-wact]');if(wa){const w=page().conns.find(q=>V.selW.has(q.id));if(!w)return;
    if(wa.dataset.wact==='del'){deleteSel();}else if(wa.dataset.wact==='clear'){w.anchors=[];rebuildConn(w);drawAnchors();renderInspector();onDocChange();}
    else{const n=tidyRoutes([w]);rebuildConn(w);drawAnchors();renderInspector();onDocChange();toast(n?'Route tidied':'No clear path found');}return;}
  if(!c)return;
  const mx=e.target.closest('[data-mx]');if(mx){const k=mx.dataset.mx,r=+mx.dataset.r,cc=+mx.dataset.c;c.p[k][r][cc]=!c.p[k][r][cc];renderComp(c,false);renderInspector();onDocChange();return;}
  const cell=e.target.closest('[data-cell]');if(cell){const i=+cell.dataset.cell;c.p.cells[i]=!c.p.cells[i];renderComp(c,false);renderInspector();onDocChange();return;}
  const sw=e.target.closest('[data-swatch]');if(sw){c.p.color=sw.dataset.swatch;renderComp(c,false);renderInspector();onDocChange();return;}
  const b=e.target.closest('[data-act]');if(b){const T=TYPES[c.type];const r=T.act&&T.act(c,b.dataset.act);dirtyNet();renderComp(c,false);if(r==='rr'||r===undefined)renderInspector();onDocChange();}});
function gAction(a){({copy:copySel,cut:cutSel,paste:()=>pasteClip(),dup:dupSel,del:deleteSel,lock:lockSel,lockall:lockAll})[a]();}
setInterval(()=>{const c=selComps()[0];if(c&&V.selW.size===0&&TYPES[c.type].liveInsp&&c.s)TYPES[c.type].liveInsp(c);},250);

/* ================= pages ================= */
let delArm=0;
function renderPagebar(){const pb=$('#pagebar');const n=outsideCount(page());
  pb.innerHTML=doc.pages.map((p,i)=>`<div class="ptab${i===doc.cur?' on':''}" draggable="true" data-pi="${i}">${esc(p.title)}</div>`).join('')+
   `<button class="btn sm" data-pa="add">+ Page</button><button class="btn sm" data-pa="dup">Duplicate</button><button class="btn sm${delArm?' warn':''}" data-pa="del">${delArm?'Click again to delete':'Delete page'}</button><button class="btn sm" data-pa="left" title="Move page left">◀</button><button class="btn sm" data-pa="right" title="Move page right">▶</button>${n?`<span class="warnb">⚠ ${n} component(s) outside sheet border</span>`:''}`;}
function switchPage(i){if(i<0||i>=doc.pages.length)return;closeEdit();doc.cur=i;V.sel=new Set();V.selW=new Set();reindex();renderAll();renderPagebar();syncToolbar();renderInspector();if(Sim.running===false)updateLive();onDocChange();}
function movePage(i,d){const j=i+d;if(j<0||j>=doc.pages.length)return;const cur=doc.pages[doc.cur];const[p]=doc.pages.splice(i,1);doc.pages.splice(j,0,p);doc.cur=doc.pages.indexOf(cur);renderSheet();renderPagebar();onDocChange();}
function dupPage(){const src=page();const used=usedTags();const np=newPage(src.title+' (copy)');np.sheet=src.sheet;np.orient=src.orient;np.view={...src.view};const map={};
  for(const c of src.comps){const o=serComp(c);const k=clone(o);k.id=uid();map[c.id]=k.id;if(!TYPES[k.type].notag){k.tag=retag(k.tag,used);used.add(k.tag);}np.comps.push(k);}
  for(const w of src.conns){const q=clone({kind:w.kind,from:w.from,to:w.to,anchors:w.anchors||[],cond:w.cond,fluid:w.fluid});q.id=uid();q.from.c=map[w.from.c];q.to.c=map[w.to.c];np.conns.push(q);}
  Sim.rebase(()=>{doc.pages.splice(doc.cur+1,0,np);});reindex();for(const c of np.comps)resetRuntime(c);dirtyNet();switchPage(doc.cur+1);}
$('#pagebar').addEventListener('click',e=>{const t=e.target.closest('.ptab');if(t){switchPage(+t.dataset.pi);return;}const b=e.target.closest('[data-pa]');if(!b)return;const a=b.dataset.pa;
  if(a!=='del')delArm=0;
  if(a==='add'){const p=newPage('Drawing '+(doc.pages.length+1));Sim.rebase(()=>{doc.pages.push(p);});switchPage(doc.pages.length-1);}
  else if(a==='dup')dupPage();
  else if(a==='left')movePage(doc.cur,-1);else if(a==='right')movePage(doc.cur,1);
  else if(a==='del'){if(doc.pages.length<2){toast('At least one page must remain');return;}if(!delArm){delArm=1;renderPagebar();setTimeout(()=>{delArm=0;renderPagebar();},3000);return;}delArm=0;
    Sim.rebase(()=>{doc.pages.splice(doc.cur,1);});doc.cur=Math.min(doc.cur,doc.pages.length-1);dirtyNet();switchPage(doc.cur);}});
let dragPi=null;
$('#pagebar').addEventListener('dragstart',e=>{const t=e.target.closest('.ptab');if(t){dragPi=+t.dataset.pi;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','tab');}});
$('#pagebar').addEventListener('dragover',e=>{if(dragPi!=null&&e.target.closest('.ptab'))e.preventDefault();});
$('#pagebar').addEventListener('drop',e=>{const t=e.target.closest('.ptab');if(t&&dragPi!=null){e.preventDefault();const to=+t.dataset.pi;const cur=doc.pages[doc.cur];const[p]=doc.pages.splice(dragPi,1);doc.pages.splice(to,0,p);doc.cur=doc.pages.indexOf(cur);dragPi=null;renderSheet();renderPagebar();onDocChange();}});

/* ================= toolbar ================= */
function syncToolbar(){const pg=page();$('#selSheet').value=pg.sheet;$('#selOrient').value=pg.orient;$('#selOrient').disabled=pg.sheet==='none';$('#bPlay').textContent=Sim.running?'⏸ Pause':'▶ Play';$('#bPlay').classList.toggle('on',Sim.running);svg.classList.toggle('paused',!Sim.running);
  $('#bSound').textContent=Audio_.sound?'🔈 Sound on':'🔇 Muted';$('#selSpeed').value=String(Sim.speed);}
function togglePlay(){Sim.running=!Sim.running;if(Sim.running)Audio_.init();syncToolbar();}
$('#bPlay').onclick=togglePlay;
$('#bReset').onclick=()=>{resetAll();renderAll();renderInspector();toast('Levels and runtime state reset on all pages');};
let clrArm=0;$('#bClear').onclick=()=>{const b=$('#bClear');if(!clrArm){clrArm=1;b.textContent='Click again to clear';b.classList.add('warn');setTimeout(()=>{clrArm=0;b.textContent='Clear canvas';b.classList.remove('warn');},3000);return;}
  clrArm=0;b.textContent='Clear canvas';b.classList.remove('warn');Sim.rebase(()=>{page().comps=[];page().conns=[];});dirtyNet();reindex();V.sel=new Set();V.selW=new Set();renderAll();renderInspector();renderPagebar();onDocChange();toast('Canvas cleared');};
$('#bEx').onclick=e=>{e.stopPropagation();$('#mEx').classList.toggle('open');};document.addEventListener('click',()=>$('#mEx').classList.remove('open'));
$('#mEx').addEventListener('click',e=>{const b=e.target.closest('[data-ex]');if(b)loadExample(b.dataset.ex);});
$('#bTidy').onclick=()=>{const n=tidyRoutes(page().conns);rebuildAllConns();drawAnchors();onDocChange();toast(`Tidied ${n} route(s)`);};
$('#selSheet').onchange=e=>{page().sheet=e.target.value;renderSheet();syncToolbar();renderPagebar();onDocChange();fitView();checkOutside();};
$('#selOrient').onchange=e=>{page().orient=e.target.value;renderSheet();renderPagebar();onDocChange();fitView();checkOutside();};
$('#bPng').onclick=async()=>{try{const b=await renderPng();saveFile(page().title.replace(/[^\w\- ]+/g,'')+'.png',b,'image/png');}catch(e){toast('PNG export failed: '+e.message);}};
$('#bSave').onclick=()=>saveFile('pid-document.json',JSON.stringify(serializeDoc(),null,1),'application/json');
$('#bOpen').onclick=()=>$('#fileIn').click();
$('#fileIn').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>openJsonText(r.result);r.readAsText(f);e.target.value='';};
$('#selSpeed').onchange=e=>{Sim.speed=+e.target.value;};
$('#bSound').onclick=()=>{Audio_.sound=!Audio_.sound;Audio_.init();syncToolbar();};
$('#bTheme').onclick=()=>{const d=document.documentElement;const n=d.dataset.theme==='dark'?'light':'dark';d.dataset.theme=n;try{localStorage.setItem('pid.theme',n);}catch(e){}for(const c of allComps()){c._symS=null;}};
$('#zIn').onclick=()=>zoomAt(1.25);$('#zOut').onclick=()=>zoomAt(.8);$('#zFit').onclick=fitView;

/* ================= keyboard ================= */
document.addEventListener('keydown',e=>{const tg=e.target;const typing=tg.matches&&tg.matches('input:not([type=checkbox]):not([type=range]),textarea,select');const mod=e.ctrlKey||e.metaKey;
  if(typing){if(e.key==='Escape')tg.blur();return;}
  if(e.key==='/'&&!mod){e.preventDefault();$('#pSearch').focus();$('#pSearch').select();return;}
  if(e.key===' '){e.preventDefault();togglePlay();return;}
  if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();deleteSel();return;}
  if(e.key==='Escape'){setSelection([],[]);return;}
  if(mod){const k=e.key.toLowerCase();
    if(k==='a'){e.preventDefault();selectAll();}else if(k==='c'){e.preventDefault();copySel();}else if(k==='x'){e.preventDefault();cutSel();}else if(k==='v'){e.preventDefault();pasteClip();}
    else if(k==='d'){e.preventDefault();dupSel();}else if(k==='l'){e.preventDefault();lockSel();}
    else if(e.shiftKey&&e.key==='PageUp'){e.preventDefault();movePage(doc.cur,-1);}else if(e.shiftKey&&e.key==='PageDown'){e.preventDefault();movePage(doc.cur,1);}return;}
  if(e.key==='PageUp'){e.preventDefault();switchPage(doc.cur-1);}else if(e.key==='PageDown'){e.preventDefault();switchPage(doc.cur+1);}});

/* ================= HUD, banners ================= */
function updateHud(){const f=(v,d=1)=>(v<0&&Math.abs(v)<5e-4?0:v).toFixed(d);
  $('#hud').innerHTML=`<span><b>Total in</b>${f(Sim.tIn)} L</span><span><b>Drained</b>${f(Sim.drained)} L</span><span><b>Overflowed</b>${f(Sim.over)} L</span><span><b>Fixed-level exchange</b>${f(Sim.fixx)} L</span><span><b>Inventory Δ</b>${f(Sim.invChange)} L</span><span><b>Mass-balance error</b>${f(Sim.err,3)} L</span>`;
  $('#clock').textContent=fmtClock(Sim.t);}


/* ================= dockable panels (pin / auto-hide / hide) ================= */
const DOCK={pal:'pinned',insp:'pinned',alm:'pinned'};
try{Object.assign(DOCK,JSON.parse(localStorage.getItem('pid.dock')||'{}'));}catch(e){}for(const k in DOCK)if(DOCK[k]!=='pinned')DOCK[k]='auto';
const DOCKEL={pal:'#palette',insp:'#inspector',alm:'#alarmpanel'};
function applyDock(){for(const k in DOCKEL){const el=$(DOCKEL[k]);const m=DOCK[k];
    if(k==='alm'){el.classList.toggle('alm-collapsed',m==='hidden');el.classList.toggle('dock-auto',m==='auto');}
    else{el.classList.toggle('dock-hidden',m==='hidden');el.classList.toggle('dock-auto',m==='auto');}
    el.classList.remove('open');
    $$(`[data-dock=${k}][data-d=pin]`).forEach(b=>{b.classList.toggle('unpinned',m!=='pinned');b.title=m==='pinned'?'Pinned (stays visible) — click to auto-hide':'Unpinned (auto-hides) — click to pin';});}
  $$('[data-dock=alm][data-d=hide]').forEach(b=>{b.textContent=DOCK.alm==='hidden'?'▲':'▼';b.title=DOCK.alm==='hidden'?'Show list':'Hide list';});
  $('#main').classList.toggle('pal-away',DOCK.pal!=='pinned');$('#main').classList.toggle('insp-away',DOCK.insp!=='pinned');
  $('#edgePal').textContent=DOCK.pal==='hidden'?'▶ Components':'▶ Components (auto-hide)';$('#edgeInsp').textContent=DOCK.insp==='hidden'?'Inspector ◀':'Inspector (auto-hide) ◀';
  try{localStorage.setItem('pid.dock',JSON.stringify(DOCK));}catch(e){}setTimeout(()=>applyView(),200);}
document.addEventListener('click',e=>{const b=e.target.closest('[data-dock]');if(!b)return;const k=b.dataset.dock;
  if(b.dataset.d==='pin')DOCK[k]=DOCK[k]==='pinned'?'auto':'pinned';
  applyDock();});
for(const[edge,k]of[['#edgePal','pal'],['#edgeInsp','insp']]){const eg=$(edge),pn=$(DOCKEL[k]);let t=null;
  const open=()=>{clearTimeout(t);if(DOCK[k]==='auto')pn.classList.add('open');};const close=()=>{clearTimeout(t);t=setTimeout(()=>{if(DOCK[k]==='auto'&&!pn.contains(document.activeElement)&&!(pn.matches(':hover')))pn.classList.remove('open');},350);};
  eg.addEventListener('mouseenter',open);eg.addEventListener('click',()=>{DOCK[k]='pinned';applyDock();});pn.addEventListener('mouseenter',open);pn.addEventListener('mouseleave',close);pn.addEventListener('focusout',close);}
{const ap=$('#alarmpanel');let t=null;const open=()=>{clearTimeout(t);if(DOCK.alm==='auto')ap.classList.add('open');};
  ap.addEventListener('mouseenter',open);ap.addEventListener('mouseleave',()=>{clearTimeout(t);t=setTimeout(()=>{if(!ap.matches(':hover'))ap.classList.remove('open');},350);});
}

/* ================= alarm list ================= */
const AL={active:new Map(),hist:[],ref:null,tab:'act'};
function updateAlarmList(){if(Sim.alarms===AL.ref&&AL.dirty===false)return;AL.ref=Sim.alarms;AL.dirty=false;
  const now=new Map();for(const a of Sim.alarms){const k=a.pg+'|'+a.txt;if(!now.has(k))now.set(k,a);}
  for(const[k,a]of now){const sp=a.txt.indexOf(' ');const key=a.txt.slice(0,sp)+a.txt.slice(sp).replace(/\d+(\.\d+)?/g,'#');const old=[...AL.active.values()].find(x=>x.key===key&&x.pg===a.pg);
    if(old){old.txt=a.txt;old.live=true;old.lvl=a.lvl;}else{const r={key,pg:a.pg,txt:a.txt,lvl:a.lvl,t0:Sim.t,live:true};AL.active.set(key+'|'+a.pg,r);AL.hist.unshift({t:Sim.t,pg:a.pg,txt:a.txt,lvl:a.lvl,st:'ACTIVE'});}}
  for(const[k,r]of[...AL.active]){if(!r.live){AL.active.delete(k);AL.hist.unshift({t:Sim.t,pg:r.pg,txt:r.txt,lvl:r.lvl,st:'CLEARED'});}else r.live=false;}
  if(AL.hist.length>200)AL.hist.length=200;renderAlarmList();}
function pgTitle(id){const p=doc.pages.find(q=>q.id===id);return p?p.title:'?';}
function renderAlarmList(){const act=[...AL.active.values()];const red=act.filter(a=>a.lvl==='red').length,amb=act.length-red;
  $('#almCount').textContent=act.length;$('#almBar').classList.toggle('hasred',red>0);$('#almBar').classList.toggle('hasamber',!red&&amb>0);
  $('#almSum').textContent=act.length?act.slice(0,3).map(a=>a.txt).join('  ·  '):'No active alarms';
  let h;if(AL.tab==='act'){h=act.length?`<table><tr><th>Since</th><th>Level</th><th>Page</th><th>Alarm</th></tr>${act.sort((x,y)=>(x.lvl==='red'?0:1)-(y.lvl==='red'?0:1)||x.t0-y.t0).map(a=>`<tr data-tag="${esc(a.txt.split(' ')[0])}" data-pg="${a.pg}"><td>${fmtClock(a.t0)}</td><td class="l-${a.lvl}">${a.lvl==='red'?'HIGH':'WARN'}</td><td>${esc(pgTitle(a.pg))}</td><td>${esc(a.txt)}</td></tr>`).join('')}</table>`:'<div class="almempty">No active alarms.</div>';}
  else h=AL.hist.length?`<table><tr><th>Time</th><th>State</th><th>Page</th><th>Alarm</th></tr>${AL.hist.map(a=>`<tr data-tag="${esc(a.txt.split(' ')[0])}" data-pg="${a.pg}"><td>${fmtClock(a.t)}</td><td class="${a.st==='ACTIVE'?'l-'+a.lvl:'l-ok'}">${a.st}</td><td>${esc(pgTitle(a.pg))}</td><td>${esc(a.txt)}</td></tr>`).join('')}</table>`:'<div class="almempty">No alarm events yet.</div>';
  const b=$('#almBody');if(b._h!==h){b._h=h;b.innerHTML=h;}}
$('#almBody').addEventListener('click',e=>{const r=e.target.closest('tr[data-tag]');if(!r)return;const i=doc.pages.findIndex(p=>p.id===r.dataset.pg);if(i<0)return;if(i!==doc.cur)switchPage(i);
  const c=page().comps.find(q=>q.tag===r.dataset.tag);if(c)setSelection([c.id],[]);});
$('#almBar').addEventListener('click',e=>{const b=e.target.closest('[data-atab]');if(!b)return;AL.tab=b.dataset.atab;$$('[data-atab]').forEach(x=>x.classList.toggle('on',x===b));$('#almBody')._h=null;renderAlarmList();});
const _resetAll=resetAll;resetAll=function(){_resetAll();AL.active.clear();AL.hist=[];AL.dirty=true;renderAlarmList();};
applyDock();renderAlarmList();
