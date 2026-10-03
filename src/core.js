'use strict';
/* ================= utilities ================= */
const NS='http://www.w3.org/2000/svg';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const clamp=(x,a,b)=>x<a?a:x>b?b:x;
const snap=(v,g=20)=>Math.round(v/g)*g;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let _u=0;const uid=()=>'i'+Date.now().toString(36)+(++_u).toString(36)+Math.random().toString(36).slice(2,5);
const fmt=(v,d=1)=>Number.isFinite(v)?v.toFixed(d):'--';
const clone=o=>JSON.parse(JSON.stringify(o));
const getp=(o,path)=>path.split('.').reduce((a,k)=>a==null?a:a[k],o);
const setp=(o,path,v)=>{const ks=path.split('.');const l=ks.pop();const t=ks.reduce((a,k)=>a[k],o);t[l]=v;};
const pad2=n=>String(Math.floor(n)).padStart(2,'0');
const fmtClock=t=>pad2(t/3600)+':'+pad2(t/60%60)+':'+pad2(t%60);
function toast(msg){const w=$('#toasts');if(!w)return;const d=document.createElement('div');d.className='toast';d.textContent=msg;w.appendChild(d);setTimeout(()=>d.remove(),2600);if(w.children.length>4)w.firstChild.remove();}

/* ================= fluids ================= */
const NF=12;
const FDEF=[['Process water','#3d8fdb'],['Cooling water','#26b5c9'],['Chilled glycol','#7fd6ee'],['Hot condensate','#e8805f'],['Fire water','#d94c4c'],['Lube oil','#c9971c'],['Diesel','#8a6d3b'],['Acid','#9ccc3c'],['Caustic','#9a5fc4'],['Wastewater','#7d8f66'],['Saturated brine','#2fbf9f'],['Depleted brine','#88c4a8']];
// rho kg/L, cp kJ/kgK, nacl g/L, naoh mass fraction
const FPROP=[{rho:1,cp:4.18,nacl:0,naoh:0},{rho:1,cp:4.18,nacl:0,naoh:0},{rho:1.05,cp:3.6,nacl:0,naoh:0},{rho:.97,cp:4.2,nacl:0,naoh:0},{rho:1,cp:4.18,nacl:0,naoh:0},{rho:.87,cp:2,nacl:0,naoh:0},{rho:.83,cp:2,nacl:0,naoh:0},{rho:1.18,cp:3,nacl:0,naoh:0},{rho:1.52,cp:3.2,nacl:0,naoh:.5},{rho:1,cp:4.1,nacl:0,naoh:0},{rho:1.2,cp:3.3,nacl:300,naoh:0},{rho:1.17,cp:3.3,nacl:210,naoh:0}];
const F_WATER=0,F_CAUSTIC=8,F_SAT=10,F_DEP=11;
const _rgb={};
function hex2rgb(h){let r=_rgb[h];if(r)return r;let s=h.replace('#','');if(s.length===3)s=s.split('').map(x=>x+x).join('');const n=parseInt(s,16)||0;return _rgb[h]=[n>>16&255,n>>8&255,n&255];}
const rgbStr=(r,g,b)=>`rgb(${r|0},${g|0},${b|0})`;
function compColor(comp,lighten=0){let r=0,g=0,b=0,s=0;for(let i=0;i<NF;i++){const f=comp[i];if(f>1e-4){const k=hex2rgb(doc.fluids[i].color);r+=f*k[0];g+=f*k[1];b+=f*k[2];s+=f;}}
  if(s<1e-6)return null;r/=s;g/=s;b/=s;if(lighten){r+=(255-r)*lighten;g+=(255-g)*lighten;b+=(255-b)*lighten;}return rgbStr(r,g,b);}
const pureComp=i=>{const a=new Float64Array(NF);a[clamp(i|0,0,NF-1)]=1;return a;};
function blendComp(i,j,pct){const a=new Float64Array(NF);const f=clamp((pct||0)/100,0,1);if(j==null||j<0||f<=0){a[clamp(i|0,0,NF-1)]=1;return a;}a[clamp(i|0,0,NF-1)]+=1-f;a[clamp(j|0,0,NF-1)]+=f;return a;}
const naclOf=c=>{let s=0;for(let i=0;i<NF;i++)s+=c[i]*FPROP[i].nacl;return s;};
const rhoOf=c=>{let s=0;for(let i=0;i<NF;i++)s+=c[i]*FPROP[i].rho;return s||1;};
const cpOf=c=>{let s=0,m=0;for(let i=0;i<NF;i++){const w=c[i]*FPROP[i].rho;s+=w*FPROP[i].cp;m+=w;}return m?s/m:4.18;};
const naohConc=c=>{let s=0;for(let i=0;i<NF;i++)s+=c[i]*FPROP[i].rho*FPROP[i].naoh;return s;}; // kg/L
const naohWt=c=>naohConc(c)/rhoOf(c)*100;
const domFluid=c=>{let b=0,k=0;for(let i=0;i<NF;i++)if(c[i]>b){b=c[i];k=i;}return k;};

/* ================= document ================= */
let doc=null;
const byId=new Map();
const newPage=title=>({id:uid(),title:title||'Drawing',sheet:'A3',orient:'landscape',view:{x:20,y:20,k:1},comps:[],conns:[]});
function newDoc(){return {v:2,fluids:FDEF.map(f=>({name:f[0],color:f[1]})),pages:[newPage('Drawing 1')],cur:0};}
const page=()=>doc.pages[doc.cur];
const allComps=()=>doc.pages.flatMap(p=>p.comps);
function reindex(){byId.clear();for(const p of doc.pages){for(const c of p.comps){byId.set(c.id,c);c._pg=p;}}}
const SHEETS={A4:[297,210],A3:[420,297]};
function sheetDims(p){if(!p.sheet||p.sheet==='none')return null;const [a,b]=SHEETS[p.sheet]||SHEETS.A3;const [w,h]=p.orient==='portrait'?[b,a]:[a,b];return {w:w*4,h:h*4,m:40};}

/* ================= tags ================= */
function usedTags(){const s=new Set();for(const c of allComps())s.add(c.tag);return s;}
function nextTag(prefix){const used=usedTags();let max=100;for(const t of used){if(t.startsWith(prefix)){const r=t.slice(prefix.length);if(/^\d+$/.test(r))max=Math.max(max,+r);}}return prefix+(max+1);}
function retag(tag,used){const m=tag.match(/^(.*?)(\d+)$/);
  if(m){const pre=m[1],w=m[2].length;let max=0;for(const t of used){const mm=t.match(/^(.*?)(\d+)$/);if(mm&&mm[1]===pre)max=Math.max(max,+mm[2]);}return pre+String(max+1).padStart(w,'0');}
  const base=tag.replace(/-\d+$/,'');let n=2;while(used.has(base+'-'+n))n++;return base+'-'+n;}
function uniqueTag(tag,self){const used=usedTags();for(const c of allComps())if(c===self)used.delete(c.tag);if(!used.has(tag))return tag;return retag(tag,used);}

/* ================= geometry ================= */
const TYPES={};const ORDER=[];
function reg(id,def){def.id=id;TYPES[id]=def;ORDER.push(id);return def;}
const P=(id,kind,dir,x,y,side,label,extra)=>Object.assign({id,kind,dir,x,y,side,label},extra||{});
const ROTSIDE={l:'t',t:'r',r:'b',b:'l'};
const baseSize=c=>TYPES[c.type].size(c);
function dims(c){const T=TYPES[c.type];const [w,h]=T.size(c);return(T.rot&&c.orient==='v')?[h,w]:[w,h];}
function portList(c){const T=TYPES[c.type];const [w,h]=T.size(c);const rot=T.rot&&c.orient==='v';
  return T.ports(c).map(p=>{if(!rot)return {...p};return {...p,x:h-p.y,y:p.x,side:ROTSIDE[p.side]};});}
function portPos(c,pid){const p=portList(c).find(q=>q.id===pid);return p?{x:c.x+p.x,y:c.y+p.y,side:p.side,kind:p.kind,dir:p.dir,off:p.off}:null;}
const DIRV={l:[-1,0],r:[1,0],t:[0,-1],b:[0,1]};

/* connection geometry */
function connPoints(w){
  const ca=byId.get(w.from.c),cb=byId.get(w.to.c);if(!ca||!cb)return null;
  const a=portPos(ca,w.from.p),b=portPos(cb,w.to.p);if(!a||!b)return null;
  const da=DIRV[a.side],db=DIRV[b.side];
  const s1={x:a.x+da[0]*20,y:a.y+da[1]*20},s2={x:b.x+db[0]*20,y:b.y+db[1]*20};
  const pts=[{x:a.x,y:a.y},s1];
  const anc=w.anchors||[];
  let heading=da[0]!==0?'h':'v';
  const bh=db[0]!==0?'h':'v';
  const elbow=(cur,t)=>{
    if(cur.x===t.x||cur.y===t.y){pts.push({x:t.x,y:t.y});heading=cur.x===t.x?(cur.y===t.y?heading:'v'):'h';return;}
    if(heading==='h'){pts.push({x:t.x,y:cur.y});pts.push({x:t.x,y:t.y});heading='v';}
    else{pts.push({x:cur.x,y:t.y});pts.push({x:t.x,y:t.y});heading='h';}};
  if(!anc.length&&heading==='h'&&bh==='h'){
    if(s2.x>=s1.x){const mx=snap((s1.x+s2.x)/2,20);pts.push({x:mx,y:s1.y},{x:mx,y:s2.y},{x:s2.x,y:s2.y});}
    else{const my=snap((s1.y+s2.y)/2,20);pts.push({x:s1.x,y:my},{x:s2.x,y:my},{x:s2.x,y:s2.y});}
  }else if(!anc.length&&heading==='v'&&bh==='v'){
    if(s2.y>=s1.y){const my=snap((s1.y+s2.y)/2,20);pts.push({x:s1.x,y:my},{x:s2.x,y:my},{x:s2.x,y:s2.y});}
    else{const mx=snap((s1.x+s2.x)/2,20);pts.push({x:mx,y:s1.y},{x:mx,y:s2.y},{x:s2.x,y:s2.y});}
  }else{
    let cur=s1;for(const t of [...anc,s2]){elbow(cur,t);cur=t;}
  }
  pts.push({x:b.x,y:b.y});
  // simplify: drop duplicates and collinear middle points
  const out=[];for(const p of pts){const l=out[out.length-1];if(l&&l.x===p.x&&l.y===p.y)continue;out.push(p);}
  const r=[out[0]];for(let i=1;i<out.length-1;i++){const p=r[r.length-1],q=out[i],n=out[i+1];if((p.x===q.x&&q.x===n.x)||(p.y===q.y&&q.y===n.y)){
      // keep if direction reverses (spur) – drop anyway for tidy lines
      continue;}r.push(q);}
  r.push(out[out.length-1]);return r;
}
function polyMid(pts){let L=0;for(let i=1;i<pts.length;i++)L+=Math.abs(pts[i].x-pts[i-1].x)+Math.abs(pts[i].y-pts[i-1].y);let h=L/2;
  for(let i=1;i<pts.length;i++){const d=Math.abs(pts[i].x-pts[i-1].x)+Math.abs(pts[i].y-pts[i-1].y);if(h<=d&&d>0){const t=h/d;return {x:pts[i-1].x+(pts[i].x-pts[i-1].x)*t,y:pts[i-1].y+(pts[i].y-pts[i-1].y)*t};}h-=d;}return pts[0];}
const ptsD=pts=>pts.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' ');

/* ================= component factory ================= */
function makeComp(type,x,y){const T=TYPES[type];const c={id:uid(),type,tag:'',x:snap(x),y:snap(y),orient:T.orient||'h',locked:false,p:clone(T.defaults())};
  c.tag=nextTag(T.prefix);if(T.init)T.init(c);return c;}
function resetRuntime(c){const T=TYPES[c.type];c.s={};if(T.init)T.init(c);}
function bbox(list){let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const c of list){const [w,h]=dims(c);x0=Math.min(x0,c.x);y0=Math.min(y0,c.y);x1=Math.max(x1,c.x+w);y1=Math.max(y1,c.y+h);}return list.length?{x0,y0,x1,y1}:null;}
