'use strict';
/* ================= inspector HTML helpers ================= */
const H={
  sec:t=>`<div class="isec">${t}</div>`,
  row:(l,i,cls='')=>`<label class="irow ${cls}"><span>${l}</span>${i}</label>`,
  num:(c,k,l,o={})=>H.row(l,`<input type="number" data-p="${k}" data-t="n" value="${esc(getp(c.p,k))}"${o.min!=null?` min="${o.min}"`:''}${o.max!=null?` max="${o.max}"`:''} step="${o.step||'any'}"${o.rr?' data-rr="1"':''}>`),
  txt:(c,k,l,o={})=>H.row(l,`<input type="text" data-p="${k}" data-t="s" value="${esc(getp(c.p,k))}"${o.rr?' data-rr="1"':''}>`),
  ta:(c,k,l)=>H.row(l,`<textarea data-p="${k}" data-t="s" spellcheck="false">${esc(getp(c.p,k))}</textarea>`,'full'),
  sel:(c,k,l,opts,o={})=>{const cur=o.cur!==undefined?o.cur:getp(c.p,k);return H.row(l,`<select data-p="${k}" data-t="${o.num?'n':'s'}"${o.rr?' data-rr="1"':''}>${opts.map(x=>`<option value="${esc(x[0])}"${String(cur)===String(x[0])?' selected':''}>${esc(x[1])}</option>`).join('')}</select>`);},
  chk:(c,k,l,o={})=>H.row(l,`<input type="checkbox" data-p="${k}" data-t="b"${getp(c.p,k)?' checked':''}${o.rr?' data-rr="1"':''}>`),
  color:(c,k,l)=>H.row(l,`<input type="color" data-p="${k}" data-t="s" value="${esc(getp(c.p,k))}">`),
  btn:(a,l,cls='')=>`<button class="btn sm ${cls}" data-act="${a}">${l}</button>`,
  live:(k,t='—')=>`<span class="live" data-live="${k}">${t}</span>`,
  kv:rows=>`<div class="kv">${rows.map(r=>`<span>${r[0]}</span><span data-live="${r[1]}">—</span>`).join('')}</div>`,
  fluidSel:(c,k,l,o={})=>H.sel(c,k,l,(o.none?[[-1,'— none —']]:[]).concat(doc.fluids.map((f,i)=>[i,f.name])),{num:1,...o}),
  alarm:(c,k,l,unit)=>`<div class="irow"><input type="checkbox" data-p="al.${k}.en" data-t="b" data-rr="1"${getp(c.p,'al.'+k+'.en')?' checked':''}><span>${l}</span><input type="number" data-p="al.${k}.sp" data-t="n" step="any" value="${esc(getp(c.p,'al.'+k+'.sp'))}" ${getp(c.p,'al.'+k+'.en')?'':'disabled'}><span style="flex:none;width:34px;color:var(--muted)">${unit||''}</span></div>`,
  params(c,list){return list.filter(it=>!it.show||it.show(c.p)).map(it=>it.t==='n'?H.num(c,it.k,it.l,it):it.t==='s'?H.sel(c,it.k,it.l,it.opts,it):it.t==='b'?H.chk(c,it.k,it.l,it):it.t==='ta'?H.ta(c,it.k,it.l):H.txt(c,it.k,it.l,it)).join('');},
};
const ALMKEYS=[['hh','HH','red'],['h','H','amber'],['l','L','amber'],['ll','LL','red']];
const alarmDef=(sp)=>({hh:{en:true,sp:sp[0]},h:{en:true,sp:sp[1]},l:{en:false,sp:sp[2]},ll:{en:false,sp:sp[3]}});
const R=(c,inner)=>(TYPES[c.type].rot&&c.orient==='v')?`<g transform="translate(${baseSize(c)[1]},0) rotate(90)">${inner}</g>`:inner;
const lnx=(x1,y1,x2,y2,cls='s-ln')=>`<line class="${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
const ORIENT_OPTS=[['h','Horizontal'],['v','Vertical']];
const hasConn=(c,pid)=>!!(c._pc&&c._pc.has(pid));
const lampColors={red:'#e53935',amber:'#ffb300',green:'#43a047',blue:'#1e88e5',white:'#f2f2f2'};
// alarm helper with hysteresis: high=true alarm when v>=sp (clear below sp-db); high=false alarm when v<=sp (clear above sp+db)
const hyst=(prev,v,sp,db,high)=>high?(v>=sp?1:(v<sp-db?0:prev)):(v<=sp?1:(v>sp+db?0:prev));

/* ================= Source / pump ================= */
reg('source',{name:'Source / pump',cat:'Process',prefix:'P-',rot:true,size:()=>[80,80],icon:'PUMP',
  defaults:()=>({ctl:'local',run:true,latch:false,supply:'unlimited',mode:'flow',qset:300,hshut:30,pset:200,fluid:0,temp:20}),
  init(c){c.s={on:false,tripped:false,Q:0,sp:1,hs:0,bad:[],hsuc:1};},
  ports:c=>[...(c.p.supply==='inlet'?[P('suc','pipe','in',0,40,'l')]:[]),P('dis','pipe','out',80,40,'r'),P('run','disc','in',20,0,'t','RUN',{off:c.p.ctl!=='remote'}),P('trip','disc','in',40,0,'t','TRIP'),P('spd','ana','in',60,0,'t','SPD')],
  sym(c){const s=c.s;const fill=s.tripped?'var(--redsoft)':s.on?'var(--oksoft)':'var(--body)';
    return R(c,`${lnx(0,40,16,40,c.p.supply==='inlet'?'s-ln':'s-ln s-dash')}${lnx(64,40,80,40)}<circle class="s-ln" cx="40" cy="40" r="24" style="fill:${fill}"/><path class="s-ln" d="M31 29 L31 51 L55 40 Z" style="fill:var(--ink)"/>`);},
  label(c){const s=c.s,p=c.p;const L=[[c.tag,'tag'],[`${fmt(s.Q*60,0)} L/min`,'val'],[(s.on?'RUN':'STOP')+(p.ctl==='remote'?' · REM':' · LOC'),'val']];
    if(s.sp!==1||hasConn(c,'spd'))L.push([`speed ${fmt(s.sp*100,0)}%`,'val']);for(const b of s.bad)L.push([b,b==='TRIPPED'||b==='NO OUTLET'?'bad':'warn']);return L;},
  insp(c){const p=c.p,s=c.s;return H.sec('Control')+H.sel(c,'ctl','Control',[['local','Local'],['remote','Remote (RUN input)']],{rr:1})+
    (p.ctl==='local'?`<div class="btnrow">${H.btn('start','Start','')}${H.btn('stop','Stop','')} <span class="note">Status: ${H.live('st')}</span></div>`:`<div class="note">Follows the discrete RUN input. Status: ${H.live('st')}</div>`)+
    H.sec('Protection')+H.chk(c,'latch','Latch trip')+`<div class="btnrow">${H.btn('rtrip','Reset trip')} <span class="note">Trip: ${H.live('tr')}</span></div>`+
    H.sec('Hydraulics')+H.sel(c,'supply','Supply',[['unlimited','Unlimited (creates fluid)'],['inlet','From inlet (suction port)']],{rr:1})+
    H.sel(c,'mode','Characteristic',[['flow','Constant flow'],['press','Constant pressure']],{rr:1})+
    H.num(c,'qset',p.mode==='flow'?'Flow (L/min)':'Max flow (L/min)',{min:0})+
    (p.mode==='flow'?H.num(c,'hshut','Shut-off head (m)',{min:0.1}):H.num(c,'pset','Discharge pressure (kPa)',{min:1}))+
    H.sec('Fluid')+H.fluidSel(c,'fluid','Fluid')+H.num(c,'temp','Temperature (°C)')+`<div class="note">Speed (SPD, 0–100%): flow ∝ speed, head ∝ speed².</div>`+
    H.sec('Live')+H.kv([['Flow (L/min)','q'],['Speed','sp'],['Suction head (m)','hs']]);},
  liveInsp(c){const s=c.s;const e=k=>$(`[data-live=${k}]`);if(e('st'))e('st').textContent=s.on?'RUNNING':'STOPPED';if(e('tr'))e('tr').textContent=s.tripped?'TRIPPED':'ok';
    if(e('q'))e('q').textContent=fmt(s.Q*60,1);if(e('sp'))e('sp').textContent=fmt(s.sp*100,0)+'%';if(e('hs'))e('hs').textContent=fmt(s.hsuc,2);},
  act(c,a){if(a==='start'){c.p.run=true;}else if(a==='stop'){c.p.run=false;}else if(a==='rtrip'){c.s.tripped=false;}return'rr';},
  dbl(c){if(c.p.ctl==='local'){c.p.run=!c.p.run;return true;}},
  scan(c){const p=c.p,s=c.s;const trip=D(c,'trip');if(p.latch){if(trip)s.tripped=true;}else s.tripped=!!trip;
    const cmd=p.ctl==='local'?p.run:D(c,'run');s.on=!!cmd&&!s.tripped;const a=A(c,'spd');s.sp=a==null?1:clamp(a/100,0,1.2);},
  post(c){const s=c.s,p=c.p;const cap=p.qset/60*s.sp;s.bad=[];if(s.tripped)s.bad.push('TRIPPED');if(!hasConn(c,'dis'))s.bad.push('NO OUTLET');
    if(s.on&&cap>0.01){if(p.supply==='inlet'&&(!hasConn(c,'suc')||s.hsuc<0.07))s.bad.push('NO SUCTION');else if(hasConn(c,'dis')&&s.Q<(p.mode==='flow'?0.04*cap:0.002))s.bad.push('DEADHEAD');}}
});

/* ================= Vessel ================= */
const INPOS={1:[60],2:[40,80],3:[40,60,80]};
reg('vessel',{name:'Vessel / tank',cat:'Process',prefix:'TK-',rot:true,orient:'v',size:()=>[160,120],icon:'TANK',
  defaults:()=>({vmax:5000,area:2,level0:50,mode:'var',nin:1,nout:1,fluid:0,fluid2:-1,blend:0,temp:20,al:alarmDef([90,80,20,10]),db:2,ltLo:0,ltHi:100}),
  init(c){const p=c.p;c.s={vol:p.vmax*p.level0/100,T:+p.temp,comp:blendComp(p.fluid,p.fluid2,p.blend),al:{hh:0,h:0,l:0,ll:0},qin:0,qout:0,spill:0,lvl:p.level0,lt:0};},
  ports(c){const p=c.p,L=[];(INPOS[p.nin]||[60]).forEach((y,i)=>L.push(P('in'+(i+1),'pipe','in',0,y,'l')));(INPOS[p.nout]||[60]).forEach((y,i)=>L.push(P('out'+(i+1),'pipe','out',160,y,'r')));
    ALMKEYS.forEach((k,i)=>L.push(P(k[0],'disc','out',40+20*i,0,'t',k[1],{off:!p.al[k[0]].en})));L.push(P('lt','ana','out',120,0,'t','LT'));return L;},
  sym(c){const[W,Hh]=dims(c);const v=c.orient==='v',s=c.s,p=c.p;const lvl=clamp(s.vol/p.vmax,0,1);const col=compColor(s.comp)||'var(--pale)';
    const x0=v?20:16,y0=v?18:20,iw=v?W-40:W-32,ih=v?Hh-36:Hh-40,rx=v?22:26;const fy=y0+ih*(1-lvl);const id='cp'+c.id;
    let st='';for(const q of portList(c)){if(q.off)continue;const cls=q.kind==='pipe'?'s-ln':q.kind==='disc'?'s-ln2':'s-ln2';const col2=q.kind==='disc'?'style="stroke:var(--disc)"':q.kind==='ana'?'style="stroke:var(--ana)"':'';
      let x2=q.x,y2=q.y;if(q.side==='t')y2=y0;else if(q.side==='b')y2=y0+ih;else if(q.side==='l')x2=x0;else x2=x0+iw;st+=`<line class="${cls}" ${col2} x1="${q.x}" y1="${q.y}" x2="${x2}" y2="${y2}"/>`;}
    let ticks='';for(const f of[.25,.5,.75]){const ty=y0+ih*(1-f);ticks+=`<line class="s-ln2" x1="${x0}" y1="${ty}" x2="${x0+6}" y2="${ty}"/>`;}
    const over=s.spill>0.01;
    return `${st}<defs><clipPath id="${id}"><rect x="${x0}" y="${y0}" width="${iw}" height="${ih}" rx="${rx}"/></clipPath></defs><rect x="${x0}" y="${y0}" width="${iw}" height="${ih}" rx="${rx}" style="fill:var(--paper)"/>
      <rect clip-path="url(#${id})" x="${x0}" y="${fy}" width="${iw}" height="${y0+ih-fy+1}" style="fill:${col};fill-opacity:.85"/><line clip-path="url(#${id})" x1="${x0}" y1="${fy}" x2="${x0+iw}" y2="${fy}" style="stroke:var(--ink);stroke-width:1"/>
      <rect class="s-ln${p.mode==='fixed'?' s-dash':''}" x="${x0}" y="${y0}" width="${iw}" height="${ih}" rx="${rx}" style="${over?'stroke:var(--red);stroke-width:3':''}"/>${ticks}
      <text class="s-txt b l" x="${W/2}" y="${Hh/2+4}" text-anchor="middle" style="paint-order:stroke;stroke:var(--paper);stroke-width:3px">${(s.vol/p.vmax*100).toFixed(1)}%</text>${p.mode==='fixed'?`<text class="s-pl" x="${W/2}" y="${y0+12}" text-anchor="middle">FIXED</text>`:''}
      ${over?`<path d="M${x0+8} ${y0-2} l-4 -8 l8 0 z M${x0+iw-8} ${y0-2} l-4 -8 l8 0 z" style="fill:var(--red)"/>`:''}`;},
  label(c){const s=c.s,p=c.p;const L=[[c.tag,'tag'],[`${fmt(s.vol,0)} L  (${fmt(s.vol/p.vmax*100,1)}%)`,'val'],[`${fmt(s.T,1)} °C`,'val'],[doc.fluids[domFluid(s.comp)].name,'val'],[`in ${fmt(s.qin*60,0)} · out ${fmt(s.qout*60,0)} L/min`,'val']];
    if(s.spill>0.01)L.push(['OVERFLOW','bad']);ALMKEYS.forEach(k=>{if(p.al[k[0]].en&&s.al[k[0]])L.push([k[1]+' ALARM',k[2]==='red'?'bad':'warn']);});return L;},
  insp(c){const p=c.p,s=c.s;return H.sec('Vessel')+H.num(c,'vmax','Max volume (L)',{min:1})+H.num(c,'area','Cross-section area (m²)',{min:.01})+
    H.sel(c,'mode','Level mode',[['var','Variable level (dV/dt = Qin − Qout)'],['fixed','Fixed level (constant-head reservoir)']],{rr:1})+
    H.num(c,'level0','Initial level (%)',{min:0,max:100})+
    `<div class="irow"><span>Live level</span>${H.live('lvl')}</div><input type="range" min="0" max="100" step="0.5" data-live-slider="1" style="width:100%">`+
    H.sel(c,'nin','Inlets',[[1,1],[2,2],[3,3]],{num:1,rr:1})+H.sel(c,'nout','Outlets',[[1,1],[2,2],[3,3]],{num:1,rr:1})+
    H.sec('Contents')+H.fluidSel(c,'fluid','Fluid')+H.fluidSel(c,'fluid2','Blend with',{none:1})+(p.fluid2>=0?H.num(c,'blend','Blend (vol %)',{min:0,max:100}):'')+H.num(c,'temp','Temperature (°C)')+
    `<div class="btnrow">${H.btn('applyc','Apply contents now')}</div>`+
    H.sec('Level alarms (discrete outputs)')+ALMKEYS.map(k=>H.alarm(c,k[0],k[1],'%')).join('')+H.num(c,'db','Deadband (%)',{min:0})+
    H.sec('Level transmitter (LT)')+H.num(c,'ltLo','Range low (%)')+H.num(c,'ltHi','Range high (%)')+
    H.sec('Live')+H.kv([['Volume (L)','v'],['Temperature','t'],['Inflow (L/min)','qi'],['Outflow (L/min)','qo'],['Overflow (L/min)','sp'],['Head (m)','hd'],['NaOH (wt%)','naoh']]);},
  liveInsp(c){const s=c.s,p=c.p;const e=k=>$(`[data-live=${k}]`);const lvl=s.vol/p.vmax*100;if(e('lvl'))e('lvl').textContent=lvl.toFixed(1)+' %';const sl=$('[data-live-slider]');if(sl&&document.activeElement!==sl)sl.value=clamp(lvl,0,100);
    if(e('v'))e('v').textContent=fmt(s.vol,1);if(e('t'))e('t').textContent=fmt(s.T,1)+' °C';if(e('qi'))e('qi').textContent=fmt(s.qin*60,1);if(e('qo'))e('qo').textContent=fmt(s.qout*60,1);if(e('sp'))e('sp').textContent=fmt(s.spill*60,1);
    if(e('hd'))e('hd').textContent=fmt(s.vol/(1000*p.area),3);if(e('naoh'))e('naoh').textContent=naohConc(s.comp)>0.001?fmt(naohWt(s.comp),1):'—';},
  act(c,a){if(a==='applyc'){c.s.T=+c.p.temp;c.s.comp=blendComp(c.p.fluid,c.p.fluid2,c.p.blend);}return'rr';},
  onChange(c,k){if(k==='vmax'){Sim.rebase&&Sim.rebase(()=>{c.s.vol=c.s.lvl/100*c.p.vmax;});}if(k==='level0'&&(Sim.t===0||c.p.mode==='fixed')){Sim.rebase(()=>{c.s.vol=c.p.vmax*c.p.level0/100;c.s.lvl=c.p.level0;});}},
  post(c,dt){const s=c.s,p=c.p;const lvl=s.vol/p.vmax*100;s.lvl=lvl;const db=+p.db||0;
    for(const k of ALMKEYS){const key=k[0];const hi=key==='hh'||key==='h';s.al[key]=p.al[key].en?hyst(s.al[key],lvl,+p.al[key].sp,db,hi):0;sig[c.id+'.'+key]=s.al[key];}
    const sp=(+p.ltHi-+p.ltLo)||100;s.lt=clamp((lvl-p.ltLo)/sp*100,0,100);sig[c.id+'.lt']=s.lt;
    for(const k of ALMKEYS)if(p.al[k[0]].en&&s.al[k[0]])Sim.alarms.push({pg:c._pg.id,txt:`${c.tag} ${k[1]} level ${fmt(lvl,1)}%`,lvl:k[2]});
    if(s.spill>0.01)Sim.alarms.push({pg:c._pg.id,txt:`${c.tag} OVERFLOW`,lvl:'red'});}
});

/* ================= Drain ================= */
reg('drain',{name:'Drain / sink',cat:'Process',prefix:'DR-',rot:true,size:()=>[80,80],icon:'DRN',
  defaults:()=>({}),init(c){c.s={Q:0,tot:0};},
  ports:()=>[P('in','pipe','in',0,40,'l')],
  sym:c=>R(c,`${lnx(0,40,36,40)}<path class="s-ln" d="M36 28 L36 52 M36 40 L60 40 M60 30 L60 50" /><path class="s-ln" d="M60 30 L72 40 L60 50 Z" style="fill:var(--ink)"/>`),
  label:c=>[[c.tag,'tag'],[`${fmt(c.s.Q*60,1)} L/min`,'val'],[`Σ ${fmt(c.s.tot,0)} L`,'val']],
  insp:c=>H.sec('Drain')+`<div class="note">Open to atmosphere (head 0). Accepts any flow.</div>`+H.kv([['Flow (L/min)','q'],['Drained total (L)','t']])+`<div class="btnrow">${H.btn('clr','Reset total')}</div>`,
  liveInsp(c){const e=k=>$(`[data-live=${k}]`);if(e('q'))e('q').textContent=fmt(c.s.Q*60,2);if(e('t'))e('t').textContent=fmt(c.s.tot,1);},
  act(c,a){if(a==='clr')c.s.tot=0;}});

/* ================= Control valve ================= */
const bowtie=(f,extra='')=>`${lnx(0,40,20,40)}${lnx(60,40,80,40)}<path class="s-ln" d="M20 28 L60 52 L60 28 L20 52 Z" style="fill:var(--paper)"/><path d="M20 28 L60 52 L60 28 L20 52 Z" style="stroke:none;fill:var(--ok);fill-opacity:${(.12+.78*f).toFixed(2)}"/>${extra}`;
reg('cv',{name:'Control valve',cat:'Valves',prefix:'FV-',rot:true,size:()=>[80,80],icon:'FV',
  defaults:()=>({mode:'manual',open:true,pos:100,cv:600,chr:'lin',action:'direct',lo:0,hi:100,stroke:10,fail:'closed'}),
  init(c){c.s={pos:c.p.open?c.p.pos:0,tgt:0,Q:0,bad:false};},
  ports:c=>[P('in','pipe','in',0,40,'l'),P('out','pipe','out',80,40,'r'),P('ai','ana','in',40,0,'t','AI',{off:c.p.mode!=='analog'})],
  sym(c){const f=c.s.pos/100;return R(c,bowtie(f,`${lnx(40,40,40,22)}<path class="s-ln" d="M30 22 A10 10 0 0 1 50 22 Z" style="fill:var(--body)"/>${c.p.mode==='analog'?lnx(40,0,40,12,'s-ln2'):''}`));},
  label:c=>[[c.tag,'tag'],[`${fmt(c.s.pos,0)}% open`,'val'],[`${fmt(c.s.Q*60,0)} L/min`,'val'],...(c.s.bad?[['SIGNAL LOSS','warn']]:[])],
  insp(c){const p=c.p;return H.sec('Valve')+H.sel(c,'mode','Mode',[['manual','Manual'],['analog','Analog (AI port)']],{rr:1})+
    (p.mode==='manual'?H.chk(c,'open','Open')+H.num(c,'pos','Opening when open (%)',{min:0,max:100}):
      H.sel(c,'action','Action',[['direct','Direct (signal ↑ = open ↑)'],['reverse','Reverse']])+H.num(c,'lo','Signal at 0% (split range, %)')+H.num(c,'hi','Signal at 100% (%)')+
      H.sel(c,'fail','On signal loss',[['closed','Fail closed'],['open','Fail open'],['hold','Hold last']]))+
    H.num(c,'stroke','Full-stroke time (s)',{min:0})+H.num(c,'cv','Cv (L/min per √m)',{min:0})+H.sel(c,'chr','Characteristic',[['lin','Linear'],['eq','Equal percentage']])+
    `<div class="note">Q = Cv · opening · √Δh</div>`+H.sec('Live')+H.kv([['Position (%)','pos'],['Target (%)','tg'],['Flow (L/min)','q']]);},
  liveInsp(c){const e=k=>$(`[data-live=${k}]`);if(e('pos'))e('pos').textContent=fmt(c.s.pos,1);if(e('tg'))e('tg').textContent=fmt(c.s.tgt,1);if(e('q'))e('q').textContent=fmt(c.s.Q*60,1);},
  dbl(c){if(c.p.mode==='manual'){c.p.open=!c.p.open;return true;}},
  scan(c,dt){const p=c.p,s=c.s;s.bad=false;
    if(p.mode==='manual'){s.tgt=p.open?clamp(p.pos,0,100):0;}
    else{const a=A(c,'ai');if(a==null){s.bad=true;s.tgt=p.fail==='closed'?0:p.fail==='open'?100:s.tgt;}
      else{let f=clamp((a-p.lo)/((p.hi-p.lo)||100),0,1);if(p.action==='reverse')f=1-f;s.tgt=f*100;}}
    const rate=p.stroke>0?100/p.stroke:1e9;const d=s.tgt-s.pos;s.pos+=clamp(d,-rate*dt,rate*dt);},
  kfun(c){const f=c.s.pos/100;if(f<=0.002)return 0;const x=c.p.chr==='eq'?(Math.pow(50,f)-1)/49:f;return c.p.cv/60*x;}
});

/* ================= Solenoid valve ================= */
reg('sv',{name:'Solenoid valve',cat:'Valves',prefix:'XV-',rot:true,size:()=>[80,80],icon:'XV',
  defaults:()=>({nc:true,ovr:'auto',cv:600}),init(c){c.s={open:false,pos:0,Q:0,coil:0};},
  ports:()=>[P('in','pipe','in',0,40,'l'),P('out','pipe','out',80,40,'r'),P('coil','disc','in',40,0,'t','COIL')],
  sym(c){return R(c,bowtie(c.s.open?1:0,`${lnx(40,40,40,26)}<rect class="s-ln" x="28" y="12" width="24" height="14" style="fill:${c.s.coil?'var(--disc)':'var(--body)'};fill-opacity:${c.s.coil?.35:1}"/>${lnx(32,26,48,12,'s-ln2')}`));},
  label:c=>[[c.tag,'tag'],[c.s.open?'OPEN':'CLOSED','val'],[`${c.p.nc?'NC':'NO'} · ${{auto:'Auto',open:'Force open',closed:'Force closed'}[c.p.ovr]}`,'val'],[`${fmt(c.s.Q*60,0)} L/min`,'val']],
  insp:c=>H.sec('Solenoid valve')+H.sel(c,'nc','Normal state',[[true,'Normally closed (energise to open)'],[false,'Normally open (energise to close)']],{})+H.sel(c,'ovr','Override',[['auto','Auto (follow coil)'],['open','Force open'],['closed','Force closed']])+H.num(c,'cv','Cv (L/min per √m)',{min:0})+H.sec('Live')+H.kv([['Coil','co'],['State','st'],['Flow (L/min)','q']]),
  liveInsp(c){const e=k=>$(`[data-live=${k}]`);if(e('co'))e('co').textContent=c.s.coil?'ENERGISED':'off';if(e('st'))e('st').textContent=c.s.open?'OPEN':'CLOSED';if(e('q'))e('q').textContent=fmt(c.s.Q*60,1);},
  dbl(c){const o=['auto','open','closed'];c.p.ovr=o[(o.indexOf(c.p.ovr)+1)%3];return true;},
  scan(c){const s=c.s,p=c.p;s.coil=D(c,'coil');let o=(String(p.nc)==='true')?!!s.coil:!s.coil;if(p.ovr==='open')o=true;else if(p.ovr==='closed')o=false;s.open=o;s.pos=o?100:0;},
  kfun:c=>c.s.open?c.p.cv/60:0,
  onChange(c,k){if(k==='nc')c.p.nc=String(c.p.nc)==='true';}
});

/* ================= Flowmeter ================= */
reg('fm',{name:'Flowmeter',cat:'Instruments',prefix:'FT-',rot:true,size:()=>[120,80],icon:'FT',
  defaults:()=>({unit:'lpm',al:alarmDef([500,400,50,20]),db:2,lo:0,hi:600}),init(c){c.s={Q:0,tot:0,al:{hh:0,h:0,l:0,ll:0},out:0};},
  ports(c){const L=[P('in','pipe','in',0,40,'l'),P('out','pipe','out',120,40,'r')];ALMKEYS.forEach((k,i)=>L.push(P(k[0],'disc','out',20+20*i,0,'t',k[1],{off:!c.p.al[k[0]].en})));L.push(P('ft','ana','out',100,0,'t','FT'));return L;},
  sym(c){const[W,Hh]=dims(c);return `${R(c,`${lnx(0,40,42,40)}${lnx(78,40,120,40)}<circle class="s-ln" cx="60" cy="40" r="18" style="fill:var(--paper)"/>`)}<text class="s-txt b" x="${W/2}" y="${Hh/2+3.5}" text-anchor="middle">FT</text>`;},
  label(c){const s=c.s,u=c.p.unit==='m3h';const L=[[c.tag,'tag'],[u?`${fmt(s.Q*3.6,2)} m³/h`:`${fmt(s.Q*60,1)} L/min`,'val'],[`Σ ${u?fmt(s.tot/1000,3)+' m³':fmt(s.tot,0)+' L'}`,'val']];
    ALMKEYS.forEach(k=>{if(c.p.al[k[0]].en&&s.al[k[0]])L.push([k[1]+' FLOW',k[2]==='red'?'bad':'warn']);});return L;},
  insp(c){const p=c.p;return H.sec('Flowmeter')+H.sel(c,'unit','Readout',[['lpm','L/min'],['m3h','m³/h']])+`<div class="btnrow">${H.btn('clr','Reset totaliser')}</div>`+
    H.sec('Flow alarms (L/min)')+ALMKEYS.map(k=>H.alarm(c,k[0],k[1],'L/min')).join('')+H.num(c,'db','Deadband (L/min)',{min:0})+H.sec('Analog output (FT)')+H.num(c,'lo','Range low (L/min)')+H.num(c,'hi','Range high (L/min)')+
    H.sec('Live')+H.kv([['Flow','q'],['Total (L)','t'],['Output (%)','o']]);},
  liveInsp(c){const e=k=>$(`[data-live=${k}]`);const u=c.p.unit==='m3h';if(e('q'))e('q').textContent=u?fmt(c.s.Q*3.6,3)+' m³/h':fmt(c.s.Q*60,2)+' L/min';if(e('t'))e('t').textContent=fmt(c.s.tot,1);if(e('o'))e('o').textContent=fmt(c.s.out,1);},
  act(c,a){if(a==='clr')c.s.tot=0;},
  post(c,dt){const s=c.s,p=c.p;const q=s.Q*60;s.tot+=Math.max(0,s.Q)*dt;const db=+p.db||0;
    for(const k of ALMKEYS){const key=k[0];s.al[key]=p.al[key].en?hyst(s.al[key],q,+p.al[key].sp,db,key==='hh'||key==='h'):0;sig[c.id+'.'+key]=s.al[key];if(p.al[key].en&&s.al[key])Sim.alarms.push({pg:c._pg.id,txt:`${c.tag} ${k[1]} flow ${fmt(q,0)} L/min`,lvl:k[2]});}
    s.out=clamp((q-p.lo)/((p.hi-p.lo)||1)*100,0,100);sig[c.id+'.ft']=s.out;}
});

/* ================= PI / TI (tap instruments) ================= */
function tapType(id,name,prefix,unit,defs,reader){
  reg(id,{name,cat:'Instruments',prefix,rot:false,orient:'h',size:()=>[120,80],icon:id.toUpperCase(),
    defaults:()=>({loc:'right',al:alarmDef(defs.sp),db:defs.db,lo:defs.lo,hi:defs.hi}),
    init(c){c.s={val:0,al:{hh:0,h:0,l:0,ll:0},out:0,has:false};},
    ports(c){const L=[c.orient==='v'?P('tap','pipe','tap',60,80,'b'):P('tap','pipe','tap',0,40,'l')];ALMKEYS.forEach((k,i)=>L.push(P(k[0],'disc','out',20+20*i,0,'t',k[1],{off:!c.p.al[k[0]].en})));L.push(P('out','ana','out',100,0,'t',id.toUpperCase()));return L;},
    sym(c){const v=c.orient==='v';const loc=c.p.loc;const val=c.s.has||id==='pi'?fmt(c.s.val,id==='pi'?1:1):'--';
      const pos={right:[80,44,'start'],left:[40,44,'end'],top:[60,13,'middle'],bottom:[60,74,'middle']}[loc]||[80,44,'start'];
      return `${v?lnx(60,80,60,58):lnx(0,40,42,40)}<circle class="s-ln" cx="60" cy="40" r="18" style="fill:var(--paper)"/><text class="s-txt b" x="60" y="44" text-anchor="middle">${id.toUpperCase()}</text>
        <text class="s-txt b" x="${pos[0]}" y="${pos[1]}" text-anchor="${pos[2]}" style="paint-order:stroke;stroke:var(--sheet);stroke-width:3px">${val}</text>`;},
    label(c){const L=[[c.tag,'tag'],[`${fmt(c.s.val,1)} ${unit}`,'val']];ALMKEYS.forEach(k=>{if(c.p.al[k[0]].en&&c.s.al[k[0]])L.push([k[1]+' '+id.toUpperCase(),k[2]==='red'?'bad':'warn']);});return L;},
    insp(c){const p=c.p;return H.sec(name)+H.sel(c,'loc','Indication location',[['right','Right'],['left','Left'],['top','Top'],['bottom','Bottom']])+
      H.sel(c,'__orient','Orientation',[['h','Tap at left'],['v','Tap below']],{rr:1,cur:c.orient})+`<div class="note">Single tap port — connect it to any pipe port of a line. It draws no flow.${hasConn(c,'tap')?'':' <b style="color:var(--accent)">Not connected.</b>'}</div>`+
      H.sec('Alarms ('+unit+')')+ALMKEYS.map(k=>H.alarm(c,k[0],k[1],unit)).join('')+H.num(c,'db','Deadband ('+unit+')',{min:0})+H.sec('Analog output')+H.num(c,'lo','Range low ('+unit+')')+H.num(c,'hi','Range high ('+unit+')')+H.sec('Live')+H.kv([['Reading ('+unit+')','v'],['Output (%)','o']]);},
    liveInsp(c){const e=k=>$(`[data-live=${k}]`);if(e('v'))e('v').textContent=fmt(c.s.val,2);if(e('o'))e('o').textContent=fmt(c.s.out,1);},
    post(c,dt){const s=c.s,p=c.p;reader(c,s);const db=+p.db||0;
      for(const k of ALMKEYS){const key=k[0];s.al[key]=p.al[key].en?hyst(s.al[key],s.val,+p.al[key].sp,db,key==='hh'||key==='h'):0;sig[c.id+'.'+key]=s.al[key];if(p.al[key].en&&s.al[key])Sim.alarms.push({pg:c._pg.id,txt:`${c.tag} ${k[1]} ${fmt(s.val,1)} ${unit}`,lvl:k[2]});}
      s.out=clamp((s.val-p.lo)/((p.hi-p.lo)||1)*100,0,100);sig[c.id+'.out']=s.out;}
  });
}
tapType('pi','Pressure indicator','PI-','kPa',{sp:[300,250,20,5],db:2,lo:0,hi:400},(c,s)=>{const n=c._tap;if(n){s.val=9.81*n.h;s.has=true;}else{s.val=0;}});
tapType('ti','Temperature indicator','TI-','°C',{sp:[95,90,10,5],db:1,lo:0,hi:120},(c,s)=>{const n=c._tap;if(n&&n.wet){s.val=n.T;s.has=true;}});
