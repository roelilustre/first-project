'use strict';
/* ================= Safety Instrumented System (SIS) function blocks =================
   Modelled on the DeltaV SIS (LS*) certified block set: voters, cause & effect, monitor/effect,
   state machine, sequencer, I/O, alarm, limit, comparator, mid-select, fan in/out, edges,
   flip-flops, logic, timers and calculation. Discrete convention: input "active" = 1. */
const bad_=(c,k,v)=>!hasIn(c,k)||v<-5||v>110;
const tripOut=(p,t)=>(t?(+p.tv===0?0:1):(+p.tv===0?1:0));
const TVPAR={k:'tv',l:'Tripped output value',t:'s',opts:[['1','1 (energize to trip)'],['0','0 (de-energize to trip)']]};
const SISBTN=(c,extra='')=>`<div class="btnrow">${H.btn('reset','Reset')}${extra}</div>`;
const resetAct=(c,a)=>{if(a==='reset'){const s=c.s;s.lat=0;s.latA=[];s.fail=0;s.cv=undefined;return'rr';}};
const mxHTML=(c,key,rows,cols,rl,cl)=>`<div class="mx" style="grid-template-columns:auto repeat(${cols},16px)"><span></span>${Array.from({length:cols},(_,j)=>`<span class="mh">${cl}${j+1}</span>`).join('')}${Array.from({length:rows},(_,i)=>`<span class="mh">${rl}${i+1}</span>`+Array.from({length:cols},(_,j)=>`<i data-mx="${key}" data-r="${i}" data-c="${j}" class="${c.p[key][i][j]?'on':''}"></i>`).join('')).join('')}</div>`;
const mkMatrix=(r,c,diag)=>Array.from({length:r},(_,i)=>Array.from({length:c},(_,j)=>!!diag&&i===j&&i<4));
const bypRow=(c,n,pre)=>Array.from({length:n},(_,i)=>H.chk(c,'byp.'+i,pre+(i+1)+' bypass')).join('');

/* ---- field I/O ---- */
defFB('lsai','Analog input (LSAI)','SIS','SAI-',{sis:true,short:'LSAI',icon:'LSAI',ins:[['i','ana','IN']],outs:[['q','ana','OUT'],['bad','disc','BAD']],
  defaults:{eu0:0,eu100:100,sqrt:false,cut:0,onbad:'hold',failv:0},
  params:[{k:'eu0',l:'Scale EU at 0%',t:'n',step:'any'},{k:'eu100',l:'Scale EU at 100%',t:'n',step:'any'},{k:'sqrt',l:'Square-root extraction',t:'b'},{k:'cut',l:'Low cutoff (% input)',t:'n',min:0,step:'any',show:p=>p.sqrt},
    {k:'onbad',l:'On bad input',t:'s',opts:[['hold','Hold last good value'],['fail','Use fail value']],rr:1},{k:'failv',l:'Fail value (EU)',t:'n',step:'any',show:p=>p.onbad==='fail'}],
  run:(c,x,dt,s)=>{const p=c.p;const b=bad_(c,'i',x[0]);if(!b){let f=x[0]/100;if(p.sqrt){f=Math.sqrt(Math.max(0,f));if(x[0]<p.cut)f=0;}s.last=+p.eu0+f*(p.eu100-p.eu0);}
    const out=b?(p.onbad==='hold'&&s.last!=null?s.last:+p.failv):(s.last??0);s.alms=b?[{txt:`${c.tag} BAD INPUT`,lvl:'amber'}]:[];s.disp=b?'BAD':(+out).toFixed(2);return[out,ON(b)];}});
defFB('lsdi','Discrete input (LSDI)','SIS','SDI-',{sis:true,short:'LSDI',icon:'LSDI',ins:[['i','disc','IN']],outs:[['q','disc','OUT']],defaults:{inv:false},
  params:[{k:'inv',l:'Invert input',t:'b'}],run:(c,x)=>[ON(c.p.inv?!x[0]:x[0])]});
defFB('lsdo','Discrete output (LSDO)','SIS','SDO-',{sis:true,short:'LSDO',icon:'LSDO',ins:[['i','disc','IN']],outs:[['q','disc','OUT']],defaults:{inv:false},
  params:[{k:'inv',l:'Invert output',t:'b'}],run:(c,x,dt,s)=>{const o=ON(c.p.inv?!x[0]:x[0]);s.disp=o?'ENERGISED':'DE-ENERG.';return[o];}});
defFB('lsdvc','Digital valve controller (LSDVC)','SIS','DVC-',{sis:true,short:'LSDVC',icon:'DVC',w:160,ins:[['i','disc','IN'],['pst','disc','PST']],outs:[['q','disc','OUT'],['pos','ana','POS'],['act','disc','PST ACT'],['fail','disc','PST FAIL']],
  defaults:{auto:false,interval:3600,travel:80,speed:5,hold:2,simfail:false},
  params:[{k:'auto',l:'Scheduled partial stroke test',t:'b'},{k:'interval',l:'Test interval (s)',t:'n',min:10,show:p=>p.auto},{k:'travel',l:'Partial stroke travel (% open)',t:'n',min:0,max:99},{k:'speed',l:'Stroke speed (%/s)',t:'n',min:.1,step:'any'},{k:'hold',l:'Hold at travel (s)',t:'n',min:0,step:'any'},{k:'simfail',l:'Simulate PST failure',t:'b'}],
  post:c=>`<div class="btnrow">${H.btn('pst','Start PST')}${H.btn('reset','Reset fail')}</div><div class="note">POS (0–100%) can drive a control valve AI port; OUT stays energised during a PST so the valve remains available on demand.</div>`,
  init:()=>({ph:0,pos:100,t:0,next:null,fail:0,req:0,pi:0}),
  act:(c,a)=>{if(a==='pst'){c.s.req=1;}else if(a==='reset')c.s.fail=0;return'rr';},
  run:(c,x,dt,s)=>{const p=c.p;const ok=x[0];if(s.next==null)s.next=Sim.t+(+p.interval||3600);
    if((x[1]&&!s.pi)||s.req||(p.auto&&Sim.t>=s.next)){if(ok&&s.ph===0){s.ph=1;s.fail=0;}s.req=0;s.next=Sim.t+(+p.interval||3600);}s.pi=x[1];
    if(!ok){s.ph=0;s.pos=0;}else if(s.ph===0){s.pos=100;}
    else if(s.ph===1){s.pos-=p.speed*dt;if(s.pos<=p.travel){s.pos=+p.travel;s.ph=2;s.t=0;}}
    else if(s.ph===2){s.t+=dt;if(s.t>=p.hold){if(p.simfail)s.fail=1;s.ph=3;}}
    else{s.pos+=p.speed*dt;if(s.pos>=100){s.pos=100;s.ph=0;}}
    s.alms=s.fail?[{txt:`${c.tag} PST FAILED`,lvl:'amber'}]:[];s.disp=s.ph?'PST '+s.pos.toFixed(0)+'%':(ok?'OPEN '+s.pos.toFixed(0)+'%':'TRIPPED');if(!ok)s.trip=1;else s.trip=0;
    return[ok,s.pos,ON(s.ph>0),s.fail];}});

/* ---- voters ---- */
defFB('lsavtr','Analog voter (LSAVTR)','SIS','AVT-',{sis:true,short:'LSAVTR',icon:'AVTR',w:160,
  ins:c=>[...Array.from({length:c.p.n},(_,i)=>['i'+(i+1),'ana','IN'+(i+1)]),['rst','disc','RESET']],outs:[['q','disc','OUT'],['dev','disc','DEV ALM'],['vc','ana','VOTES']],
  defaults:{n:3,m:2,dir:'high',lim:80,hys:2,bad:'trip',dev:0,latch:false,tv:'1',byp:Array(8).fill(false)},
  params:[{k:'n',l:'Number of inputs (N)',t:'n',min:2,max:8,step:1,rr:1},{k:'m',l:'Votes required to trip (M of N)',t:'n',min:1,max:8,step:1},{k:'dir',l:'Vote to trip when input is',t:'s',opts:[['high','Above limit'],['low','Below limit']]},{k:'lim',l:'Trip limit',t:'n',step:'any'},{k:'hys',l:'Hysteresis',t:'n',min:0,step:'any'},
    {k:'bad',l:'Bad / disconnected input',t:'s',opts:[['trip','Counts as a vote to trip'],['ignore','Ignored']]},{k:'dev',l:'Deviation alarm limit (0 = off)',t:'n',min:0,step:'any'},{k:'latch',l:'Latch trip until reset',t:'b'},TVPAR],
  pre:c=>`<div class="note">Voting: ${Math.min(c.p.m,c.p.n)}oo${c.p.n}</div>`,post:c=>H.sec('Bypass inputs')+bypRow(c,c.p.n,'Input ')+SISBTN(c),act:resetAct,init:()=>({v:[],lat:0,pr:0}),
  run:(c,x,dt,s,ins)=>{const p=c.p,n=p.n;let votes=0;const valid=[];
    for(let i=0;i<n;i++){if(p.byp[i])continue;const v=x[i],b=bad_(c,'i'+(i+1),v);if(b){if(p.bad==='trip')votes++;continue;}valid.push(v);
      s.v[i]=p.dir==='high'?(v>=p.lim?1:(v<p.lim-p.hys?0:(s.v[i]||0))):(v<=p.lim?1:(v>p.lim+p.hys?0:(s.v[i]||0)));votes+=s.v[i];}
    const raw=votes>=Math.min(p.m,n);const rst=x[n];if(raw)s.lat=1;else if(rst&&!s.pr)s.lat=0;s.pr=rst;
    const trip=p.latch?!!s.lat:raw;s.trip=trip?1:0;const dev=p.dev>0&&valid.length>1&&(Math.max(...valid)-Math.min(...valid))>p.dev;
    s.alms=[...(dev?[{txt:`${c.tag} input deviation`,lvl:'amber'}]:[]),...(p.byp.slice(0,n).some(Boolean)?[{txt:`${c.tag} input bypassed`,lvl:'amber'}]:[])];
    s.disp=(trip?'TRIPPED':'NORMAL')+`  ${votes}/${n}`;return[tripOut(p,trip),ON(dev),votes];}});
defFB('lsdvtr','Discrete voter (LSDVTR)','SIS','DVT-',{sis:true,short:'LSDVTR',icon:'DVTR',w:160,
  ins:c=>[...Array.from({length:c.p.n},(_,i)=>['i'+(i+1),'disc','IN'+(i+1)]),['rst','disc','RESET']],outs:[['q','disc','OUT'],['vc','ana','VOTES']],
  defaults:{n:3,m:2,vote:'1',latch:false,tv:'1',byp:Array(8).fill(false)},
  params:[{k:'n',l:'Number of inputs (N)',t:'n',min:2,max:8,step:1,rr:1},{k:'m',l:'Votes required to trip (M of N)',t:'n',min:1,max:8,step:1},{k:'vote',l:'Input votes to trip when',t:'s',opts:[['1','Input = 1'],['0','Input = 0']]},{k:'latch',l:'Latch trip until reset',t:'b'},TVPAR],
  pre:c=>`<div class="note">Voting: ${Math.min(c.p.m,c.p.n)}oo${c.p.n}</div>`,post:c=>H.sec('Bypass inputs')+bypRow(c,c.p.n,'Input ')+SISBTN(c),act:resetAct,init:()=>({lat:0,pr:0}),
  run:(c,x,dt,s)=>{const p=c.p,n=p.n;let votes=0;for(let i=0;i<n;i++){if(p.byp[i])continue;if(x[i]===(+p.vote))votes++;}
    const raw=votes>=Math.min(p.m,n);const rst=x[n];if(raw)s.lat=1;else if(rst&&!s.pr)s.lat=0;s.pr=rst;const trip=p.latch?!!s.lat:raw;s.trip=trip?1:0;
    s.alms=p.byp.slice(0,n).some(Boolean)?[{txt:`${c.tag} input bypassed`,lvl:'amber'}]:[];s.disp=(trip?'TRIPPED':'NORMAL')+`  ${votes}/${n}`;return[tripOut(p,trip),votes];}});

/* ---- cause & effect, monitor, effect ---- */
defFB('lscem','Cause & effect matrix (LSCEM)','SIS','CEM-',{sis:true,short:'LSCEM',icon:'CEM',w:160,
  ins:c=>[...Array.from({length:c.p.nc},(_,i)=>['c'+(i+1),'disc',(c.p.cn[i]||'CAUSE '+(i+1)).slice(0,14)]),...(c.p.sm?[['st','ana','STATE']]:[]),['rst','disc','RESET']],
  outs:c=>[...Array.from({length:c.p.ne},(_,i)=>['e'+(i+1),'disc',(c.p.en[i]||'EFFECT '+(i+1)).slice(0,14)]),['fo','ana','FIRST OUT']],
  defaults:{nc:4,ne:4,mx:mkMatrix(16,16,true),byp:Array(16).fill(false),latch:false,tv:'1',sm:false,mk:Array.from({length:16},()=>Array(8).fill(true)),cn:Array(16).fill(''),en:Array(16).fill('')},
  params:[{k:'nc',l:'Causes (inputs, max 16)',t:'n',min:1,max:16,step:1,rr:1},{k:'ne',l:'Effects (outputs, max 16)',t:'n',min:1,max:16,step:1,rr:1},{k:'latch',l:'Latch effects until reset',t:'b'},{k:'sm',l:'State-based cause masking (STATE input)',t:'b',rr:1},TVPAR],
  post:c=>H.sec('Matrix (click: cause → effect)')+mxHTML(c,'mx',c.p.nc,c.p.ne,'C','E')+(c.p.sm?H.sec('State masking (click: cause active in state)')+mxHTML(c,'mk',c.p.nc,8,'C','S'):'')+
    H.sec('Bypass causes')+Array.from({length:c.p.nc},(_,i)=>H.chk(c,'byp.'+i,'Cause '+(i+1)+' bypass')).join('')+H.sec('Names')+Array.from({length:c.p.nc},(_,i)=>H.txt(c,'cn.'+i,'Cause '+(i+1))).join('')+Array.from({length:c.p.ne},(_,i)=>H.txt(c,'en.'+i,'Effect '+(i+1))).join('')+
    `<div class="note">First out: the first active cause is captured (output FIRST OUT = cause number) until the trip clears / is reset.</div>`+SISBTN(c),
  act:(c,a)=>{if(a==='reset'){c.s.latA=[];c.s.fo=0;return'rr';}},init:()=>({latA:[],pr:0,fo:0}),
  run:(c,x,dt,s)=>{const p=c.p,sm=p.sm;const st=sm?Math.round(x[p.nc]):0;const rst=x[p.nc+(sm?1:0)];const t=Array(p.ne).fill(0);let first=-1;
    for(let i=0;i<p.nc;i++){if(p.byp[i]||!x[i])continue;if(sm&&!(st>=1&&st<=8&&p.mk[i][st-1]))continue;if(first<0)first=i;for(let j=0;j<p.ne;j++)if(p.mx[i][j])t[j]=1;}
    const out=[];let any=0;for(let j=0;j<p.ne;j++){if(t[j])s.latA[j]=1;else if(rst&&!s.pr)s.latA[j]=0;const tr=p.latch?!!s.latA[j]:!!t[j];if(tr)any=1;out.push(tripOut(p,tr));}
    s.pr=rst;if(any){if(!s.fo&&first>=0)s.fo=first+1;}else s.fo=0;
    s.trip=any;s.fot=s.fo?(p.cn[s.fo-1]||'cause '+s.fo):'';s.alms=p.byp.slice(0,p.nc).some(Boolean)?[{txt:`${c.tag} cause bypassed`,lvl:'amber'}]:[];
    s.disp=any?('TRIP: '+(s.fot||'').slice(0,13)):'NORMAL';return[...out,s.fo];}});
defFB('lsmon','Monitor block (LSMON)','SIS','MON-',{sis:true,short:'LSMON',icon:'MON',w:160,
  ins:c=>Array.from({length:c.p.ni},(_,i)=>['i'+(i+1),'disc','IN '+(i+1)]),outs:c=>Array.from({length:c.p.no},(_,i)=>['o'+(i+1),'disc','OUT '+(i+1)]),
  defaults:{ni:8,no:4,mx:mkMatrix(32,8,true),mode:['any','any','any','any','any','any','any','any'],tv:'1'},
  params:[{k:'ni',l:'Inputs (max 32)',t:'n',min:1,max:32,step:1,rr:1},{k:'no',l:'Outputs (max 8)',t:'n',min:1,max:8,step:1,rr:1},TVPAR],
  post:c=>H.sec('Association (input → output)')+mxHTML(c,'mx',c.p.ni,c.p.no,'I','O')+H.sec('Output logic')+Array.from({length:c.p.no},(_,j)=>H.sel(c,'mode.'+j,'Output '+(j+1),[['any','Trip if ANY assigned input = 1'],['all','Trip if ALL assigned inputs = 1']])).join(''),
  run:(c,x,dt,s)=>{const p=c.p;const out=[];let any=0;for(let j=0;j<p.no;j++){let n=0,a=0;for(let i=0;i<p.ni;i++)if(p.mx[i][j]){n++;if(x[i])a++;}
      const tr=n>0&&(p.mode[j]==='all'?a===n:a>0);if(tr)any=1;out.push(tripOut(p,tr));}s.trip=any;s.disp=any?'TRIPPED':'NORMAL';return out;}});
defFB('lseffect','Effect block (LSEFFECT)','SIS','EFF-',{sis:true,short:'LSEFFECT',icon:'EFF',w:160,
  ins:c=>[...Array.from({length:c.p.n},(_,i)=>['i'+(i+1),'disc','TRIP '+(i+1)]),['byp','disc','BYPASS'],['rst','disc','RESET']],outs:[['q','disc','OUT'],['act','disc','TRIPPED']],
  defaults:{n:4,logic:'any',delay:0,latch:false,tv:'1'},
  params:[{k:'n',l:'Trip inputs (max 4)',t:'n',min:1,max:4,step:1,rr:1},{k:'logic',l:'Final element trips when',t:'s',opts:[['any','ANY input = 1'],['all','ALL inputs = 1']]},{k:'delay',l:'Trip delay (s)',t:'n',min:0,step:'any'},{k:'latch',l:'Latch until reset',t:'b'},TVPAR],
  post:c=>SISBTN(c),act:resetAct,init:()=>({lat:0,pr:0,et:0}),
  run:(c,x,dt,s)=>{const p=c.p,n=p.n;const v=x.slice(0,n);const byp=x[n],rst=x[n+1];let raw=p.logic==='all'?v.every(Boolean):v.some(Boolean);if(byp)raw=false;
    s.et=raw?s.et+dt:0;const d=raw&&s.et>=(+p.delay||0);if(d)s.lat=1;else if(rst&&!s.pr)s.lat=0;s.pr=rst;const trip=p.latch?!!s.lat:d;s.trip=trip?1:0;
    s.alms=byp?[{txt:`${c.tag} bypassed`,lvl:'amber'}]:[];s.disp=trip?'TRIPPED':byp?'BYPASSED':'NORMAL';return[tripOut(p,trip),ON(trip)];}});

/* ---- state machine and sequencer ---- */
defFB('lsstd','State transition diagram (LSSTD)','SIS','STD-',{sis:true,short:'LSSTD',icon:'STD',w:160,
  ins:c=>[...Array.from({length:c.p.nt},(_,i)=>['t'+(i+1),'disc',(c.p.tn[i]||'TRANS '+(i+1)).slice(0,14)]),['rst','disc','RESET']],
  outs:c=>[['st','ana','STATE #'],...Array.from({length:c.p.ns},(_,i)=>['s'+(i+1),'disc',(c.p.sn[i]||'STATE '+(i+1)).slice(0,12)])],
  defaults:{ns:4,nt:4,init:1,tr:Array.from({length:8},(_,i)=>({from:i<3?i+1:4,to:i<3?i+2:1,inp:i+1})),sn:Array(8).fill(''),tn:Array(8).fill('')},
  params:[{k:'ns',l:'States (max 8)',t:'n',min:2,max:8,step:1,rr:1},{k:'nt',l:'Transition inputs (max 8)',t:'n',min:1,max:8,step:1,rr:1},{k:'init',l:'Initial state',t:'n',min:1,max:8,step:1}],
  post:c=>H.sec('Transitions (first match fires each scan)')+Array.from({length:c.p.nt},(_,i)=>`<div class="irow"><span>T${i+1}: from</span><input type="number" min="1" max="${c.p.ns}" data-p="tr.${i}.from" data-t="n" value="${c.p.tr[i].from}" style="width:46px"><span style="flex:none">→</span><input type="number" min="1" max="${c.p.ns}" data-p="tr.${i}.to" data-t="n" value="${c.p.tr[i].to}" style="width:46px"></div>`).join('')+
    H.sec('State names')+Array.from({length:c.p.ns},(_,i)=>H.txt(c,'sn.'+i,'State '+(i+1))).join('')+H.sec('Transition input names')+Array.from({length:c.p.nt},(_,i)=>H.txt(c,'tn.'+i,'Transition '+(i+1))).join('')+`<div class="btnrow">${H.btn('reset','Reset to initial')}</div>`,
  act:(c,a)=>{if(a==='reset'){c.s.cur=null;return'rr';}},init:()=>({cur:null}),
  run:(c,x,dt,s)=>{const p=c.p;if(s.cur==null||x[p.nt])s.cur=clamp(+p.init||1,1,p.ns);
    for(let i=0;i<p.nt;i++){const t=p.tr[i];if(x[i]&&+t.from===s.cur){s.cur=clamp(+t.to||1,1,p.ns);break;}}
    s.disp=(p.sn[s.cur-1]||'STATE '+s.cur).slice(0,14);return[s.cur,...Array.from({length:p.ns},(_,i)=>ON(i+1===s.cur))];}});
defFB('lsseq','Step sequencer (LSSEQ)','SIS','SEQ-',{sis:true,short:'LSSEQ',icon:'SEQ',w:160,
  ins:[['seq','ana','STEP #']],outs:c=>Array.from({length:c.p.no},(_,i)=>['o'+(i+1),'disc',(c.p.on[i]||'OUT '+(i+1)).slice(0,14)]),
  defaults:{no:4,ns:8,sm:mkMatrix(16,8,true),on:Array(8).fill('')},
  params:[{k:'no',l:'Outputs (max 8)',t:'n',min:1,max:8,step:1,rr:1},{k:'ns',l:'Steps (max 16)',t:'n',min:1,max:16,step:1,rr:1}],
  post:c=>H.sec('Outputs active per step (click)')+mxHTML(c,'sm',c.p.ns,c.p.no,'S','O')+H.sec('Output names')+Array.from({length:c.p.no},(_,i)=>H.txt(c,'on.'+i,'Output '+(i+1))).join('')+`<div class="note">Step 0 (or beyond the last step) turns all outputs off.</div>`,
  run:(c,x,dt,s)=>{const p=c.p;const st=Math.round(x[0]);const ok=st>=1&&st<=p.ns;s.disp='STEP '+(ok?st:0);return Array.from({length:p.no},(_,j)=>ON(ok&&p.sm[st-1][j]));}});
defFB('lsalm','Alarm (LSALM)','SIS','SAL-',{sis:true,short:'LSALM',icon:'ALM',ins:[['i','ana','IN']],
  outs:c=>ALMKEYS.filter(k=>c.p.al[k[0]].en).map(k=>['a'+k[0],'disc',k[1]]),
  defaults:{al:alarmDef([90,80,20,10]),db:2},
  post:c=>H.sec('Alarm limits (in input units)')+ALMKEYS.map(k=>H.alarm(c,k[0],k[1],'')).join('')+H.num(c,'db','Deadband',{min:0}),init:()=>({al:{}}),
  run:(c,x,dt,s)=>{const p=c.p,out=[];s.alms=[];for(const k of ALMKEYS){const key=k[0];if(!p.al[key].en){s.al[key]=0;continue;}s.al[key]=hyst(s.al[key]||0,x[0],+p.al[key].sp,+p.db||0,key==='hh'||key==='h');out.push(s.al[key]);if(s.al[key])s.alms.push({txt:`${c.tag} ${k[1]} ${x[0].toFixed(1)}`,lvl:k[2]});}
    s.disp=s.alms.length?s.alms[0].txt.split(' ').slice(1,2)[0]+' ALARM':'NORMAL';return out;}});
defFB('lslim','Limit (LSLIM)','SIS','SLM-',{sis:true,short:'LSLIM',icon:'LIM',ins:[['i','ana','IN']],outs:[['q','ana','OUT'],['rng','disc','OUT OF RANGE']],defaults:{lo:0,hi:100,mode:'clamp',defv:0},
  params:[{k:'lo',l:'Low limit',t:'n',step:'any'},{k:'hi',l:'High limit',t:'n',step:'any'},{k:'mode',l:'If input out of range',t:'s',opts:[['clamp','Clamp to limit'],['default','Use default value'],['last','Hold last in-range value']],rr:1},{k:'defv',l:'Default value',t:'n',step:'any',show:p=>p.mode==='default'}],
  run:(c,x,dt,s)=>{const p=c.p,v=x[0];const o=v<p.lo||v>p.hi;let q=v;if(!o)s.last=v;else q=p.mode==='clamp'?clamp(v,p.lo,Math.max(p.lo,p.hi)):p.mode==='default'?+p.defv:(s.last??clamp(v,p.lo,p.hi));return[q,ON(o)];}});
defFB('lscmp','Comparator (LSCMP)','SIS','SCP-',{sis:true,short:'LSCMP',icon:'CMP',ins:[['a','ana','IN1'],['b','ana','IN2']],outs:[['q','disc','OUT']],defaults:{op:'>',lo:0,hi:100},
  params:[{k:'op',l:'Comparison',t:'s',opts:[['<','IN1 < IN2'],['>','IN1 > IN2'],['=','IN1 = IN2'],['!=','IN1 ≠ IN2'],['range','IN1 within range']],rr:1},{k:'lo',l:'Range low',t:'n',step:'any',show:p=>p.op==='range'},{k:'hi',l:'Range high',t:'n',step:'any',show:p=>p.op==='range'}],
  run:(c,x)=>{const p=c.p,a=x[0],b=x[1];const q=p.op==='<'?a<b:p.op==='>'?a>b:p.op==='='?Math.abs(a-b)<1e-9:p.op==='!='?Math.abs(a-b)>=1e-9:(a>=p.lo&&a<=p.hi);return[ON(q)];}});
defFB('lsmid','Middle signal select (LSMID)','SIS','MID-',{sis:true,short:'LSMID',icon:'MID',ins:c=>Array.from({length:c.p.n},(_,i)=>['i'+(i+1),'ana','IN'+(i+1)]),outs:[['q','ana','OUT'],['bad','disc','BAD']],defaults:{n:3},
  params:[{k:'n',l:'Number of inputs',t:'n',min:2,max:8,step:1,rr:1}],
  run:(c,x,dt,s)=>{const v=[];for(let i=0;i<c.p.n;i++)if(!bad_(c,'i'+(i+1),x[i]))v.push(x[i]);v.sort((a,b)=>a-b);const k=v.length;const q=k===0?(s.last??0):k%2?v[(k-1)/2]:(v[k/2-1]+v[k/2])/2;s.last=q;
    s.alms=k<c.p.n?[{txt:`${c.tag} ${c.p.n-k} bad input(s)`,lvl:'amber'}]:[];return[q,ON(k<c.p.n)];}});
defFB('lsbfi','Boolean fan input (LSBFI)','SIS','BFI-',{sis:true,short:'LSBFI',icon:'BFI',ins:[['i','ana','IN (binary)']],outs:c=>Array.from({length:c.p.n},(_,i)=>['b'+i,'disc','BIT '+i]),defaults:{n:8},
  params:[{k:'n',l:'Number of bits',t:'n',min:2,max:16,step:1,rr:1}],run:(c,x,dt,s)=>{const v=Math.max(0,Math.round(x[0]))|0;s.disp=String(v);return Array.from({length:c.p.n},(_,i)=>(v>>i)&1);}});
defFB('lsbfo','Boolean fan output (LSBFO)','SIS','BFO-',{sis:true,short:'LSBFO',icon:'BFO',ins:c=>Array.from({length:c.p.n},(_,i)=>['b'+i,'disc','BIT '+i]),outs:[['q','ana','OUT (binary)']],defaults:{n:8},
  params:[{k:'n',l:'Number of bits',t:'n',min:2,max:16,step:1,rr:1}],run:(c,x,dt,s)=>{let v=0;x.forEach((b,i)=>{if(b)v|=1<<i;});s.disp=String(v);return[v];}});

/* ---- edges, flip-flops, logic ---- */
defFB('lsbde','Bi-directional edge trigger (LSBDE)','SIS','BDE-',{sis:true,short:'LSBDE',icon:'BDE',ins:[['i','disc','IN']],outs:[['q','disc','OUT']],run:(c,x,dt,s)=>{const q=s.p!=null&&x[0]!==s.p?1:0;s.p=x[0];return[q];}});
defFB('lspde','Positive edge trigger (LSPDE)','SIS','PDE-',{sis:true,short:'LSPDE',icon:'PDE',ins:[['i','disc','IN']],outs:[['q','disc','OUT']],run:(c,x,dt,s)=>{const q=x[0]&&!s.p?1:0;s.p=x[0];return[q];}});
defFB('lsnde','Negative edge trigger (LSNDE)','SIS','NDE-',{sis:true,short:'LSNDE',icon:'NDE',ins:[['i','disc','IN']],outs:[['q','disc','OUT']],run:(c,x,dt,s)=>{const q=!x[0]&&s.p?1:0;s.p=x[0];return[q];}});
defFB('lsrs','Reset / set flip-flop (LSRS)','SIS','SRS-',{sis:true,short:'LSRS',icon:'RS',ins:[['r','disc','RESET'],['s','disc','SET']],outs:[['q','disc','OUT']],run:(c,x,dt,s)=>{const[r,st]=x;if(r)s.q=0;else if(st)s.q=1;return[s.q||0];}});
defFB('lssr','Set / reset flip-flop (LSSR)','SIS','SSR-',{sis:true,short:'LSSR',icon:'SR',ins:[['s','disc','SET'],['r','disc','RESET']],outs:[['q','disc','OUT']],run:(c,x,dt,s)=>{const[st,r]=x;if(st)s.q=1;else if(r)s.q=0;return[s.q||0];}});
const sisLogic=(id,name,short,fn)=>defFB(id,name,'SIS',short.slice(2)+'-',{sis:true,short,icon:short.slice(2),ins:c=>inList(c.p.n,'disc','IN'),outs:[['q','disc','OUT']],defaults:{n:2},params:[{k:'n',l:'Number of inputs',t:'n',min:2,max:16,step:1,rr:1}],run:(c,x)=>[fn(x)]});
sisLogic('lsand','Logical AND (LSAND)','LSAND',x=>ON(x.every(Boolean)));sisLogic('lsnand','Not AND (LSNAND)','LSNAND',x=>ON(!x.every(Boolean)));
sisLogic('lsor','Logical OR (LSOR)','LSOR',x=>ON(x.some(Boolean)));sisLogic('lsnor','Not OR (LSNOR)','LSNOR',x=>ON(!x.some(Boolean)));
defFB('lsnot','Not (LSNOT)','SIS','NOT-',{sis:true,short:'LSNOT',icon:'NOT',ins:[['i','disc','IN']],outs:[['q','disc','OUT']],run:(c,x)=>[ON(!x[0])]});
defFB('lsxor','Exclusive OR (LSXOR)','SIS','XOR-',{sis:true,short:'LSXOR',icon:'XOR',ins:[['a','disc','IN1'],['b','disc','IN2']],outs:[['q','disc','OUT']],run:(c,x)=>[ON(x[0]!==x[1])]});
defFB('lsxnor','Exclusive NOR (LSXNOR)','SIS','XNR-',{sis:true,short:'LSXNOR',icon:'XNOR',ins:[['a','disc','IN1'],['b','disc','IN2']],outs:[['q','disc','OUT']],run:(c,x)=>[ON(x[0]===x[1])]});

/* ---- timers and calculation ---- */
const SPT={k:'pt',l:'Time (s)',t:'n',min:0,step:'any'};
defFB('lsoffd','Off-delay timer (LSOFFD)','SIS','OFD-',{sis:true,short:'LSOFFD',icon:'OFFD',ins:[['i','disc','IN']],outs:[['q','disc','OUT'],['et','ana','ELAPSED']],defaults:{pt:5},params:[SPT],
  run:(c,x,dt,s)=>{const pt=+c.p.pt||0;if(x[0]){s.q=1;s.et=0;}else if(s.q){s.et=(s.et||0)+dt;if(s.et>=pt){s.q=0;s.et=pt;}}return[s.q||0,s.et||0];}});
defFB('lsond','On-delay timer (LSOND)','SIS','OND-',{sis:true,short:'LSOND',icon:'OND',ins:[['i','disc','IN']],outs:[['q','disc','OUT'],['et','ana','ELAPSED']],defaults:{pt:5},params:[SPT],
  run:(c,x,dt,s)=>{const pt=+c.p.pt||0;s.et=x[0]?Math.min(pt,(s.et||0)+dt):0;return[ON(x[0]&&s.et>=pt),s.et];}});
defFB('lsret','Retentive timer (LSRET)','SIS','RET-',{sis:true,short:'LSRET',icon:'RET',ins:[['i','disc','IN'],['r','disc','RESET']],outs:[['q','disc','OUT'],['et','ana','ELAPSED']],defaults:{pt:10},params:[SPT],
  run:(c,x,dt,s)=>{const pt=+c.p.pt||0;if(x[1])s.et=0;else if(x[0])s.et=Math.min(pt,(s.et||0)+dt);return[ON((s.et||0)>=pt&&(pt>0||x[0])),s.et||0];}});
defFB('lstp','Timed pulse (LSTP)','SIS','STP-',{sis:true,short:'LSTP',icon:'TP',ins:[['i','disc','IN']],outs:[['q','disc','OUT'],['et','ana','ELAPSED']],defaults:{pt:5},params:[SPT],
  run:(c,x,dt,s)=>{const pt=+c.p.pt||0;if(x[0]&&!s.pi){s.run=1;s.et=0;}s.pi=x[0];if(s.run){s.et+=dt;if(s.et>=pt){s.run=0;}}return[s.run||0,s.run?s.et:0];}});
defFB('lscalc','Calculation / logic (LSCALC)','SIS','SCA-',{sis:true,short:'LSCALC',icon:'CALC',w:160,ins:c=>inList(c.p.n,'ana','IN'),outs:[['q','ana','OUT'],['d','disc','OUT>0']],defaults:{n:2,expr:'IF(IN1>IN2, 1, 0)'},
  params:[{k:'n',l:'Number of inputs',t:'n',min:1,max:16,step:1,rr:1},{k:'expr',l:'Expression',t:'ta'}],
  post:c=>`<div class="note">Expression over IN1…IN${c.p.n}: + − * / % ^, comparisons, AND OR NOT, IF() and math functions.</div>`,
  run:(c,x,dt,s)=>{const k=c.p.expr+'|'+c.p.n;if(s.ek!==k){s.ek=k;try{s.fn=compileExpr(c.p.expr,c.p.n);s.err='';}catch(e){s.fn=null;s.err=e.message;}}const v=s.fn?s.fn(x):0;return[v,ON(v>0.5)];}});
