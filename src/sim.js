'use strict';
/* ================= simulation engine ================= */
const sig={};
const Sim={running:false,speed:1,t:0,tIn:0,drained:0,over:0,fixx:0,inv0:0,invChange:0,err:0,alarms:[],
  dt(){const v=this.speed;return v<=5?0.1:v<=10?0.25:v<=30?0.5:1;},
  rebase(fn){const b=invNow();if(fn)fn();Sim.inv0+=invNow()-b;}};
const A=(c,p)=>{const l=c._in&&c._in[p];if(!l||!l.length)return null;const v=sig[l[0]];return(v==null||Number.isNaN(v))?null:v;};
const D=(c,p)=>{const l=c._in&&c._in[p];if(!l)return 0;for(const k of l)if(sig[k]>0.5)return 1;return 0;};
const hasIn=(c,p)=>!!(c._in&&c._in[p]&&c._in[p].length);
function invNow(){let s=0;for(const p of doc.pages)for(const c of p.comps)if(c.type==='vessel'&&c.p.mode!=='fixed'&&c.s)s+=c.s.vol;return s;}

const NODES=new Map();
const Net={built:-1,els:[],free:[],vessels:[],pumps:[],drains:[],elecs:[],scan:[],posts:[],order:[],comps:[]};
let topoVer=1;const dirtyNet=()=>{topoVer++;};
function ensureNet(){if(Net.built!==topoVer)buildNet();}
function getNode(key){let n=NODES.get(key);if(!n){n={key,h:0,T:20,comp:pureComp(0),wet:false,fixed:false,fh:0,idx:-1,vin:null,drain:null,ins:[],outs:[],src:false,ves:null,depth:0};NODES.set(key,n);}return n;}
const PURE=Array.from({length:NF},(_,i)=>pureComp(i));

function buildNet(){
  Net.built=topoVer;reindex();const comps=allComps();Net.comps=comps;
  for(const n of NODES.values()){n.fixed=false;n.fh=0;n.idx=-1;n.vin=null;n.drain=null;n.ins=[];n.outs=[];n.src=false;n.ves=null;n.depth=0;}
  Net.els=[];Net.vessels=[];Net.pumps=[];Net.drains=[];Net.elecs=[];Net.free=[];
  for(const c of comps){if(!c.s)resetRuntime(c);c._in={};c._pc=new Set();c._wi={};c._tap=null;c._nbi=c._nci=null;c._ve={in:[],out:[],spill:null,inNodes:[]};}
  const atm=getNode('ATM');atm.fixed=true;atm.fh=0;atm.wet=true;
  const pipeConns=[];
  for(const pg of doc.pages)for(const w of pg.conns){const a=byId.get(w.from.c),b=byId.get(w.to.c);if(!a||!b)continue;w._e=null;
    if(w.kind==='pipe')pipeConns.push(w);else{const k=w.to.p;(b._in[k]=b._in[k]||[]).push(w.from.c+'.'+w.from.p);b._wi[k]=a.tag;}}
  const vNode=c=>{const n=getNode(c.id+'.vn');n.src=true;n.ves=c;c._vn=n;if(c.p.mode==='fixed'){n.fixed=true;n.fh=c.s.vol/(1000*c.p.area);}return n;};
  const nodeOf=(c,port)=>{
    if(c.type==='vessel'){if(port.startsWith('out'))return vNode(c);const n=getNode(c.id+'.'+port);n.fixed=true;n.fh=0;n.vin=c;if(!c._ve.inNodes.includes(n))c._ve.inNodes.push(n);return n;}
    if(c.type==='drain'){const n=getNode(c.id+'.in');n.fixed=true;n.fh=0;n.drain=c;return n;}
    return getNode(c.id+'.'+port);};
  for(const c of comps)if(c.type==='vessel')vNode(c);
  const addEl=o=>{o.Q=0;o.da=0;o.db=0;o.K=0;Net.els.push(o);o.a.outs.push(o);o.b.ins.push(o);return o;};
  for(const w of pipeConns){const a=byId.get(w.from.c),b=byId.get(w.to.c);const pa=portPos(a,w.from.p),pb=portPos(b,w.to.p);if(!pa||!pb)continue;
    if(pa.dir==='tap'||pb.dir==='tap'){const [t,tp,o,op]=pa.dir==='tap'?[a,w.from.p,b,w.to.p]:[b,w.to.p,a,w.from.p];if(pa.dir==='tap'&&pb.dir==='tap')continue;t._tap=nodeOf(o,op);t._pc.add(tp);continue;}
    a._pc.add(w.from.p);b._pc.add(w.to.p);w._e=addEl({type:'pipe',a:nodeOf(a,w.from.p),b:nodeOf(b,w.to.p),conn:w});}
  for(const c of comps){
    switch(c.type){
      case'vessel':{Net.vessels.push(c);if(c.p.mode!=='fixed')c._ve.spill=addEl({type:'spill',a:c._vn,b:atm,c});break;}
      case'cv':case'sv':addEl({type:'valve',a:nodeOf(c,'in'),b:nodeOf(c,'out'),c});break;
      case'fm':addEl({type:'fm',a:nodeOf(c,'in'),b:nodeOf(c,'out'),c});break;
      case'source':{const free=c.p.supply!=='inlet';let a;if(free){a=getNode(c.id+'.src');a.fixed=true;a.fh=0;a.wet=true;a.cs=c;}else a=nodeOf(c,'suc');
        const e=addEl({type:'pump',a,b:nodeOf(c,'dis'),c,free});c._pe=e;Net.pumps.push(e);break;}
      case'elec':{c._nbi=nodeOf(c,'bi');c._nci=nodeOf(c,'ci');c._eb=addEl({type:'elec',side:'b',a:c._nbi,b:nodeOf(c,'bo'),c});c._ec=addEl({type:'elec',side:'c',a:c._nci,b:nodeOf(c,'co'),c});Net.elecs.push(c);break;}
      case'drain':nodeOf(c,'in');Net.drains.push(c);break;
    }}
  // free node indices
  const addFree=n=>{if(!n.fixed&&n.idx<0){n.idx=Net.free.length;Net.free.push(n);}};
  for(const c of Net.vessels)addFree(c._vn);
  for(const e of Net.els){addFree(e.a);addFree(e.b);}
  for(const e of Net.els){e.ra=e.a.idx;e.rb=e.b.idx>=0?e.b.idx:(e.b.vin&&e.b.vin._vn.idx>=0?e.b.vin._vn.idx:-1);
    if(e.type!=='spill'&&e.a.ves)e.a.ves._ve.out.push(e);if(e.b.vin)e.b.vin._ve.in.push(e);if(e.type==='spill')e.c._ve.spill=e;}
  // stream propagation order (longest path depth)
  const nodes=[...new Set(Net.els.flatMap(e=>[e.a,e.b]))];for(const n of nodes)n.depth=0;
  for(let it=0;it<nodes.length+1;it++){let ch=false;for(const e of Net.els){if(e.type==='spill')continue;if(e.b.depth<e.a.depth+1&&it<nodes.length){e.b.depth=e.a.depth+1;ch=true;}}if(!ch)break;}
  Net.order=nodes.sort((x,y)=>x.depth-y.depth);
  // scan order (topological over signal wires, cycles broken by previous-scan values)
  const succ=new Map();for(const pg of doc.pages)for(const w of pg.conns){if(w.kind==='pipe')continue;if(!byId.has(w.from.c)||!byId.has(w.to.c))continue;(succ.get(w.from.c)||succ.set(w.from.c,[]).get(w.from.c)).push(w.to.c);}
  const state=new Map(),post=[];const visit=id=>{if(state.get(id))return;state.set(id,1);for(const t of succ.get(id)||[])visit(t);post.push(id);};
  for(const c of comps)visit(c.id);post.reverse();
  Net.scan=post.map(id=>byId.get(id)).filter(c=>c&&TYPES[c.type].scan);
  Net.posts=comps.filter(c=>TYPES[c.type].post);
  for(const c of comps)for(const p of TYPES[c.type].ports(c))if(p.dir==='out'&&p.kind!=='pipe'&&sig[c.id+'.'+p.id]===undefined)sig[c.id+'.'+p.id]=0;
}

/* ---- hydraulics ---- */
const EPS=1e-4;
function setPump(e){const c=e.c,p=c.p,s=c.s;const sp=s.on?s.sp:0;e.cap=p.qset/60*sp;e.Hs=(p.mode==='flow'?p.hshut:p.pset/9.81)*sp*sp;e.w=p.mode==='flow'?0.04*e.Hs+0.05:0.003*e.Hs+0.01;e.off=p.mode==='flow'?6:0;}
function updateK(){for(const e of Net.els){switch(e.type){case'pipe':e.K=Math.max(0,+e.conn.cond||50);break;case'valve':e.K=TYPES[e.c.type].kfun(e.c);break;case'fm':e.K=60;break;case'elec':e.K=8;break;case'spill':e.K=300;break;case'pump':setPump(e);break;}}}
function evalEl(e,ha,hb){
  if(e.type==='pump'){if(e.cap<=0){e.Q=0;e.da=0;e.db=0;return;}
    const x=(e.Hs-(hb-ha))/e.w-e.off;const sg=1/(1+Math.exp(-clamp(x,-40,40)));let f=1,df=0;
    if(!e.free){const y=(ha-0.06)/0.015;f=1/(1+Math.exp(-clamp(y,-40,40)));df=f*(1-f)/0.015;}
    const ds=sg*(1-sg);const dl=1e-4*e.cap/Math.max(e.Hs,1),d=hb-ha,lk=d>e.Hs?dl*(d-e.Hs):0,dk=d>e.Hs?dl:0;e.Q=e.cap*sg*f-lk;e.da=e.cap*(f*ds/e.w+sg*df)+dk;e.db=-e.cap*f*ds/e.w-dk;return;}
  if(e.type==='spill'){const x=ha-e.c._Hmax;if(x<=0){e.Q=0;e.da=0;}else{const r=Math.sqrt(x+EPS);e.Q=e.K*x/r;e.da=e.K*(x/2+EPS)/(r*(x+EPS));}e.db=0;return;}
  const d=ha-hb,ad=Math.abs(d),r=Math.sqrt(ad+EPS);e.Q=e.K*d/r;const g=e.K*(ad/2+EPS)/(r*(ad+EPS));e.da=g;e.db=-g;}
let JM=[],RV=null,MM=[],DX=null,XX=null,XT=null,vars=[];
function evalAll(x,wantJ,dt){const N=x.length;RV.fill(0);if(wantJ)for(let i=0;i<N;i++)JM[i].fill(0);
  for(const e of Net.els){const a=e.a,b=e.b;const ha=a.idx>=0?x[a.idx]:a.fh,hb=b.idx>=0?x[b.idx]:b.fh;evalEl(e,ha,hb);
    if(e.ra>=0){RV[e.ra]+=e.Q;if(wantJ){if(a.idx>=0)JM[e.ra][a.idx]+=e.da;if(b.idx>=0)JM[e.ra][b.idx]+=e.db;}}
    if(e.rb>=0){RV[e.rb]-=e.Q;if(wantJ){if(a.idx>=0)JM[e.rb][a.idx]-=e.da;if(b.idx>=0)JM[e.rb][b.idx]-=e.db;}}}
  for(const c of vars){const i=c._vn.idx;const k=1000*c.p.area/dt;RV[i]+=k*(x[i]-c._h0);if(wantJ)JM[i][i]+=k;}
  let n2=0;for(let i=0;i<N;i++)n2+=RV[i]*RV[i];return n2;}
function gauss(N){for(let i=0;i<N;i++){const r=MM[i];for(let j=0;j<N;j++)r[j]=JM[i][j];r[i]+=1e-9;r[N]=-RV[i];}
  for(let c=0;c<N;c++){let p=c,m=Math.abs(MM[c][c]);for(let r=c+1;r<N;r++){const v=Math.abs(MM[r][c]);if(v>m){m=v;p=r;}}
    if(m<1e-14){continue;}if(p!==c){const t=MM[p];MM[p]=MM[c];MM[c]=t;}const pr=MM[c],pv=pr[c];
    for(let r=c+1;r<N;r++){const row=MM[r];const f=row[c]/pv;if(f!==0){for(let k=c;k<=N;k++)row[k]-=f*pr[k];}}}
  for(let i=N-1;i>=0;i--){let s=MM[i][N];for(let j=i+1;j<N;j++)s-=MM[i][j]*DX[j];DX[i]=Math.abs(MM[i][i])>1e-14?s/MM[i][i]:0;}}
function hyd(dt){
  const N=Net.free.length;vars=[];
  for(const c of Net.vessels){c._Hmax=c.p.vmax/(1000*c.p.area);c._h0=c.s.vol/(1000*c.p.area);if(c.p.mode!=='fixed'){vars.push(c);c._vn.h=c._h0;}else c._vn.fh=c._h0;}
  updateK();let HM=10;for(const e of Net.pumps)HM=Math.max(HM,e.Hs*1.5+5);for(const c of Net.vessels)HM=Math.max(HM,c._Hmax*1.5+5);Net.HM=HM;
  for(const e of Net.pumps)if(e.cap>0&&e.b.idx>=0&&Math.abs(e.b.h)<1e-9)e.b.h=e.c.p.mode==='flow'?0.3*e.Hs:e.Hs;
  if(!XX||XX.length!==N){XX=new Float64Array(N);XT=new Float64Array(N);DX=new Float64Array(N);RV=new Float64Array(N);JM=Array.from({length:N},()=>new Float64Array(N));MM=Array.from({length:N},()=>new Float64Array(N+1));}
  for(let i=0;i<N;i++)XX[i]=Net.free[i].h;
  let n2=evalAll(XX,true,dt);
  Sim.its=0;for(let it=0;it<60&&N>0;it++){let mx=0;for(let i=0;i<N;i++)mx=Math.max(mx,Math.abs(RV[i]));if(mx<1e-8)break;
    Sim.its++;gauss(N);let alpha=1,ok=false,n3=n2;
    for(let ls=0;ls<12;ls++){for(let i=0;i<N;i++)XT[i]=clamp(XX[i]+alpha*DX[i],-5,Net.HM);n3=evalAll(XT,false,dt);if(n3<n2*(1-0.2*alpha)||n3<1e-18){ok=true;break;}alpha*=.5;}
    for(let i=0;i<N;i++)XX[i]=XT[i];if(!ok&&n3>=n2)break;n2=evalAll(XX,true,dt);}
  evalAll(XX,false,dt);
  for(let i=0;i<N;i++)Net.free[i].h=XX[i];
}
function hydPost(dt){
  for(const c of Net.vessels){const s=c.s,ve=c._ve;let qin=0,qout=0;for(const e of ve.in)qin+=e.Q;for(const e of ve.out)qout+=e.Q;const sp=ve.spill?Math.max(0,ve.spill.Q):0;
    s.v0=s.vol;s.qin=qin;s.qout=qout;s.spill=sp;
    if(c.p.mode==='fixed'){Sim.fixx+=(qout-qin)*dt;s.spill=0;}else{s.vol=Math.max(0,s.vol+dt*(qin-qout-sp));Sim.over+=sp*dt;}
    c._vn.h=s.vol/(1000*c.p.area);}
  for(const e of Net.pumps){const s=e.c.s;s.Q=Math.max(0,e.Q);if(e.free)Sim.tIn+=e.Q*dt;s.hsuc=e.a.fixed?e.a.fh:e.a.h;}
  for(const c of Net.drains){const n=getNode(c.id+'.in');let q=0;for(const e of n.ins)q+=e.Q;c.s.Q=q;c.s.tot+=q*dt;Sim.drained+=q*dt;}
  for(const e of Net.els){if(e.type==='valve'||e.type==='fm')e.c.s.Q=e.Q;}
  for(const c of Net.elecs){c.s.Qb=Math.max(0,c._eb.Q);c.s.Qc=Math.max(0,c._ec.Q);}
}
/* ---- streams: temperature / composition / wetness ---- */
const MIX=new Float64Array(NF),SS={T:0,comp:null};
function elemStream(e,fwd){const n=fwd?e.a:e.b;SS.T=n.T;SS.comp=n.comp;
  if(e.type==='pipe'){if(fwd&&e.conn.fluid>=0&&e.conn.fluid!=null&&e.conn.fluid!==''){SS.comp=PURE[clamp(+e.conn.fluid,0,NF-1)];}}
  else if(fwd&&e.type==='pump'&&e.free){SS.T=+e.c.p.temp;SS.comp=PURE[clamp(+e.c.p.fluid,0,NF-1)];}
  else if(fwd&&e.type==='elec'){const o=e.side==='b'?e.c.s.outB:e.c.s.outC;if(o){SS.T=o.T;SS.comp=o.comp;}}
  return SS;}
function streams(dt){
  for(const c of Net.vessels){const n=c._vn,s=c.s;n.T=s.T;n.comp.set(s.comp);n.wet=s.vol>0.5;}
  const eps=1e-6;
  for(let pass=0;pass<2;pass++)for(const n of Net.order){if(n.src||n.fixed&&n.cs)continue;let w=0,T=0;MIX.fill(0);
    for(const e of n.ins){if(e.Q>eps&&e.type!=='spill'){const s=elemStream(e,true);w+=e.Q;T+=e.Q*s.T;const cm=s.comp;for(let i=0;i<NF;i++)MIX[i]+=e.Q*cm[i];}}
    for(const e of n.outs){if(e.Q<-eps&&e.type!=='spill'){const q=-e.Q;const s=elemStream(e,false);w+=q;T+=q*s.T;const cm=s.comp;for(let i=0;i<NF;i++)MIX[i]+=q*cm[i];}}
    if(w>0){n.T=T/w;for(let i=0;i<NF;i++)n.comp[i]=MIX[i]/w;n.wet=true;}
    else if(n.ins.length&&n.ins.every(e=>!e.a.wet))n.wet=false;}
  // vessel contents mixing
  for(const c of Net.vessels){if(c.p.mode==='fixed'){c.s.T=+c.p.temp;c.s.comp=blendComp(c.p.fluid,c.p.fluid2,c.p.blend);const n=c._vn;n.T=c.s.T;n.comp.set(c.s.comp);continue;}
    const s=c.s;const keep=Math.max(0,(s.v0??s.vol)-dt*(s.qout+s.spill));let vt=keep,Tt=keep*s.T;const cm=MIX;for(let i=0;i<NF;i++)cm[i]=keep*s.comp[i];
    for(const n of c._ve.inNodes){let q=0;for(const e of n.ins)if(e.Q>0)q+=e.Q;if(q<=1e-9)continue;const v=q*dt;vt+=v;Tt+=v*n.T;for(let i=0;i<NF;i++)cm[i]+=v*n.comp[i];}
    if(vt>1e-9&&s.vol>1e-9){s.T=Tt/vt;let sum=0;for(let i=0;i<NF;i++)sum+=cm[i];if(sum>0){if(!(s.comp instanceof Float64Array))s.comp=Float64Array.from(s.comp);for(let i=0;i<NF;i++)s.comp[i]=cm[i]/sum;}}
    const n=c._vn;n.T=s.T;n.comp.set(s.comp);}
}
function step(dt){
  ensureNet();Sim.t+=dt;Sim.alarms=[];
  for(const c of Net.scan)TYPES[c.type].scan(c,dt);
  hyd(dt);hydPost(dt);
  for(const c of Net.elecs)TYPES.elec.post(c,dt);
  streams(dt);
  for(const c of Net.posts)if(c.type!=='elec')TYPES[c.type].post(c,dt);
  Sim.invChange=invNow()-Sim.inv0;Sim.err=Sim.tIn+Sim.fixx-Sim.drained-Sim.over-Sim.invChange;
}
function resetAll(){
  Sim.t=0;Sim.tIn=Sim.drained=Sim.over=Sim.fixx=0;Sim.alarms=[];
  for(const n of NODES.values()){n.h=0;n.wet=false;n.T=20;n.comp=pureComp(0);}
  for(const k of Object.keys(sig))delete sig[k];
  for(const c of allComps())resetRuntime(c);
  dirtyNet();ensureNet();
  Sim.inv0=invNow();Sim.invChange=0;Sim.err=0;
  streams(0);
  for(const c of Net.posts)if(c.type!=='elec'&&c.type!=='trend'){}
}
