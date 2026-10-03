'use strict';
/* ================= safe expression language (Calculation block) ================= */
const EXF={ABS:Math.abs,SQRT:x=>Math.sqrt(Math.max(0,x)),EXP:x=>Math.exp(clamp(x,-700,700)),LN:x=>x>0?Math.log(x):0,LOG:x=>x>0?Math.log10(x):0,SIN:Math.sin,COS:Math.cos,TAN:Math.tan,
  ROUND:Math.round,FLOOR:Math.floor,CEIL:Math.ceil,SIGN:Math.sign,MIN:(...a)=>Math.min(...a),MAX:(...a)=>Math.max(...a),LIMIT:(x,lo,hi)=>Math.min(Math.max(x,lo),hi)};
function compileExpr(src,n){
  const re=/\s*(?:(\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+)|([A-Za-z_][A-Za-z_0-9]*)|(==|!=|<>|<=|>=|&&|\|\||[-+*\/%^()<>=,!]))/y;
  const toks=[];let pos=0;src=String(src||'');
  while(true){re.lastIndex=pos;if(/^\s*$/.test(src.slice(pos)))break;const m=re.exec(src);if(!m)throw new Error('Unexpected character at '+(pos+1));pos=re.lastIndex;
    if(m[1]!=null)toks.push({t:'n',v:parseFloat(m[1])});else if(m[2]!=null)toks.push({t:'i',v:m[2].toUpperCase()});else toks.push({t:'o',v:m[3]});}
  let i=0;const peek=()=>toks[i],next=()=>toks[i++];
  const isOp=(...v)=>{const t=peek();return t&&t.t==='o'&&v.includes(t.v);};
  const isKw=(...v)=>{const t=peek();return t&&t.t==='i'&&v.includes(t.v);};
  const num=v=>Number.isFinite(v)?v:0;
  function pOr(){let a=pAnd();while(isKw('OR')||isOp('||')){next();const l=a,r=pAnd();a=x=>(l(x)||r(x))?1:0;}return a;}
  function pAnd(){let a=pNot();while(isKw('AND')||isOp('&&')){next();const l=a,r=pNot();a=x=>(l(x)&&r(x))?1:0;}return a;}
  function pNot(){if(isKw('NOT')||isOp('!')){next();const f=pNot();return x=>f(x)?0:1;}return pCmp();}
  function pCmp(){let a=pAdd();if(isOp('==','=','!=','<>','<','>','<=','>=')){const o=next().v;const l=a,r=pAdd();
      const f={'==':(p,q)=>p===q,'=':(p,q)=>p===q,'!=':(p,q)=>p!==q,'<>':(p,q)=>p!==q,'<':(p,q)=>p<q,'>':(p,q)=>p>q,'<=':(p,q)=>p<=q,'>=':(p,q)=>p>=q}[o];a=x=>f(l(x),r(x))?1:0;}return a;}
  function pAdd(){let a=pMul();while(isOp('+','-')){const o=next().v;const l=a,r=pMul();a=o==='+'?x=>l(x)+r(x):x=>l(x)-r(x);}return a;}
  function pMul(){let a=pUn();while(isOp('*','/','%')){const o=next().v;const l=a,r=pUn();
      a=o==='*'?x=>l(x)*r(x):o==='/'?x=>{const d=r(x);return d?l(x)/d:0;}:x=>{const d=r(x);return d?l(x)%d:0;};}return a;}
  function pUn(){if(isOp('-')){next();const f=pUn();return x=>-f(x);}if(isOp('+')){next();return pUn();}return pPow();}
  function pPow(){const a=pAtom();if(isOp('^')){next();const e=pUn();return x=>num(Math.pow(a(x),e(x)));}return a;}
  function pAtom(){const t=next();if(!t)throw new Error('Unexpected end of expression');
    if(t.t==='n')return()=>t.v;
    if(t.t==='o'&&t.v==='('){const e=pOr();if(!isOp(')'))throw new Error('Missing )');next();return e;}
    if(t.t==='i'){
      if(isOp('(')){next();const args=[];if(!isOp(')')){args.push(pOr());while(isOp(',')){next();args.push(pOr());}}if(!isOp(')'))throw new Error('Missing )');next();
        if(t.v==='IF'){if(args.length!==3)throw new Error('IF needs 3 arguments');const[c,a,b]=args;return x=>c(x)?a(x):b(x);}
        const f=EXF[t.v];if(!f)throw new Error('Unknown function '+t.v);return x=>num(f(...args.map(g=>g(x))));}
      if(t.v==='TRUE')return()=>1;if(t.v==='FALSE')return()=>0;if(t.v==='PI')return()=>Math.PI;
      let k=-1,m=t.v.match(/^IN(\d+)$/);if(m)k=+m[1]-1;else if(/^[A-P]$/.test(t.v))k=t.v.charCodeAt(0)-65;
      if(k<0||k>=n)throw new Error('Unknown name '+t.v);return x=>x[k];}
    throw new Error('Unexpected '+t.v);}
  const f=pOr();if(i<toks.length)throw new Error('Unexpected '+toks[i].v);return f;
}

/* ================= function block factory ================= */
function defFB(id,name,group,prefix,o){
  const nIn=c=>typeof o.ins==='function'?o.ins(c):(o.ins||[]);
  const nOut=c=>typeof o.outs==='function'?o.outs(c):(o.outs||[]);
  reg(id,{name,cat:group,prefix,rot:false,fb:true,short:o.short||name,icon:o.icon||(o.short||name).slice(0,4).toUpperCase(),
    size:c=>{const n=Math.max(nIn(c).length,nOut(c).length,1);return[o.w||140,60+20*n];},
    defaults:()=>clone({desc:'',...(o.defaults||{})}),inLabel:true,plin:true,
    init:c=>{c.s={o:[],disp:'',...(o.init?o.init(c):{})};},
    ports:c=>{const L=[];nIn(c).forEach((q,i)=>L.push(P(q[0],q[1],'in',0,40+20*i,'l',q[2])));nOut(c).forEach((q,i)=>L.push(P(q[0],q[1],'out',(o.w||140),40+20*i,'r',q[2])));return L;},
    sym(c){const[w,h]=baseSize(c);const outs=nOut(c);const v=c.s.o&&c.s.o[0];let d=c.s.disp;
      if(d===''||d==null){if(outs.length&&v!=null)d=outs[0][1]==='disc'?(v?'ON':'OFF'):(Math.abs(v)>=1e5?v.toExponential(2):(+v).toFixed(2));}
      const active=outs.length&&outs[0][1]==='disc'&&v;
      return `<rect class="s-body" x="0" y="0" width="${w}" height="${h}" rx="3" style="${c.s.trip?'fill:var(--redsoft)':active?'fill:var(--ana);fill-opacity:.12':''}"/>${o.sis?`<path d="M0 3 Q0 0 3 0 H${w-3} Q${w} 0 ${w} 3 V8 H0 Z" style="fill:var(--amber);fill-opacity:.9"/><text class="s-pl" x="${w-4}" y="7" text-anchor="end" style="font-size:6.5px;stroke:none;fill:#111;font-weight:700">SIS</text>`:''}<text class="s-tag" x="${w/2}" y="14" text-anchor="middle">${esc(c.tag)}</text><text class="s-pl" x="${w/2}" y="27" text-anchor="middle">${esc(c.p.desc||o.short||name)}${c.s.err?' ⚠':''}</text>${o.noval?'':`<text class="s-txt b" x="${w/2}" y="${h/2+14}" text-anchor="middle" style="fill:${active?'var(--disc)':'var(--ink)'}">${esc(d)}</text>`}${o.extraSym?o.extraSym(c,w,h):''}`;},
    label:()=>[],
    insp(c){return H.txt(c,'desc','Description / label')+(o.pre?o.pre(c):'')+H.sec('Parameters')+H.params(c,o.params||[])+(o.post?o.post(c):'')+(c.s.err?`<div class="note" style="color:var(--red)">${esc(c.s.err)}</div>`:'')+`<div class="note">Live output: <span class="live" data-live="fbout">—</span></div>`;},
    liveInsp(c){const e=$('[data-live=fbout]');if(e){e.textContent=(c.s.o||[]).map(v=>typeof v==='number'?+v.toFixed(3):v).join(' , ');}if(o.liveInsp)o.liveInsp(c);},
    act:o.act,dbl:o.dbl,
    scan(c,dt){const ins=nIn(c);const x=ins.map(q=>q[1]==='disc'?D(c,q[0]):(A(c,q[0])??0));const s=c.s;const r=o.run(c,x,dt,s,ins);
      const outs=nOut(c);s.o=r;if(c._pg){if(s.trip)Sim.alarms.push({pg:c._pg.id,txt:`${c.tag} TRIPPED${s.fot?' — first out: '+s.fot:''}`,lvl:'red'});if(s.alms)for(const a of s.alms)Sim.alarms.push({pg:c._pg.id,txt:a.txt,lvl:a.lvl});}outs.forEach((q,i)=>{sig[c.id+'.'+q[0]]=r[i];});}
  });
}
const nInputs=(k,lo,hi,def,labelFn)=>({k,l:'Number of inputs',t:'n',min:lo,max:hi,step:1,rr:1});
const inList=(n,kind='ana',pre='I')=>Array.from({length:n},(_,i)=>['i'+(i+1),kind,pre+(i+1)]);
const ON=v=>v?1:0;

/* ---- I/O ---- */
defFB('const','Constant','I/O','K-',{short:'CONST',icon:'K',outs:c=>[['q',c.p.mode==='bool'?'disc':'ana','Q']],defaults:{mode:'num',value:50,bool:false},
  params:[{k:'mode',l:'Type',t:'s',opts:[['num','Number'],['bool','Boolean']],rr:1},{k:'value',l:'Value',t:'n',step:'any',show:p=>p.mode!=='bool'},{k:'bool',l:'Value (TRUE)',t:'b',show:p=>p.mode==='bool'}],
  run:c=>[c.p.mode==='bool'?ON(c.p.bool):+c.p.value||0]});
defFB('di','Discrete input','I/O','DI-',{short:'SWITCH',icon:'DI',outs:[['q','disc','Q']],defaults:{state:false},
  params:[{k:'state',l:'Switch ON',t:'b'}],post:c=>`<div class="btnrow">${H.btn('toggle','Toggle switch')}</div>`,
  act:(c,a)=>{if(a==='toggle'){c.p.state=!c.p.state;return 'rr';}},dbl:c=>{c.p.state=!c.p.state;return true;},run:c=>[ON(c.p.state)]});
defFB('sig','Signal generator','I/O','SG-',{short:'SIGGEN',icon:'~',outs:[['q','ana','Q']],defaults:{wave:'sine',amp:25,off:50,period:60},
  params:[{k:'wave',l:'Waveform',t:'s',opts:[['sine','Sine'],['square','Square'],['triangle','Triangle'],['ramp','Ramp'],['noise','Noise']]},{k:'amp',l:'Amplitude',t:'n',step:'any'},{k:'off',l:'Offset',t:'n',step:'any'},{k:'period',l:'Period (s)',t:'n',min:0.1,step:'any'}],
  run:(c,x,dt,s)=>{const p=c.p,T=Math.max(.1,+p.period||60),ph=((Sim.t/T)%1+1)%1;let w=0;
    switch(p.wave){case'sine':w=Math.sin(2*Math.PI*ph);break;case'square':w=ph<.5?1:-1;break;case'triangle':w=ph<.25?4*ph:ph<.75?2-4*ph:4*ph-4;break;case'ramp':w=2*ph-1;break;case'noise':w=Math.random()*2-1;break;}
    return[(+p.off||0)+(+p.amp||0)*w];}});
defFB('do','Discrete output','I/O','DO-',{short:'LAMP',icon:'DO',ins:[['i','disc','IN']],noval:true,defaults:{},
  run:(c,x)=>{c.s.lit=x[0];c.s.disp=x[0]?'ON':'OFF';return[x[0]];},
  extraSym:(c,w,h)=>`<circle cx="${w/2}" cy="${h/2+10}" r="12" class="s-ln" style="fill:${c.s.lit?'var(--disc)':'var(--paper)'}"/>`});
defFB('logger','Logger','I/O','LG-',{short:'LOGGER',icon:'LOG',ins:c=>inList(c.p.n,'ana','V'),noval:true,defaults:{n:2,dt:5},
  params:[{k:'n',l:'Channels',t:'n',min:1,max:4,step:1,rr:1},{k:'dt',l:'Log interval (s)',t:'n',min:.1,step:'any'}],
  init:()=>({rows:[],next:0}),
  run:(c,x,dt,s)=>{if(Sim.t>=s.next){s.rows.push([Sim.t,...x]);if(s.rows.length>500)s.rows.shift();s.next=Sim.t+Math.max(.1,+c.p.dt||5);}s.disp=s.rows.length+' rows';return[];},
  extraSym:(c,w,h)=>`<text class="s-txt" x="${w/2}" y="${h/2+14}" text-anchor="middle">${c.s.rows?c.s.rows.length:0} rows</text>`,
  post:c=>`<div class="btnrow">${H.btn('csv','Download CSV')}${H.btn('clr','Clear log')}</div><div class="note">Last rows:</div><table class="log">${(c.s.rows||[]).slice(-8).map(r=>'<tr>'+r.map(v=>`<td>${(+v).toFixed(2)}</td>`).join('')+'</tr>').join('')}</table>`,
  act:(c,a)=>{if(a==='clr'){c.s.rows=[];return 'rr';}if(a==='csv'){const t='t,'+Array.from({length:c.p.n},(_,i)=>'v'+(i+1)).join(',')+'\n'+c.s.rows.map(r=>r.join(',')).join('\n');saveFile(c.tag+'.csv',t,'text/csv');}}});

/* ---- Math ---- */
const mathN=(id,name,short,icon,fn)=>defFB(id,name,'Math',short+'-',{short:short,icon,ins:c=>inList(c.p.n,'ana','I'),outs:[['q','ana','Q']],defaults:{n:2},params:[{k:'n',l:'Number of inputs',t:'n',min:2,max:8,step:1,rr:1}],run:(c,x)=>[fn(x)]});
mathN('add','Add','ADD','+',x=>x.reduce((a,b)=>a+b,0));
mathN('mul','Multiply','MUL','×',x=>x.reduce((a,b)=>a*b,1));
defFB('sub','Subtract','Math','SUB-',{short:'SUB',icon:'−',ins:[['a','ana','A'],['b','ana','B']],outs:[['q','ana','A−B']],run:(c,x)=>[x[0]-x[1]]});
defFB('div','Divide','Math','DIV-',{short:'DIV',icon:'÷',ins:[['a','ana','A'],['b','ana','B']],outs:[['q','ana','A÷B']],run:(c,x)=>[x[1]?x[0]/x[1]:0]});
defFB('abs','Absolute value','Math','ABS-',{short:'ABS',icon:'|x|',ins:[['i','ana','IN']],outs:[['q','ana','Q']],run:(c,x)=>[Math.abs(x[0])]});
defFB('scl','Scaler','Math','SCL-',{short:'SCALER',icon:'SCL',ins:[['i','ana','IN']],outs:[['q','ana','Q']],defaults:{ilo:0,ihi:100,olo:0,ohi:100,lim:true},
  params:[{k:'ilo',l:'Input low',t:'n',step:'any'},{k:'ihi',l:'Input high',t:'n',step:'any'},{k:'olo',l:'Output low',t:'n',step:'any'},{k:'ohi',l:'Output high',t:'n',step:'any'},{k:'lim',l:'Clamp output',t:'b'}],
  run:(c,x)=>{const p=c.p;const sp=(p.ihi-p.ilo)||1;let f=(x[0]-p.ilo)/sp;if(p.lim)f=clamp(f,0,1);return[p.olo+f*(p.ohi-p.olo)];}});
defFB('bg','Bias / gain','Math','BG-',{short:'BIAS/GAIN',icon:'ax+b',ins:[['i','ana','IN']],outs:[['q','ana','Q']],defaults:{gain:1,bias:0},
  params:[{k:'gain',l:'Gain',t:'n',step:'any'},{k:'bias',l:'Bias',t:'n',step:'any'}],run:(c,x)=>[x[0]*c.p.gain+ +c.p.bias]});
defFB('calc','Calculation','Math','CALC-',{short:'CALC',icon:'f(x)',w:160,ins:c=>inList(c.p.n,'ana','I'),outs:[['q','ana','Q']],defaults:{n:2,expr:'IF(IN1>IN2, IN1-IN2, 0)'},
  params:[{k:'n',l:'Number of inputs',t:'n',min:1,max:16,step:1,rr:1},{k:'expr',l:'Expression',t:'ta',rr:0}],
  post:c=>`<div class="note">Inputs IN1…IN${c.p.n} (or A…). Operators + − * / % ^ = &lt;&gt; &lt; &gt; &lt;= &gt;= AND OR NOT. Functions: IF ABS SQRT EXP LN LOG SIN COS TAN ROUND FLOOR CEIL SIGN MIN MAX LIMIT.</div>`,
  run:(c,x,dt,s)=>{const k=c.p.expr+'|'+c.p.n;if(s.ek!==k){s.ek=k;try{s.fn=compileExpr(c.p.expr,c.p.n);s.err='';}catch(e){s.fn=null;s.err=e.message;}}
    if(!s.fn)return[0];return[s.fn(x)];}});

/* ---- Logic ---- */
const logicN=(id,name,short,fn)=>defFB(id,name,'Logic',short+'-',{short,icon:short,ins:c=>inList(c.p.n,'disc','I'),outs:[['q','disc','Q']],defaults:{n:2},params:[{k:'n',l:'Number of inputs',t:'n',min:2,max:8,step:1,rr:1}],run:(c,x)=>[fn(x)]});
logicN('and','AND','AND',x=>ON(x.every(v=>v)));logicN('or','OR','OR',x=>ON(x.some(v=>v)));logicN('xor','XOR','XOR',x=>ON(x.filter(v=>v).length%2===1));
logicN('nand','NAND','NAND',x=>ON(!x.every(v=>v)));logicN('nor','NOR','NOR',x=>ON(!x.some(v=>v)));
defFB('not','NOT','Logic','NOT-',{short:'NOT',icon:'NOT',ins:[['i','disc','IN']],outs:[['q','disc','Q']],run:(c,x)=>[ON(!x[0])]});
defFB('cmp','Compare','Logic','CMP-',{short:'COMPARE',icon:'CMP',ins:[['a','ana','A'],['b','ana','B']],outs:[['q','disc','Q']],defaults:{op:'>',bval:50,db:0},
  params:[{k:'op',l:'Operator',t:'s',opts:[['>','A > B'],['>=','A ≥ B'],['<','A < B'],['<=','A ≤ B'],['==','A = B'],['!=','A ≠ B']]},{k:'bval',l:'B (if not wired)',t:'n',step:'any'},{k:'db',l:'Deadband',t:'n',min:0,step:'any'}],
  run:(c,x,dt,s)=>{const a=x[0],b=hasIn(c,'b')?x[1]:+c.p.bval,db=+c.p.db||0;let q=s.q||0;
    switch(c.p.op){case'>':q=ON(q?a>b-db:a>b);break;case'>=':q=ON(q?a>=b-db:a>=b);break;
      case'<':q=ON(q?a<b+db:a<b);break;case'<=':q=ON(q?a<=b+db:a<=b);break;
      case'==':q=ON(Math.abs(a-b)<=Math.max(db,1e-9));break;default:q=ON(Math.abs(a-b)>Math.max(db,1e-9));}
    s.q=q;return[q];}});
defFB('rise','Rising edge','Logic','RE-',{short:'R-TRIG',icon:'↑',ins:[['i','disc','IN']],outs:[['q','disc','Q']],run:(c,x,dt,s)=>{const q=x[0]&&!s.p?1:0;s.p=x[0];return[q];}});
defFB('fall','Falling edge','Logic','FE-',{short:'F-TRIG',icon:'↓',ins:[['i','disc','IN']],outs:[['q','disc','Q']],run:(c,x,dt,s)=>{const q=!x[0]&&s.p?1:0;s.p=x[0];return[q];}});
defFB('sr','Latch (set dominant)','Logic','SR-',{short:'SR (S dom)',icon:'SR',ins:[['s','disc','S'],['r','disc','R']],outs:[['q','disc','Q']],run:(c,x,dt,s)=>{s.q=x[0]?1:x[1]?0:(s.q||0);return[s.q];}});
defFB('rs','Latch (reset dominant)','Logic','RS-',{short:'RS (R dom)',icon:'RS',ins:[['s','disc','S'],['r','disc','R']],outs:[['q','disc','Q']],run:(c,x,dt,s)=>{s.q=x[1]?0:x[0]?1:(s.q||0);return[s.q];}});

/* ---- Timers ---- */
const PT={k:'pt',l:'Preset time (s)',t:'n',min:0,step:'any'};
defFB('ton','On-delay timer (TON)','Timers','TON-',{short:'TON',icon:'TON',ins:[['i','disc','IN']],outs:[['q','disc','Q'],['et','ana','ET']],defaults:{pt:5},params:[PT],
  run:(c,x,dt,s)=>{const pt=+c.p.pt||0;s.et=x[0]?Math.min(pt,(s.et||0)+dt):0;return[ON(x[0]&&s.et>=pt),s.et];}});
defFB('tof','Off-delay timer (TOF)','Timers','TOF-',{short:'TOF',icon:'TOF',ins:[['i','disc','IN']],outs:[['q','disc','Q'],['et','ana','ET']],defaults:{pt:5},params:[PT],
  run:(c,x,dt,s)=>{const pt=+c.p.pt||0;if(x[0]){s.q=1;s.et=0;}else if(s.q){s.et=(s.et||0)+dt;if(s.et>=pt){s.q=0;s.et=pt;}}return[s.q||0,s.et||0];}});
defFB('tp','Pulse timer (TP)','Timers','TP-',{short:'TP',icon:'TP',ins:[['i','disc','IN']],outs:[['q','disc','Q'],['et','ana','ET']],defaults:{pt:5},params:[PT],
  run:(c,x,dt,s)=>{const pt=+c.p.pt||0;if(x[0]&&!s.pi&&!s.run){s.run=1;s.et=0;}s.pi=x[0];if(s.run){s.et+=dt;if(s.et>=pt){s.run=0;s.et=0;}}return[s.run||0,s.run?s.et:0];}});
defFB('rto','Retentive timer','Timers','RTO-',{short:'RTO',icon:'RTO',ins:[['i','disc','IN'],['r','disc','RESET']],outs:[['q','disc','Q'],['et','ana','ET']],defaults:{pt:10},params:[PT],
  run:(c,x,dt,s)=>{const pt=+c.p.pt||0;if(x[1])s.et=0;else if(x[0])s.et=Math.min(pt,(s.et||0)+dt);return[ON((s.et||0)>=pt&&pt>0||(pt===0&&x[0])),s.et||0];}});
defFB('ctu','Up counter','Timers','CTU-',{short:'CTU',icon:'CTU',ins:[['cu','disc','CU'],['r','disc','RESET']],outs:[['q','disc','Q'],['cv','ana','CV']],defaults:{pv:10},params:[{k:'pv',l:'Preset value',t:'n',step:1}],
  run:(c,x,dt,s)=>{if(x[1])s.cv=0;else if(x[0]&&!s.p)s.cv=(s.cv||0)+1;s.p=x[0];return[ON((s.cv||0)>=c.p.pv),s.cv||0];}});
defFB('ctd','Down counter','Timers','CTD-',{short:'CTD',icon:'CTD',ins:[['cd','disc','CD'],['ld','disc','LOAD']],outs:[['q','disc','Q'],['cv','ana','CV']],defaults:{pv:10},params:[{k:'pv',l:'Preset value',t:'n',step:1}],
  run:(c,x,dt,s)=>{if(x[1])s.cv=+c.p.pv;else if(x[0]&&!s.p)s.cv=Math.max(0,(s.cv==null?c.p.pv:s.cv)-1);s.p=x[0];if(s.cv==null)s.cv=+c.p.pv;return[ON(s.cv<=0),s.cv];}});
defFB('dt','Dead time','Timers','DT-',{short:'DEADTIME',icon:'DT',ins:[['i','ana','IN']],outs:[['q','ana','Q']],defaults:{delay:10},params:[{k:'delay',l:'Delay (s)',t:'n',min:0,step:'any'}],
  init:()=>({q:[]}),run:(c,x,dt,s)=>{const q=s.q;q.push({t:Sim.t,v:x[0]});const d=Math.max(0,+c.p.delay||0);while(q.length>1&&q[1].t<=Sim.t-d)q.shift();return[q[0].v];}});

/* ---- Analog ---- */
defFB('ll','Lead / lag','Analog','LL-',{short:'LEAD/LAG',icon:'LL',ins:[['i','ana','IN']],outs:[['q','ana','Q']],defaults:{k:1,t1:0,t2:10},
  params:[{k:'k',l:'Gain',t:'n',step:'any'},{k:'t1',l:'Lead time (s)',t:'n',min:0,step:'any'},{k:'t2',l:'Lag time (s)',t:'n',min:0,step:'any'}],
  run:(c,x,dt,s)=>{const u=x[0],t1=+c.p.t1||0,t2=+c.p.t2||0;if(s.l==null)s.l=u;if(t2>0)s.l+=(u-s.l)*(1-Math.exp(-dt/t2));else s.l=u;
    const y=t2>0?(t1/t2)*u+(1-t1/t2)*s.l:u;return[(+c.p.k)*y];}});
defFB('integ','Integrator','Analog','INT-',{short:'INTEGRATOR',icon:'∫',ins:[['i','ana','IN'],['r','disc','RESET']],outs:[['q','ana','Q']],defaults:{ki:1,y0:0,lo:-1e6,hi:1e6},
  params:[{k:'ki',l:'Gain (1/s)',t:'n',step:'any'},{k:'y0',l:'Initial / reset value',t:'n',step:'any'},{k:'lo',l:'Low limit',t:'n',step:'any'},{k:'hi',l:'High limit',t:'n',step:'any'}],
  run:(c,x,dt,s)=>{if(s.y==null||x[1])s.y=+c.p.y0;else s.y=clamp(s.y+c.p.ki*x[0]*dt,c.p.lo,c.p.hi);return[s.y];}});
defFB('rl','Rate limiter','Analog','RL-',{short:'RATE LIMIT',icon:'RL',ins:[['i','ana','IN']],outs:[['q','ana','Q']],defaults:{up:10,dn:10},
  params:[{k:'up',l:'Max rise (units/s)',t:'n',min:0,step:'any'},{k:'dn',l:'Max fall (units/s)',t:'n',min:0,step:'any'}],
  run:(c,x,dt,s)=>{if(s.y==null)s.y=x[0];else{const d=x[0]-s.y;s.y+=d>0?Math.min(d,c.p.up*dt):Math.max(d,-c.p.dn*dt);}return[s.y];}});
defFB('lim','Limiter','Analog','LIM-',{short:'LIMITER',icon:'LIM',ins:[['i','ana','IN']],outs:[['q','ana','Q']],defaults:{lo:0,hi:100},
  params:[{k:'lo',l:'Low limit',t:'n',step:'any'},{k:'hi',l:'High limit',t:'n',step:'any'}],run:(c,x)=>[clamp(x[0],c.p.lo,Math.max(c.p.lo,c.p.hi))]});
defFB('alm','Alarm (hi / lo)','Analog','AL-',{short:'ALARM',icon:'ALM',ins:[['i','ana','IN']],outs:[['hi','disc','HI'],['lo','disc','LO']],defaults:{hi:80,lo:20,db:2},
  params:[{k:'hi',l:'High setpoint',t:'n',step:'any'},{k:'lo',l:'Low setpoint',t:'n',step:'any'},{k:'db',l:'Deadband',t:'n',min:0,step:'any'}],
  run:(c,x,dt,s)=>{const v=x[0],db=+c.p.db||0;s.h=v>=c.p.hi?1:(v<c.p.hi-db?0:(s.h||0));s.l=v<=c.p.lo?1:(v>c.p.lo+db?0:(s.l||0));return[s.h,s.l];}});
defFB('sel','Input selector','Analog','SEL-',{short:'SELECTOR',icon:'SEL',ins:c=>inList(c.p.n,'ana','I'),outs:[['q','ana','Q']],defaults:{n:3,mode:'mid'},
  params:[{k:'n',l:'Number of inputs',t:'n',min:2,max:6,step:1,rr:1},{k:'mode',l:'Mode',t:'s',opts:[['max','Maximum'],['min','Minimum'],['avg','Average'],['mid','Middle']]}],
  run:(c,x)=>{const m=c.p.mode;if(m==='max')return[Math.max(...x)];if(m==='min')return[Math.min(...x)];if(m==='avg')return[x.reduce((a,b)=>a+b,0)/x.length];const y=[...x].sort((a,b)=>a-b);const k=y.length;return[k%2?y[(k-1)/2]:(y[k/2-1]+y[k/2])/2];}});
defFB('pm','Process model (FOPDT)','Analog','PM-',{short:'FOPDT',icon:'PM',ins:[['i','ana','IN']],outs:[['q','ana','Q']],defaults:{k:1,tau:30,theta:5,y0:0},
  params:[{k:'k',l:'Process gain',t:'n',step:'any'},{k:'tau',l:'Time constant (s)',t:'n',min:0,step:'any'},{k:'theta',l:'Dead time (s)',t:'n',min:0,step:'any'},{k:'y0',l:'Initial output',t:'n',step:'any'}],
  init:()=>({q:[]}),run:(c,x,dt,s)=>{if(s.f==null)s.f=+c.p.y0;const tau=+c.p.tau||0;const tgt=c.p.k*x[0];s.f=tau>0?s.f+(tgt-s.f)*(1-Math.exp(-dt/tau)):tgt;
    s.q.push({t:Sim.t,v:s.f});const d=+c.p.theta||0;while(s.q.length>1&&s.q[1].t<=Sim.t-d)s.q.shift();return[s.q[0].v];}});
