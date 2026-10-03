'use strict';
/* ================= canvas rendering & interaction ================= */
const svg=$('#cv'),gView=$('#view'),gSheet=$('#gSheet'),gConns=$('#gConns'),gComps=$('#gComps'),gOver=$('#gOver'),gridRect=$('#gridRect');
const V={sel:new Set(),selW:new Set(),mode:null,clip:null,pasteN:0,hover:null};
let onSelectionChange=()=>{},onDocChange=()=>{};
const mk=(tag,attrs={},html)=>{const e=document.createElementNS(NS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);if(html!=null)e.innerHTML=html;return e;};
const selComps=()=>page().comps.filter(c=>V.sel.has(c.id));
const connsOf=c=>page().conns.filter(w=>w.from.c===c.id||w.to.c===c.id);
function portWired(c,pid){for(const w of c._pg.conns)if((w.from.c===c.id&&w.from.p===pid)||(w.to.c===c.id&&w.to.p===pid))return true;return false;}

/* ---- view transform ---- */
function applyView(){const v=page().view;gView.setAttribute('transform',`translate(${v.x} ${v.y}) scale(${v.k})`);gridRect.style.display=v.k<0.45?'none':'';}
function zoomAt(f,cx,cy){const v=page().view;const r=svg.getBoundingClientRect();if(cx==null){cx=r.width/2;cy=r.height/2;}const nk=clamp(v.k*f,0.12,3.5);const wx=(cx-v.x)/v.k,wy=(cy-v.y)/v.k;v.k=nk;v.x=cx-wx*nk;v.y=cy-wy*nk;applyView();}
function fitView(){const pg=page(),v=pg.view;const r=svg.getBoundingClientRect();const sh=sheetDims(pg);
  if(sh){const k=Math.min((r.width-30)/sh.w,(r.height-30)/sh.h);v.k=clamp(k,0.12,3.5);v.x=15;v.y=15;}
  else{const b=bbox(pg.comps);if(!b){v.k=1;v.x=40;v.y=40;}else{const w=b.x1-b.x0+120,h=b.y1-b.y0+120;const k=clamp(Math.min(r.width/w,r.height/h),0.12,2);v.k=k;v.x=(r.width-(b.x1-b.x0)*k)/2-b.x0*k;v.y=(r.height-(b.y1-b.y0)*k)/2-b.y0*k;}}
  applyView();}

/* ---- sheet ---- */
function renderSheet(){const pg=page(),sh=sheetDims(pg);gSheet.innerHTML='';if(!sh)return;const{w,h,m}=sh;const idx=doc.pages.indexOf(pg)+1,n=doc.pages.length;
  let s=`<rect class="s-sheet-bg" x="0" y="0" width="${w}" height="${h}"/><rect class="s-sheet-line" x="0.75" y="0.75" width="${w-1.5}" height="${h-1.5}" style="stroke-width:.8"/><rect class="s-sheet-line" x="${m}" y="${m}" width="${w-2*m}" height="${h-2*m}"/>`;
  const zx=Math.max(2,Math.round((w-2*m)/200)),zy=Math.max(2,Math.round((h-2*m)/200));
  for(let i=0;i<=zx;i++){const x=m+(w-2*m)*i/zx;s+=`<line class="s-sheet-thin" x1="${x}" x2="${x}" y1="${m-14}" y2="${m}"/><line class="s-sheet-thin" x1="${x}" x2="${x}" y1="${h-m}" y2="${h-m+14}"/>`;
    if(i<zx){const cx=x+(w-2*m)/zx/2;s+=`<text class="s-sheet-txt" style="font-size:11px" x="${cx}" y="${m-18}" text-anchor="middle">${i+1}</text><text class="s-sheet-txt" style="font-size:11px" x="${cx}" y="${h-m+27}" text-anchor="middle">${i+1}</text>`;}}
  for(let i=0;i<=zy;i++){const y=m+(h-2*m)*i/zy;s+=`<line class="s-sheet-thin" y1="${y}" y2="${y}" x1="${m-14}" x2="${m}"/><line class="s-sheet-thin" y1="${y}" y2="${y}" x1="${w-m}" x2="${w-m+14}"/>`;
    if(i<zy){const cy=y+(h-2*m)/zy/2+4;const L=String.fromCharCode(65+i);s+=`<text class="s-sheet-txt" style="font-size:11px" x="${m-20}" y="${cy}" text-anchor="middle">${L}</text><text class="s-sheet-txt" style="font-size:11px" x="${w-m+20}" y="${cy}" text-anchor="middle">${L}</text>`;}}
  s+=`<text class="s-sheet-txt" style="font-size:18px;font-weight:600" x="${w/2}" y="${m-16}" text-anchor="middle">${esc(pg.title)}</text>`;
  s+=`<text class="s-sheet-txt" style="font-size:11px" x="${m+6}" y="${h-m+27}">SHEET ${idx} OF ${n}</text>`;
  const bw=380,bh=96,bx=w-m-bw,by=h-m-bh;
  s+=`<rect class="s-sheet-line" x="${bx}" y="${by}" width="${bw}" height="${bh}"/><line class="s-sheet-thin" x1="${bx}" x2="${bx+bw}" y1="${by+40}" y2="${by+40}"/><line class="s-sheet-thin" x1="${bx}" x2="${bx+bw}" y1="${by+68}" y2="${by+68}"/><line class="s-sheet-thin" x1="${bx+bw/2}" x2="${bx+bw/2}" y1="${by+40}" y2="${by+68}"/>
    <text class="s-sheet-txt" style="font-size:9px" x="${bx+6}" y="${by+11}">DRAWING TITLE</text><text class="s-sheet-txt" style="font-size:17px;font-weight:600" x="${bx+bw/2}" y="${by+31}" text-anchor="middle">${esc(pg.title)}</text>
    <text class="s-sheet-txt" x="${bx+8}" y="${by+59}">SHEET ${idx}/${n} · ${pg.sheet}</text><text class="s-sheet-txt" x="${bx+bw/2+8}" y="${by+59}">${new Date().toISOString().slice(0,10)}</text><text class="s-sheet-txt" style="font-size:13px;font-weight:600" x="${bx+bw/2}" y="${by+86}" text-anchor="middle">P&amp;ID Designer</text>`;
  gSheet.innerHTML=s;}
function outsideCount(pg){const sh=sheetDims(pg);if(!sh)return 0;let n=0;for(const c of pg.comps){const[w,h]=dims(c);if(c.x<sh.m||c.y<sh.m||c.x+w>sh.w-sh.m||c.y+h>sh.h-sh.m)n++;}return n;}

/* ---- components ---- */
const lampSvg=()=>`<g data-ui="1" class="lock"><rect x="-2" y="4" width="10" height="8" rx="1.5" class="s-lock"/><path d="M0 4 V1.5 a3 3 0 0 1 6 0 V4" fill="none" stroke="var(--muted)" stroke-width="1.5"/></g>`;
function portsHTML(c){const T=TYPES[c.type];let h='';
  for(const p of portList(c)){const wired=portWired(c,p.id);if(p.off&&!wired)continue;const faint=p.off?' faint':'';const x=p.x,y=p.y;
    const dcls=p.dir==='tap'?'tap':p.dir;
    let shape;if(p.kind==='pipe')shape=`<circle class="s-port pipe ${dcls}${faint}" cx="${x}" cy="${y}" r="${p.dir==='tap'?4:5}"/>`;
    else if(p.kind==='disc')shape=`<path class="s-port disc ${p.dir}${faint}" d="M${x} ${y-6} L${x+6} ${y} L${x} ${y+6} L${x-6} ${y} Z"/>`;
    else shape=`<rect class="s-port ana ${p.dir}${faint}" x="${x-4.5}" y="${y-4.5}" width="9" height="9"/>`;
    h+=`<circle class="s-hit" data-cid="${c.id}" data-pid="${p.id}" cx="${x}" cy="${y}" r="9"/>${shape}`;
    if(p.label){let tx,ty,an;
      if(T.plin){({l:()=>{tx=x+10;ty=y+3;an='start'},r:()=>{tx=x-10;ty=y+3;an='end'},t:()=>{tx=x;ty=y+14;an='middle'},b:()=>{tx=x;ty=y-8;an='middle'}})[p.side]();}
      else({l:()=>{tx=x-7;ty=y-5;an='end'},r:()=>{tx=x+7;ty=y-5;an='start'},t:()=>{tx=x+3;ty=y-7;an='start'},b:()=>{tx=x+3;ty=y+14;an='start'}})[p.side]();
      h+=`<text class="s-pl${faint}" x="${tx}" y="${ty}" text-anchor="${an}" pointer-events="none">${esc(p.label)}</text>`;}}
  return h;}
function labelSide(c){const sides=new Set(portList(c).filter(p=>!p.off||portWired(c,p.id)).map(p=>p.side));const cand=c.orient==='v'?['r','l','b','t']:['b','t','r','l'];return cand.find(s=>!sides.has(s))||cand[0];}
function labelHTML(c){const T=TYPES[c.type];const L=T.label(c);if(!L.length)return'';const[W,Hh]=dims(c);const side=c._ls||(c._ls=labelSide(c));const n=L.length;let h='';
  L.forEach((q,i)=>{let x,y,an;if(side==='b'){x=W/2;y=Hh+14+i*12;an='middle';}else if(side==='t'){x=W/2;y=-8-(n-1-i)*12;an='middle';}else if(side==='r'){x=W+8;y=12+i*12;an='start';}else{x=-8;y=12+i*12;an='end';}
    h+=`<text class="s-${q[1]}" x="${x}" y="${y}" text-anchor="${an}" pointer-events="none">${esc(q[0])}</text>`;});return h;}
function buildComp(c){const T=TYPES[c.type];const[W,Hh]=dims(c);c._ls=null;
  const g=mk('g',{class:'s-comp'+(c.locked?' locked':''),'data-cid':c.id,transform:`translate(${c.x} ${c.y})`});
  g.innerHTML=`<rect x="-4" y="-4" width="${W+8}" height="${Hh+8}" fill="transparent"/><g class="sym"></g><g class="ports">${portsHTML(c)}</g><g class="lbl"></g><rect data-ui="1" class="s-sel" x="-5" y="-5" width="${W+10}" height="${Hh+10}" rx="3" style="display:none;pointer-events:none"/><g data-ui="1" transform="translate(${W-12} -14)" style="${c.locked?'':'display:none'}">${lampSvg()}</g>`;
  c._g=g;c._gs=g.children[1];c._gl=g.children[3];c._gsel=g.children[4];c._glock=g.children[5];c._symS=null;c._labS=null;
  if(V.sel.has(c.id))c._gsel.style.display='';
  return g;}
function renderComp(c,deep=true){ensureNet();const old=c._g;const g=buildComp(c);if(old&&old.parentNode)old.parentNode.replaceChild(g,old);else gComps.appendChild(g);liveComp(c);
  if(deep)for(const w of connsOf(c))rebuildConn(w);drawAnchors();}
function liveComp(c){const T=TYPES[c.type];if(!c.s)resetRuntime(c);const s=T.sym(c);if(s!==c._symS){c._symS=s;c._gs.innerHTML=s;}
  if(!T.inLabel){const l=labelHTML(c);if(l!==c._labS){c._labS=l;c._gl.innerHTML=l;}}}

/* ---- connections ---- */
function buildConn(w){const pts=connPoints(w);if(!pts)return null;const d=ptsD(pts);w._pts=pts;
  const ca=byId.get(w.from.c),cb=byId.get(w.to.c);const pa=portPos(ca,w.from.p),pb=portPos(cb,w.to.p);const tap=pa.dir==='tap'||pb.dir==='tap';
  const g=mk('g',{class:'s-conn'+(V.selW.has(w.id)?' sel':''),'data-wid':w.id});
  const faint=(pa.off||pb.off)?' s-faint':'';
  let h=`<path class="s-wire-hit" d="${d}"/>`;
  if(w.kind==='pipe'&&!tap)h+=`<path class="s-pipe-case${faint}" d="${d}"/><path class="s-pipe-in" d="${d}" style="stroke:var(--pipe-empty)"/><path class="s-pipe-flow s-flow" d="${d}" style="display:none"/>`;
  else if(w.kind==='pipe')h+=`<path class="s-ln" d="${d}" style="stroke-width:1.6"/>`;
  else if(w.kind==='disc')h+=`<path class="s-disc${faint}" d="${d}" style="stroke:var(--pipe-empty)"/>`;
  else{const m=polyMid(pts);h+=`<path class="s-ana${faint}" d="${d}"/><text class="s-wlab${faint}" x="${m.x}" y="${m.y-4}" text-anchor="middle">--</text>`;}
  g.innerHTML=h;w._el=g;w._cs='';return g;}
function rebuildConn(w){const old=w._el;const g=buildConn(w);if(!g){if(old)old.remove();return;}if(old&&old.parentNode)old.parentNode.replaceChild(g,old);else gConns.appendChild(g);liveConn(w);}
function liveConn(w){const g=w._el;if(!g)return;let key;
  if(w.kind==='pipe'){const e=w._e;if(!e)return;const flowing=Math.abs(e.Q)>0.004;const fwd=e.Q>=0;const n=fwd?e.a:e.b;let comp=n.comp;if(w.fluid!=null&&w.fluid!==''&&+w.fluid>=0&&fwd)comp=PURE[clamp(+w.fluid,0,NF-1)];
    const wet=e.a.wet||flowing;let col;if(!wet)col='var(--pipe-empty)';else col=compColor(comp,flowing?0:.62)||'var(--pale)';key=col+flowing;
    if(key!==w._cs){w._cs=key;g.children[2].style.stroke=col;g.children[3].style.display=flowing?'':'none';}}
  else if(w.kind==='disc'){const v=sig[w.from.c+'.'+w.from.p]>0.5;key=v?'1':'0';if(key!==w._cs){w._cs=key;g.children[1].style.stroke=v?'var(--disc)':'var(--pipe-empty)';g.children[1].style.strokeWidth=v?3:2;}}
  else{const v=sig[w.from.c+'.'+w.from.p];key=v==null?'--':v.toFixed(1);if(key!==w._cs){w._cs=key;g.children[2].textContent=key;}}}
function rebuildAllConns(){gConns.innerHTML='';for(const w of page().conns){const g=buildConn(w);if(g)gConns.appendChild(g);}ensureNet();for(const w of page().conns)liveConn(w);}
function drawAnchors(){gOver.querySelectorAll('.anc').forEach(e=>e.remove());
  for(const id of V.selW){const w=page().conns.find(q=>q.id===id);if(!w||!w.anchors)continue;w.anchors.forEach((a,i)=>gOver.appendChild(mk('rect',{class:'s-anchor anc','data-anchor':i,'data-wid':w.id,x:a.x-4,y:a.y-4,width:8,height:8})));}}

/* ---- full render ---- */
function renderAll(){ensureNet();applyView();renderSheet();gComps.innerHTML='';for(const c of page().comps)gComps.appendChild(buildComp(c));rebuildAllConns();for(const c of page().comps)liveComp(c);drawAnchors();}
function setSelection(comps,conns){V.sel=new Set(comps||[]);V.selW=new Set(conns||[]);for(const c of page().comps)c._gsel.style.display=V.sel.has(c.id)?'':'none';
  gConns.querySelectorAll('.s-conn').forEach(g=>g.classList.toggle('sel',V.selW.has(g.getAttribute('data-wid'))));drawAnchors();onSelectionChange();}

/* ---- per-frame live update ---- */
function updateLive(){ensureNet();const pg=page();for(const c of pg.comps)liveComp(c);for(const w of pg.conns)liveConn(w);}

/* ---- edit operations ---- */
function addComp(type,x,y,select=true){const c=makeComp(type,x,y);let[w,h]=baseSize(c);c.x=snap(x-w/2);c.y=snap(y-h/2);const T=TYPES[type];
  Sim.rebase(()=>{page().comps.push(c);});c._pg=page();dirtyNet();reindex();ensureNet();gComps.appendChild(buildComp(c));liveComp(c);
  if(select)setSelection([c.id],[]);onDocChange();return c;}
function removeConn(id){const pg=page();const i=pg.conns.findIndex(w=>w.id===id);if(i<0)return;const w=pg.conns[i];w._el&&w._el.remove();pg.conns.splice(i,1);}
function deleteSel(){const pg=page();const del=selComps().filter(c=>!c.locked);const ids=new Set(del.map(c=>c.id));let nl=selComps().length-del.length;
  const wd=new Set(V.selW);for(const w of pg.conns)if(ids.has(w.from.c)||ids.has(w.to.c))wd.add(w.id);
  if(!del.length&&!wd.size){if(nl)toast('Locked items cannot be deleted');return;}
  for(const id of wd)removeConn(id);
  Sim.rebase(()=>{for(const c of del){c._g.remove();pg.comps.splice(pg.comps.indexOf(c),1);}});
  if(nl)toast(nl+' locked item(s) kept');dirtyNet();reindex();setSelection([],[]);for(const c of pg.comps)renderComp(c,false);rebuildAllConns();onDocChange();}
const serComp=c=>({id:c.id,type:c.type,tag:c.tag,x:c.x,y:c.y,orient:c.orient,locked:!!c.locked,p:clone(c.p)});
function copySel(){const cs=selComps();if(!cs.length){toast('Nothing selected');return false;}const ids=new Set(cs.map(c=>c.id));
  V.clip={comps:cs.map(serComp),conns:page().conns.filter(w=>ids.has(w.from.c)&&ids.has(w.to.c)).map(w=>clone({kind:w.kind,from:w.from,to:w.to,anchors:w.anchors||[],cond:w.cond,fluid:w.fluid}))};V.pasteN=0;toast('Copied '+cs.length+' item(s)');return true;}
function cutSel(){if(copySel())deleteSel();}
function pasteClip(offsetBase=0){if(!V.clip){toast('Clipboard is empty');return;}V.pasteN++;const off=40*V.pasteN+offsetBase;const map={};const used=usedTags();const pg=page();const nc=[];
  for(const o of V.clip.comps){const c=clone(o);c.id=uid();map[o.id]=c.id;c.x=snap(c.x+off);c.y=snap(c.y+off);c.locked=false;
    if(TYPES[c.type].notag){c.tag=c.tag||'NOTE';}else{c.tag=retag(c.tag,used);used.add(c.tag);}
    c._pg=pg;resetRuntime(c);Sim.rebase(()=>{pg.comps.push(c);});nc.push(c);}
  for(const w of V.clip.conns){const q=clone(w);q.id=uid();q.from.c=map[w.from.c];q.to.c=map[w.to.c];q.anchors=(q.anchors||[]).map(a=>({x:a.x+off,y:a.y+off}));pg.conns.push(q);}
  dirtyNet();reindex();ensureNet();for(const c of nc)gComps.appendChild(buildComp(c));rebuildAllConns();for(const c of nc)liveComp(c);setSelection(nc.map(c=>c.id),[]);onDocChange();checkOutside();}
function dupSel(){if(!copySel())return;V.pasteN=0;pasteClip();}
function lockSel(){const cs=selComps();if(!cs.length)return;const all=cs.every(c=>c.locked);cs.forEach(c=>c.locked=!all);cs.forEach(c=>renderComp(c,false));onSelectionChange();onDocChange();}
function lockAll(){const cs=page().comps;const all=cs.every(c=>c.locked);cs.forEach(c=>{c.locked=!all;renderComp(c,false);});onSelectionChange();onDocChange();toast(all?'All components unlocked':'All components locked');}
function selectAll(){setSelection(page().comps.map(c=>c.id),[]);}
function checkOutside(){const n=outsideCount(page());if(n)toast(`${n} component(s) outside the sheet border`);}

/* ---- connect ---- */
function canConnect(a,b){if(a.c===b.c)return null;const ca=byId.get(a.c),cb=byId.get(b.c);if(!ca||!cb)return null;const pa=portPos(ca,a.p),pb=portPos(cb,b.p);if(!pa||!pb||pa.off||pb.off)return null;
  if(pa.kind!==pb.kind)return null;
  if(pa.dir==='tap'||pb.dir==='tap'){if(pa.dir==='tap'&&pb.dir==='tap')return null;return{from:a,to:b,kind:'pipe'};}
  if(pa.dir===pb.dir)return null;const[f,t]=pa.dir==='out'?[a,b]:[b,a];return{from:f,to:t,kind:pa.kind};}
function connect(a,b){const r=canConnect(a,b);if(!r){toast('Cannot connect those ports');return null;}const pg=page();
  const dup=pg.conns.find(w=>w.from.c===r.from.c&&w.from.p===r.from.p&&w.to.c===r.to.c&&w.to.p===r.to.p);if(dup)return dup;
  const tapEnd=[r.from,r.to].find(e=>portPos(byId.get(e.c),e.p).dir==='tap');
  if(tapEnd)for(const w of [...pg.conns])if((w.from.c===tapEnd.c&&w.from.p===tapEnd.p)||(w.to.c===tapEnd.c&&w.to.p===tapEnd.p))removeConn(w.id);
  if(r.kind==='ana')for(const w of [...pg.conns])if(w.to.c===r.to.c&&w.to.p===r.to.p)removeConn(w.id);
  const w={id:uid(),kind:r.kind,from:{c:r.from.c,p:r.from.p},to:{c:r.to.c,p:r.to.p},anchors:[],cond:50,fluid:-1};pg.conns.push(w);dirtyNet();ensureNet();
  for(const id of new Set([r.from.c,r.to.c]))renderComp(byId.get(id),false);rebuildAllConns();drawAnchors();onDocChange();return w;}

/* ---- pointer interaction ---- */
function toWorld(ev){const r=svg.getBoundingClientRect();const v=page().view;return{x:(ev.clientX-r.left-v.x)/v.k,y:(ev.clientY-r.top-v.y)/v.k};}
function moveCompsTo(m,dx,dy){for(const[c,o]of m.orig){c.x=o.x+dx;c.y=o.y+dy;c._g.setAttribute('transform',`translate(${c.x} ${c.y})`);}
  for(const[w,an]of m.anchors){w.anchors=an.map(a=>({x:a.x+dx,y:a.y+dy}));}
  const ws=new Set();for(const[c]of m.orig)for(const w of connsOf(c))ws.add(w);for(const w of ws)rebuildConn(w);}
svg.addEventListener('pointerdown',ev=>{if(ev.button===2)return;const t=ev.target;const w0=toWorld(ev);closeEdit();
  if(ev.button===1){V.mode={t:'pan',sx:ev.clientX,sy:ev.clientY,ox:page().view.x,oy:page().view.y};svg.setPointerCapture(ev.pointerId);svg.classList.add('panning');ev.preventDefault();return;}
  const pe=t.closest&&t.closest('[data-pid]'),an=t.closest&&t.closest('[data-anchor]'),ce=t.closest&&t.closest('[data-cid]'),we=t.closest&&t.closest('[data-wid]');
  svg.setPointerCapture(ev.pointerId);
  if(pe){const c=byId.get(pe.dataset.cid);const p=portPos(c,pe.dataset.pid);V.mode={t:'wire',from:{c:c.id,p:pe.dataset.pid},start:p,tmp:mk('path',{class:'s-ln',style:'stroke:var(--accent);stroke-dasharray:5 3',d:''})};gOver.appendChild(V.mode.tmp);return;}
  if(an){V.mode={t:'anchor',wid:an.dataset.wid,idx:+an.dataset.anchor};return;}
  if(ce){const c=byId.get(ce.dataset.cid);const multi=ev.shiftKey||ev.ctrlKey||ev.metaKey;
    if(multi){const s=new Set(V.sel);if(s.has(c.id))s.delete(c.id);else s.add(c.id);setSelection([...s],[...V.selW]);}
    else if(!V.sel.has(c.id))setSelection([c.id],[]);
    const mv=selComps().filter(q=>!q.locked);const ids=new Set(mv.map(q=>q.id));const anch=new Map();
    for(const w of page().conns)if(ids.has(w.from.c)&&ids.has(w.to.c)&&w.anchors&&w.anchors.length)anch.set(w,w.anchors.map(a=>({...a})));
    V.mode={t:'drag',start:w0,orig:new Map(mv.map(q=>[q,{x:q.x,y:q.y}])),anchors:anch,moved:false,sx:ev.clientX,sy:ev.clientY};return;}
  if(we){const id=we.dataset.wid;const multi=ev.shiftKey||ev.ctrlKey||ev.metaKey;const s=new Set(multi?V.selW:[]);if(s.has(id)&&multi)s.delete(id);else s.add(id);setSelection(multi?[...V.sel]:[],[...s]);V.mode={t:'none'};return;}
  if(ev.shiftKey){V.mode={t:'box',start:w0,rect:mk('rect',{class:'s-box',x:w0.x,y:w0.y,width:0,height:0})};gOver.appendChild(V.mode.rect);return;}
  V.mode={t:'pan',sx:ev.clientX,sy:ev.clientY,ox:page().view.x,oy:page().view.y,moved:false,clear:true};svg.classList.add('panning');});
svg.addEventListener('pointermove',ev=>{const m=V.mode;if(!m)return;
  if(m.t==='pan'){const dx=ev.clientX-m.sx,dy=ev.clientY-m.sy;if(Math.abs(dx)+Math.abs(dy)>3)m.moved=true;const v=page().view;v.x=m.ox+dx;v.y=m.oy+dy;applyView();}
  else if(m.t==='drag'){if(!m.moved&&Math.abs(ev.clientX-m.sx)+Math.abs(ev.clientY-m.sy)<4)return;m.moved=true;const w=toWorld(ev);moveCompsTo(m,snap(w.x-m.start.x),snap(w.y-m.start.y));drawAnchors();}
  else if(m.t==='wire'){const w=toWorld(ev);m.tmp.setAttribute('d',`M${m.start.x} ${m.start.y} L${w.x} ${w.y}`);}
  else if(m.t==='anchor'){const wc=page().conns.find(q=>q.id===m.wid);if(!wc)return;const w=toWorld(ev);wc.anchors[m.idx]={x:snap(w.x,10),y:snap(w.y,10)};rebuildConn(wc);drawAnchors();}
  else if(m.t==='box'){const w=toWorld(ev);const x=Math.min(w.x,m.start.x),y=Math.min(w.y,m.start.y);m.rect.setAttribute('x',x);m.rect.setAttribute('y',y);m.rect.setAttribute('width',Math.abs(w.x-m.start.x));m.rect.setAttribute('height',Math.abs(w.y-m.start.y));}});
svg.addEventListener('pointerup',ev=>{const m=V.mode;V.mode=null;svg.classList.remove('panning');if(!m)return;try{svg.releasePointerCapture(ev.pointerId);}catch(e){}
  if(m.t==='pan'&&m.clear&&!m.moved)setSelection([],[]);
  else if(m.t==='drag'&&m.moved){onDocChange();checkOutside();}
  else if(m.t==='anchor')onDocChange();
  else if(m.t==='wire'){m.tmp.remove();const el=document.elementFromPoint(ev.clientX,ev.clientY);const pe=el&&el.closest&&el.closest('[data-pid]');if(pe)connect(m.from,{c:pe.dataset.cid,p:pe.dataset.pid});}
  else if(m.t==='box'){const w=toWorld(ev);m.rect.remove();const x0=Math.min(w.x,m.start.x),x1=Math.max(w.x,m.start.x),y0=Math.min(w.y,m.start.y),y1=Math.max(w.y,m.start.y);
    const hit=page().comps.filter(c=>{const[cw,ch]=dims(c);return c.x<x1&&c.x+cw>x0&&c.y<y1&&c.y+ch>y0;}).map(c=>c.id);setSelection([...new Set([...V.sel,...hit])],[]);}});
svg.addEventListener('pointercancel',()=>{if(V.mode&&V.mode.tmp)V.mode.tmp.remove();if(V.mode&&V.mode.rect)V.mode.rect.remove();V.mode=null;svg.classList.remove('panning');});
svg.addEventListener('wheel',ev=>{ev.preventDefault();const r=svg.getBoundingClientRect();zoomAt(Math.pow(1.0015,-ev.deltaY),ev.clientX-r.left,ev.clientY-r.top);},{passive:false});
svg.addEventListener('contextmenu',ev=>ev.preventDefault());
function polyParam(pts,p){let best=1e18,bt=0,acc=0;for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i];const dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy)||1;let t=((p.x-a.x)*dx+(p.y-a.y)*dy)/(L*L);t=clamp(t,0,1);const qx=a.x+dx*t,qy=a.y+dy*t;const d=Math.hypot(p.x-qx,p.y-qy);if(d<best){best=d;bt=acc+t*L;}acc+=L;}return bt;}
svg.addEventListener('dblclick',ev=>{const t=ev.target;const an=t.closest('[data-anchor]');
  if(an){const w=page().conns.find(q=>q.id===an.dataset.wid);if(w){w.anchors.splice(+an.dataset.anchor,1);rebuildConn(w);drawAnchors();onDocChange();}return;}
  const ce=t.closest('[data-cid]');
  if(ce&&!t.closest('[data-pid]')){const c=byId.get(ce.dataset.cid);const T=TYPES[c.type];if(T.dbl){const r=T.dbl(c);if(r==='edit')openEdit(c);else if(r){renderComp(c,false);onSelectionChange();onDocChange();}}return;}
  const we=t.closest('[data-wid]');
  if(we){const w=page().conns.find(q=>q.id===we.dataset.wid);if(!w)return;const p=toWorld(ev);const np={x:snap(p.x,10),y:snap(p.y,10)};const pts=w._pts||connPoints(w);
    const anc=w.anchors||(w.anchors=[]);const tp=polyParam(pts,np);let idx=anc.length;for(let i=0;i<anc.length;i++){if(polyParam(pts,anc[i])>tp){idx=i;break;}}anc.splice(idx,0,np);rebuildConn(w);setSelection([],[w.id]);onDocChange();}});
/* inline comment editor */
let edit=null;
function openEdit(c){closeEdit();const v=page().view;const[W,Hh]=dims(c);const ta=document.createElement('textarea');ta.value=c.p.text;
  Object.assign(ta.style,{position:'absolute',zIndex:20,left:(c.x*v.k+v.x)+'px',top:(c.y*v.k+v.y)+'px',width:Math.max(120,W*v.k)+'px',height:Math.max(50,Hh*v.k)+'px',fontSize:Math.max(10,c.p.size*v.k)+'px',fontFamily:'var(--font-ui)',resize:'both'});
  $('#canvasWrap').appendChild(ta);ta.focus();ta.select();edit={c,ta};
  ta.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){edit=null;ta.remove();}else if(e.key==='Enter'&&(e.ctrlKey||e.metaKey))closeEdit();});ta.addEventListener('blur',closeEdit);}
function closeEdit(){if(!edit)return;const{c,ta}=edit;edit=null;if(ta.parentNode){c.p.text=ta.value;ta.remove();renderComp(c,false);onSelectionChange();onDocChange();}}

/* ---- Tidy routes (orthogonal A* around component outlines) ---- */
function tidyRoutes(conns){const pg=page();const obst=pg.comps.filter(c=>c.type!=='comment').map(c=>{const[w,h]=dims(c);return{x0:c.x,y0:c.y,x1:c.x+w,y1:c.y+h};});
  const b=bbox(pg.comps);if(!b)return 0;const G=20,pad=120;const sh=sheetDims(pg);const bx0=sh?Math.min(b.x0-40,sh.m):b.x0-pad,by0=sh?Math.min(b.y0-40,sh.m):b.y0-pad,bx1=sh?Math.max(b.x1+40,sh.w-sh.m):b.x1+pad,by1=sh?Math.max(b.y1+40,sh.h-sh.m):b.y1+pad;const gx0=Math.floor(bx0/G),gy0=Math.floor(by0/G),gx1=Math.ceil(bx1/G),gy1=Math.ceil(by1/G);
  const GW=gx1-gx0+1,GH=gy1-gy0+1;const blocked=new Uint8Array(GW*GH);
  for(const o of obst){for(let gx=Math.ceil(o.x0/G);gx<=Math.floor(o.x1/G);gx++)for(let gy=Math.ceil(o.y0/G);gy<=Math.floor(o.y1/G);gy++){const i=(gy-gy0)*GW+(gx-gx0);if(i>=0&&i<blocked.length&&gx-gx0>=0&&gx-gx0<GW)blocked[i]=1;}}
  const used=new Map();// 'h' or 'v' usage per cell
  const DX=[1,0,-1,0],DY=[0,1,0,-1];const dirOf={r:0,b:1,l:2,t:3};let done=0;
  for(const w of conns){const ca=byId.get(w.from.c),cb=byId.get(w.to.c);if(!ca||!cb)continue;const a=portPos(ca,w.from.p),bb=portPos(cb,w.to.p);if(!a||!bb)continue;
    const da=DIRV[a.side],db=DIRV[bb.side];const s1={x:a.x+da[0]*20,y:a.y+da[1]*20},s2={x:bb.x+db[0]*20,y:bb.y+db[1]*20};
    const sx=s1.x/G-gx0,sy=s1.y/G-gy0,ex=s2.x/G-gx0,ey=s2.y/G-gy0;if(sx<0||sy<0||sx>=GW||sy>=GH||ex<0||ey<0||ex>=GW||ey>=GH)continue;
    const N=GW*GH*4;const dist=new Float32Array(N).fill(1e9);const prev=new Int32Array(N).fill(-1);const heap=[];
    const push=(f,s)=>{heap.push([f,s]);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(heap[p][0]<=heap[i][0])break;[heap[p],heap[i]]=[heap[i],heap[p]];i=p;}};
    const pop=()=>{const top=heap[0];const last=heap.pop();if(heap.length){heap[0]=last;let i=0;for(;;){let l=2*i+1,r=l+1,m=i;if(l<heap.length&&heap[l][0]<heap[m][0])m=l;if(r<heap.length&&heap[r][0]<heap[m][0])m=r;if(m===i)break;[heap[m],heap[i]]=[heap[i],heap[m]];i=m;}}return top;};
    const d0=dirOf[a.side];const st=(sy*GW+sx)*4+d0;dist[st]=0;push(Math.abs(sx-ex)+Math.abs(sy-ey),st);let goal=-1;
    while(heap.length){const[f,s]=pop();const d=s&3,cell=s>>2,cx=cell%GW,cy=(cell/GW)|0;if(f-(Math.abs(cx-ex)+Math.abs(cy-ey))>dist[s]+1e-3)continue;
      if(cx===ex&&cy===ey){goal=s;break;}
      for(let nd=0;nd<4;nd++){if(nd===((d+2)&3))continue;const nx=cx+DX[nd],ny=cy+DY[nd];if(nx<0||ny<0||nx>=GW||ny>=GH)continue;const ni=ny*GW+nx;if(blocked[ni]&&!(nx===ex&&ny===ey))continue;
        let cost=1+(nd!==d?6:0);const u=used.get(ni);if(u){const ax=(nd&1)?'v':'h';if(u.includes(ax))cost+=5;else cost+=1.5;}
        const ns=ni*4+nd;const nv=dist[s]+cost;if(nv<dist[ns]){dist[ns]=nv;prev[ns]=s;push(nv+Math.abs(nx-ex)+Math.abs(ny-ey),ns);}}}
    if(goal<0)continue;const cells=[];for(let s=goal;s>=0;s=prev[s])cells.push(s>>2);cells.reverse();
    const pts=cells.map(c=>({x:((c%GW)+gx0)*G,y:(((c/GW)|0)+gy0)*G}));
    for(let i=0;i<cells.length;i++){const c=cells[i];const ax=i>0&&pts[i].y===pts[i-1].y?'h':'v';used.set(c,(used.get(c)||'')+ax);}
    const corners=[];for(let i=1;i<pts.length-1;i++){const p=pts[i-1],q=pts[i],n=pts[i+1];if(!((p.x===q.x&&q.x===n.x)||(p.y===q.y&&q.y===n.y)))corners.push({x:q.x,y:q.y});}
    w.anchors=corners;done++;}
  return done;}

/* ---- PNG export ---- */
function lightVars(){const o={};for(const sh of document.styleSheets){let rules;try{rules=sh.cssRules;}catch(e){continue;}for(const r of rules){if(r.selectorText===':root'){for(let i=0;i<r.style.length;i++){const n=r.style[i];if(n.startsWith('--'))o[n]=r.style.getPropertyValue(n).trim();}}}}return o;}
const subVars=(s,o)=>s.replace(/var\((--[a-z0-9-]+)\)/gi,(m,n)=>o[n]||'#000');
async function renderPng(){const pg=page(),sh=sheetDims(pg);let x0=0,y0=0,w,h,sc;
  if(sh){w=sh.w;h=sh.h;sc=150/25.4/4;}else{const b=bbox(pg.comps);if(!b)throw new Error('Nothing to export');x0=b.x0-60;y0=b.y0-80;w=b.x1-b.x0+120;h=b.y1-b.y0+160;sc=2;}
  const lv=lightVars();let css='';for(const sheet of document.styleSheets){let rules;try{rules=sheet.cssRules;}catch(e){continue;}for(const r of rules)if(r.type===1&&/\.s-/.test(r.selectorText)&&!/animation/.test(r.cssText))css+=r.cssText+'\n';}
  const clone=gView.cloneNode(true);clone.querySelectorAll('[data-ui],.anc').forEach(e=>e.remove());const go=clone.querySelector('#gOver');if(go)go.remove();const gr=clone.querySelector('#gridRect');if(gr)gr.remove();
  clone.querySelectorAll('.s-flow').forEach(e=>e.classList.remove('s-flow'));clone.querySelectorAll('.s-conn.sel').forEach(e=>e.classList.remove('sel'));clone.removeAttribute('transform');
  let inner=new XMLSerializer().serializeToString(clone);
  const W=Math.round(w*sc),Hh=Math.round(h*sc);
  let str=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Hh}" viewBox="${x0} ${y0} ${w} ${h}"><style>${css}</style><rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#ffffff"/>${inner}</svg>`;
  str=subVars(str,lv);
  const img=new Image();await new Promise((res,rej)=>{img.onload=res;img.onerror=()=>rej(new Error('Image render failed'));img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(str);});
  const cv=document.createElement('canvas');cv.width=W;cv.height=Hh;const ctx=cv.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,W,Hh);ctx.drawImage(img,0,0,W,Hh);
  return await new Promise(r=>cv.toBlob(r,'image/png'));}
