'use strict';
/* ================= Membrane electrolyser ================= */
const FARADAY=96485,CELL_A=2.85,NCELL=48;
const elSpread=Array.from({length:NCELL},(_,k)=>(((k*7919+13)%97)/97-.5)*0.03);
function depBrineComp(cg){const a=new Float64Array(NF);cg=clamp(cg,0,300);if(cg>=210){const f=(cg-210)/90;a[F_SAT]=f;a[F_DEP]=1-f;}else{const f=cg/210;a[F_DEP]=f;a[F_WATER]=1-f;}return a;}
function causticComp(ck){const a=new Float64Array(NF);const f=clamp(ck/0.76,0,1);a[F_CAUSTIC]=f;a[F_WATER]=1-f;return a;}
reg('elec',{name:'Membrane electrolyser',cat:'Process',prefix:'EL-',rot:false,size:()=>[320,240],inLabel:true,plin:true,icon:'EL',
  defaults:()=>({run:true,src:'local',jset:6,jmax:7,ramp:3,eta:97,cells:Array(NCELL).fill(true),naclAlm:180,naclTrip:140,vAlm:3.3,vTrip:3.5,naohAlm:33.5,naohTrip:35}),
  init(c){c.s={j:0,tripped:false,why:'',held:false,Tc:80,starve:0,Qb:0,Qc:0,I:0,V:0,Vavg:0,Vmin:0,Vmax:0,kW:0,sec:0,naoh:0,cl2:0,h2:0,cl2n:0,h2n:0,cOut:300,wOut:30,wIn:30,
    vk:new Array(NCELL).fill(0),al:{nacl:0,v:0,naoh:0},tot:{naoh:0,cl2:0,h2:0,kwh:0},outB:null,outC:null,nAct:NCELL,tb:80,tc:80};},
  ports:()=>[P('bi','pipe','in',40,240,'b','BRINE IN'),P('bo','pipe','out',40,0,'t','DEPL. BRINE + Cl₂'),P('ci','pipe','in',280,240,'b','CATH. IN'),P('co','pipe','out',280,0,'t','CAUSTIC + H₂'),
    P('isp','ana','in',0,60,'l','ISP'),P('trip','disc','in',0,100,'l','TRIP'),P('load','ana','out',320,60,'r','LOAD'),P('run','disc','out',320,100,'r','RUN'),P('alm','disc','out',320,140,'r','ALM')],
  sym(c){const s=c.s,p=c.p;const live=s.j>0.02;const dep=compColor(s.outB?s.outB.comp:pureComp(F_DEP))||'var(--pipe-empty)',cau=compColor(s.outC?s.outC.comp:pureComp(F_CAUSTIC))||'var(--pipe-empty)';
    const bi=compColor(c._nbi?c._nbi.comp:pureComp(F_SAT))||'var(--pipe-empty)',ci=compColor(c._nci?c._nci.comp:pureComp(F_CAUSTIC))||'var(--pipe-empty)';
    let pl='';for(let k=0;k<NCELL;k++){const on=p.cells[k];const hi=live&&on&&s.vk[k]>p.vAlm;
      pl+=`<rect x="${60+k*5}" y="76" width="3.2" height="92" style="fill:${!on?'var(--pipe-empty)':hi?'var(--red)':live?'var(--disc)':'var(--paper)'};stroke:var(--ink);stroke-width:.5"/>`;}
    const hdr=(x1,y,x2,col)=>`<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" style="stroke:var(--pipe-case);stroke-width:8"/><line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" style="stroke:${col};stroke-width:5"/>`;
    const rs=(x,y1,y2,col)=>`<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" style="stroke:var(--pipe-case);stroke-width:8"/><line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" style="stroke:${col};stroke-width:5"/>`;
    const st=s.tripped?'TRIPPED':s.held?'HELD (interlock)':live?'RUNNING':'STOPPED';
    return `<rect class="s-body" x="0" y="0" width="320" height="240" rx="3"/>
      ${rs(40,0,64,dep)}${hdr(40,64,180,dep)}${rs(280,0,64,cau)}${hdr(190,64,280,cau)}${rs(40,176,240,bi)}${hdr(40,176,180,bi)}${rs(280,176,240,ci)}${hdr(190,176,280,ci)}${pl}
      <text class="s-tag" x="160" y="16" text-anchor="middle">${esc(c.tag)}</text><text class="s-txt b" x="160" y="30" text-anchor="middle" style="fill:${s.tripped?'var(--red)':live?'var(--disc)':'var(--ink)'}">${st} · ${fmt(s.j,2)} kA/m² · ${s.nAct}/48 cells</text>
      <text class="s-txt" x="160" y="196" text-anchor="middle">I ${fmt(s.I/1000,1)} kA   U ${fmt(s.V,1)} V   P ${fmt(s.kW/1000,2)} MW</text>
      <text class="s-txt" x="160" y="210" text-anchor="middle">NaOH ${fmt(s.naoh,3)} t/h   ${s.naoh>0.001?fmt(s.sec,0):'--'} kWh/t   Vcell ${fmt(s.Vavg,2)} V</text>
      <text class="s-txt" x="160" y="224" text-anchor="middle">Brine out ${fmt(s.cOut,0)} g/L · NaOH ${fmt(s.wOut,1)} wt%</text>
      <text class="s-txt b" x="40" y="-8" text-anchor="middle">Cl₂ ${fmt(s.cl2n,0)} Nm³/h</text><text class="s-txt b" x="280" y="-8" text-anchor="middle">H₂ ${fmt(s.h2n,0)} Nm³/h</text>`;},
  label:()=>[],
  insp(c){const p=c.p,s=c.s;return H.sec('Operation')+`<div class="btnrow">${H.btn('start','Start')}${H.btn('stop','Stop')}${H.btn('rtrip','Reset trip')}</div><div class="note">Status: ${H.live('st')}</div>`+
    H.sel(c,'src','Current setpoint',[['local','Local'],['isp','ISP input (0–100% of max)']],{rr:1})+(p.src==='local'?H.num(c,'jset','Setpoint (kA/m²)',{min:0,max:p.jmax,step:.1}):'')+H.num(c,'jmax','Max current density (kA/m²)',{min:1,max:10,step:.1})+
    H.num(c,'ramp','Rectifier ramp (kA/m² per min)',{min:.1,step:.1})+H.num(c,'eta','Current efficiency (%)',{min:50,max:100})+
    H.sec('Cells (click to enable / bypass)')+`<div class="cellgrid" data-cellgrid>${p.cells.map((o,i)=>`<i data-cell="${i}" class="${o?'':'off'}">${i+1}</i>`).join('')}</div>`+
    H.row('Active cells',`<input type="number" min="0" max="48" step="1" data-ncells value="${p.cells.filter(Boolean).length}">`)+`<div class="btnrow">${H.btn('allon','Enable all')}${H.btn('alloff','Disable all')}</div>`+
    H.sec('Protection limits')+H.num(c,'naclAlm','Low anolyte NaCl alarm (g/L)')+H.num(c,'naclTrip','Brine starvation trip (g/L, 5 s)')+H.num(c,'vAlm','High cell voltage alarm (V)',{step:.01})+H.num(c,'vTrip','High cell voltage trip (V)',{step:.01})+
    H.num(c,'naohAlm','High caustic alarm (wt%)',{step:.1})+H.num(c,'naohTrip','High caustic trip (wt%)',{step:.1})+`<div class="note">Trips latch until reset. An active TRIP input before start only holds the cell room off.</div>`+
    H.sec('Report')+H.kv([['Current density','j'],['Stack current','I'],['Stack voltage','V'],['DC power','P'],['Cell voltage avg / min / max','vc'],['Specific energy','sec'],['NaOH (t/h, 100%)','na'],['Cl₂','cl'],['H₂','h2'],['Brine flow','qb'],['Catholyte flow','qc'],['Depleted brine','dep'],['Caustic strength','cs'],['Cell temperature','tc'],['Total NaOH (t)','tn'],['Total Cl₂ (t)','tcl'],['Total H₂ (t)','th'],['Energy (MWh)','te']])+
    H.sec('Cell voltages')+`<div data-live="vchart"></div>`;},
  liveInsp(c){const s=c.s,p=c.p;const e=k=>$(`[data-live=${k}]`),t=(k,v)=>{const q=e(k);if(q)q.textContent=v;};
    t('st',s.tripped?'TRIPPED — '+s.why:s.held?'HELD OFF (TRIP input active)':s.j>0.02?'RUNNING':'STOPPED');t('j',fmt(s.j,2)+' kA/m²');t('I',fmt(s.I/1000,1)+' kA');t('V',fmt(s.V,1)+' V');t('P',fmt(s.kW/1000,3)+' MW');
    t('vc',`${fmt(s.Vavg,3)} / ${fmt(s.Vmin,3)} / ${fmt(s.Vmax,3)} V`);t('sec',s.naoh>0.001?fmt(s.sec,0)+' kWh/t':'—');t('na',fmt(s.naoh,3));t('cl',`${fmt(s.cl,0)} kg/h · ${fmt(s.cl2n,0)} Nm³/h`);t('h2',`${fmt(s.h2,1)} kg/h · ${fmt(s.h2n,0)} Nm³/h`);
    t('qb',fmt(s.Qb*60,0)+' L/min');t('qc',fmt(s.Qc*60,0)+' L/min');t('dep',fmt(s.cOut,1)+' g/L NaCl');t('cs',fmt(s.wOut,2)+' wt% NaOH');t('tc',fmt(s.Tc,1)+' °C');t('tn',fmt(s.tot.naoh/1000,3));t('tcl',fmt(s.tot.cl2/1000,3));t('th',fmt(s.tot.h2/1000,4));t('te',fmt(s.tot.kwh/1000,2));
    const ch=e('vchart');if(ch){const lo=2.0,hi=3.6;let b='';for(let k=0;k<NCELL;k++){const v=s.vk[k];const on=p.cells[k]&&v>0;const h=on?clamp((v-lo)/(hi-lo),0,1)*70:0;b+=`<rect x="${6+k*5.6}" y="${80-h}" width="4.2" height="${h}" style="fill:${on?(v>p.vAlm?'var(--red)':'var(--disc)'):'var(--pipe-empty)'}"/>`;}
      const ay=80-clamp((p.vAlm-lo)/(hi-lo),0,1)*70;ch.innerHTML=`<svg viewBox="0 0 280 96" width="100%"><rect x="0" y="0" width="280" height="96" style="fill:var(--paper);stroke:var(--line)"/>${b}<line x1="0" y1="${ay}" x2="280" y2="${ay}" style="stroke:var(--red);stroke-dasharray:4 3"/><text x="3" y="${ay-2}" style="font:8px var(--font-mono);fill:var(--red)">${p.vAlm} V</text><text x="3" y="92" style="font:8px var(--font-mono);fill:var(--muted)">cells 1–48 (${lo}–${hi} V)</text></svg>`;}},
  act(c,a){const s=c.s;if(a==='start'){c.p.run=true;}else if(a==='stop'){c.p.run=false;}else if(a==='rtrip'){s.tripped=false;s.why='';s.starve=0;}else if(a==='allon'){c.p.cells.fill(true);}else if(a==='alloff'){c.p.cells.fill(false);}return'rr';},
  post(c,dt){const p=c.p,s=c.s;const nAct=p.cells.filter(Boolean).length;s.nAct=nAct;const tripIn=D(c,'trip');const running=s.j>0.02;
    if(tripIn&&running&&!s.tripped){s.tripped=true;s.why='TRIP input';}
    s.held=!!(p.run&&!s.tripped&&tripIn&&!running);
    const allowed=p.run&&!s.tripped&&!tripIn&&nAct>0;let tgt=0;if(allowed){tgt=p.src==='isp'?(A(c,'isp')??0)/100*p.jmax:+p.jset;tgt=clamp(tgt,0,+p.jmax);}
    const rate=(+p.ramp||1)/60;if(s.j<tgt)s.j=Math.min(tgt,s.j+rate*dt);else s.j=Math.max(tgt,s.j-rate*8*dt);if(s.tripped)s.j=0;
    const j=s.j;const Qb=s.Qb,Qc=s.Qc;const bin=c._nbi,cin=c._nci;const bcomp=bin?bin.comp:pureComp(F_SAT),ccomp=cin?cin.comp:pureComp(F_CAUSTIC);
    const cIn=naclOf(bcomp),Tb=bin?bin.T:80,Tcin=cin?cin.T:80,naohIn=naohConc(ccomp);s.tb=Tb;s.tc=Tcin;
    const Icell=j*1000*CELL_A,eta=(+p.eta||97)/100;const nNaOH=eta*Icell/FARADAY;// mol/s per cell
    const cons=nAct*nNaOH*58.44,prod=nAct*nNaOH*0.040;// g/s , kg/s
    let cOut=cIn,cK=naohIn;
    if(j>0.001){cOut=Qb>1e-3?Math.max(0,cIn-cons/Qb):0;cK=Qc>1e-3?naohIn+prod/Qc:0.76;}
    const outB=depBrineComp(cOut),outC=j>0.001||naohIn>0?causticComp(cK):ccomp;s.cOut=cOut;s.wOut=naohConc(outC)>0.001?naohWt(outC):0;s.wIn=naohConc(ccomp)>0.001?naohWt(ccomp):0;
    // voltages
    let sum=0,mn=9,mx=0,heat=0;
    for(let k=0;k<NCELL;k++){if(j>0.001&&p.cells[k]){const v=2.21+0.11*j-0.003*(s.Tc-85)+0.012*Math.max(0,s.wOut-32)+0.004*Math.max(0,200-cOut)+elSpread[k];s.vk[k]=v;sum+=v;mn=Math.min(mn,v);mx=Math.max(mx,v);heat+=Math.max(0,v-2.2)*Icell/1000;}else s.vk[k]=0;}
    s.V=sum;s.I=j>0.001?Icell*nAct:0;s.kW=sum*Icell/1000*(j>0.001?1:0);s.Vavg=nAct&&j>0.001?sum/nAct:0;s.Vmin=j>0.001?mn:0;s.Vmax=mx;
    // thermal
    const cpb=cpOf(bcomp),cpc=cpOf(ccomp),Gb=Qb*rhoOf(bcomp)*cpb,Gc=Qc*rhoOf(ccomp)*cpc,UA=1.0,C=800;
    s.Tc=(C*s.Tc+dt*(heat+Gb*Tb+Gc*Tcin+UA*25))/(C+dt*(Gb+Gc+UA));
    s.outB={T:s.Tc,comp:outB};s.outC={T:s.Tc,comp:outC};
    // production
    const molNaOH=nAct*nNaOH;s.naoh=molNaOH*0.040*3.6;// t/h
    const nCl2=molNaOH/2*1/1,nH2=molNaOH/2;s.cl=nCl2*70.906*3.6;s.h2=nH2*2.016*3.6;s.cl2n=nCl2*0.022414*3600;s.h2n=nH2*0.022414*3600;
    s.sec=s.naoh>0.001?s.kW/s.naoh:0;
    s.tot.naoh+=s.naoh*1000*dt/3600;s.tot.cl2+=s.cl*dt/3600;s.tot.h2+=s.h2*dt/3600;s.tot.kwh+=s.kW*dt/3600;
    // protection
    const live=j>0.5;s.al.nacl=live&&cOut<p.naclAlm?1:0;s.al.v=live&&s.Vmax>p.vAlm?1:0;s.al.naoh=live&&s.wOut>p.naohAlm?1:0;
    if(live&&cOut<p.naclTrip)s.starve+=dt;else s.starve=0;
    if(!s.tripped&&live){if(s.starve>=5){s.tripped=true;s.why='BRINE STARVATION';}else if(s.Vmax>p.vTrip){s.tripped=true;s.why='HIGH CELL VOLTAGE';}else if(s.wOut>p.naohTrip){s.tripped=true;s.why='HIGH CAUSTIC';}}
    sig[c.id+'.load']=clamp(j/(+p.jmax||7)*100,0,100);sig[c.id+'.run']=j>0.05?1:0;const alm=s.tripped||s.al.nacl||s.al.v||s.al.naoh;sig[c.id+'.alm']=alm?1:0;
    const pg=c._pg.id;if(s.tripped)Sim.alarms.push({pg,txt:`${c.tag} TRIPPED: ${s.why}`,lvl:'red'});if(s.al.nacl)Sim.alarms.push({pg,txt:`${c.tag} low anolyte NaCl ${fmt(cOut,0)} g/L`,lvl:'amber'});
    if(s.al.v)Sim.alarms.push({pg,txt:`${c.tag} high cell voltage ${fmt(s.Vmax,2)} V`,lvl:'amber'});if(s.al.naoh)Sim.alarms.push({pg,txt:`${c.tag} high caustic ${fmt(s.wOut,1)} wt%`,lvl:'amber'});}
});

/* ================= PID controller (DeltaV style) ================= */
const PIDST=['PID on error','PI on error, D on PV','I on error, PD on PV','PD on error','P on error, D on PV','2-DOF (BETA / GAMMA)'];
const PIDAL=[['hh','HI_HI','red','HH'],['h','HI','amber','H'],['l','LO','amber','L'],['ll','LO_LO','red','LL'],['dvh','DV_HI','amber','DVH'],['dvl','DV_LO','amber','DVL']];
reg('pid',{name:'PID controller',cat:'Control',prefix:'PIC-',rot:true,size:()=>[180,180],inLabel:true,plin:true,icon:'PID',
  defaults:()=>({mode:'MAN',sp:50,outMan:0,gain:1,reset:60,rate:0,pvft:0,st:0,beta:1,gamma:0,eu0:0,eu100:100,units:'%',splo:0,sphi:100,spUp:0,spDn:0,outHi:100,outLo:0,
    direct:false,spTrack:true,trkEn:false,trkVal:0,ffEn:false,ffGain:1,hys:1,
    al:{hh:{en:false,sp:90},h:{en:false,sp:80},l:{en:false,sp:20},ll:{en:false,sp:10},dvh:{en:false,sp:10},dvl:{en:false,sp:10}},at:{step:5,band:.5,rule:'tl_pi'}}),
  init(c){c.s={pv:0,pvf:null,sp:c.p.sp,out:c.p.outMan,act:c.p.mode,pm:null,pvBad:false,init:false,xp:0,xd:0,ef:0,Df:0,ff:0,al:{hh:0,h:0,l:0,ll:0,dvh:0,dvl:0},hist:[],nh:0,at:{state:'idle'}};},
  ports(c){const p=c.p;const L=[P('cas','ana','in',0,40,'l','CAS_IN'),P('in','ana','in',0,60,'l','IN'),P('ff','ana','in',0,80,'l','FF_VAL'),P('trk','disc','in',0,100,'l','TRK_IN_D'),P('out','ana','out',180,40,'r','OUT')];
    PIDAL.forEach((a,i)=>L.push(P(a[0],'disc','out',180,60+20*i,'r',a[3],{off:!p.al[a[0]].en})));return L;},
  sym(c){const s=c.s,p=c.p;const[W,Hh]=dims(c);const modeCol=s.act==='AUTO'||s.act==='CAS'?'var(--ok)':s.act==='LO'?'var(--ana)':s.act==='OOS'?'var(--red)':'var(--ink)';
    return `<rect class="s-body" x="0" y="0" width="${W}" height="${Hh}" rx="4"/><text class="s-tag" x="${W/2}" y="14" text-anchor="middle">${esc(c.tag)}</text><text class="s-pl" x="${W/2}" y="26" text-anchor="middle">PID</text>
      <text class="s-txt b l" x="${W/2}" y="${Hh/2-14}" text-anchor="middle" style="fill:${modeCol}">${s.act}${s.act!==p.mode?' ('+p.mode+')':''}</text>
      <text class="s-txt" x="${W/2}" y="${Hh/2+2}" text-anchor="middle">PV ${fmt(s.pv,2)}</text><text class="s-txt" x="${W/2}" y="${Hh/2+15}" text-anchor="middle">SP ${fmt(s.sp,2)}</text><text class="s-txt b" x="${W/2}" y="${Hh/2+28}" text-anchor="middle">OUT ${fmt(s.out,1)}%</text>
      ${s.at.state==='run'?`<text class="s-warn" x="${W/2}" y="${Hh-8}" text-anchor="middle">AUTOTUNE</text>`:''}${s.pvBad?`<text class="s-bad" x="${W/2}" y="${Hh-8}" text-anchor="middle">BAD PV</text>`:''}`;},
  label:()=>[],
  insp(c){const p=c.p,s=c.s,at=s.at;const eu=p.units||'';
    const face=`<div class="faceplate"><div class="modes">${['OOS','MAN','AUTO','CAS'].map(m=>`<button class="btn sm${p.mode===m?' on':''}" data-act="mode:${m}">${m}</button>`).join('')}</div>
      <div class="note">Actual mode: ${H.live('act')} ${H.live('flags','')}</div>
      <div class="big"><div>${H.live('pv')}<small>PV (${esc(eu)})</small></div><div>${H.live('sp')}<small>SP (${esc(eu)})</small></div><div>${H.live('out')}<small>OUT (%)</small></div></div>
      ${H.num(c,'sp','Setpoint SP ('+esc(eu)+')')}${H.num(c,'outMan','Output OUT in MAN (%)',{min:0,max:100})}<div data-live="ptrend" style="margin-top:4px"></div></div>`;
    let atui=`<div class="btnrow">${at.state==='run'?H.btn('atstop','Abort','warn'):H.btn('atstart','Start auto-tune')}</div>`;
    if(at.state==='run')atui+=`<div class="note">Relay test running… switches: ${H.live('atn')} · elapsed ${H.live('att')}</div>`;
    if(at.state==='fail')atui+=`<div class="note" style="color:var(--red)">${esc(at.msg||'Auto-tune failed')}</div>`;
    if(at.state==='done'){const r=at.res;atui+=`<div class="kv"><span>Ultimate gain Ku</span><span>${fmt(at.ku,3)}</span><span>Ultimate period Pu</span><span>${fmt(at.pu,1)} s</span><span>GAIN now → new</span><span>${fmt(p.gain,3)} → ${fmt(r.gain,3)}</span><span>RESET now → new</span><span>${fmt(p.reset,1)} → ${fmt(r.reset,1)} s</span><span>RATE now → new</span><span>${fmt(p.rate,1)} → ${fmt(r.rate,1)} s</span></div><div class="btnrow">${H.btn('atapply','Apply')}${H.btn('atdisc','Discard')}</div>`;}
    return H.sec('Faceplate')+face+H.sec('Tuning')+H.num(c,'gain','GAIN',{step:.01})+H.num(c,'reset','RESET (s/repeat)',{min:0})+H.num(c,'rate','RATE (s)',{min:0})+H.num(c,'pvft','PV_FTIME (s)',{min:0})+
      H.sel(c,'st','STRUCTURECONFIG',PIDST.map((t,i)=>[i,t]),{num:1,rr:1})+(p.st===5?H.num(c,'beta','BETA',{step:.05})+H.num(c,'gamma','GAMMA',{step:.05}):'')+
      H.sec('Scaling')+H.num(c,'eu0','PV_SCALE EU0')+H.num(c,'eu100','PV_SCALE EU100')+H.txt(c,'units','Units')+
      H.sec('Limits')+H.num(c,'splo','SP_LO_LIM')+H.num(c,'sphi','SP_HI_LIM')+H.num(c,'spUp','SP_RATE_UP (EU/s, 0 = off)',{min:0})+H.num(c,'spDn','SP_RATE_DN (EU/s, 0 = off)',{min:0})+H.num(c,'outLo','OUT_LO_LIM (%)')+H.num(c,'outHi','OUT_HI_LIM (%)')+
      H.sec('CONTROL_OPTS')+H.chk(c,'direct','Direct acting')+H.chk(c,'spTrack','SP-PV track in Man')+H.chk(c,'trkEn','Track enable (TRK_IN_D → TRK_VAL)',{rr:1})+(p.trkEn?H.num(c,'trkVal','TRK_VAL (%)'):'')+H.chk(c,'ffEn','FF enable',{rr:1})+(p.ffEn?H.num(c,'ffGain','FF_GAIN'):'')+
      H.sec('Alarms')+PIDAL.map(a=>H.alarm(c,a[0],a[1],a[0].startsWith('dv')?esc(eu):esc(eu))).join('')+H.num(c,'hys','ALARM_HYS (% span)',{min:0})+
      H.sec('Auto-tune (relay, Åström–Hägglund)')+H.num(c,'at.step','Relay step (± % OUT)',{min:.5})+H.num(c,'at.band','Noise band (% span)',{min:0,step:.1})+
      H.sel(c,'at.rule','Tuning rule',[['tl_pi','Tyreus–Luyben PI'],['tl_pid','Tyreus–Luyben PID'],['zn_pi','Ziegler–Nichols PI'],['zn_pid','Ziegler–Nichols PID']])+atui;},
  liveInsp(c){const s=c.s,p=c.p;const e=k=>$(`[data-live=${k}]`),t=(k,v)=>{const q=e(k);if(q)q.textContent=v;};
    t('act',s.act);t('flags',[s.pvBad?'· BAD PV':'',s.act==='LO'?'· tracking':'',s.pm==='CAS'&&s.act==='AUTO'?'· CAS shed':''].join(' '));t('pv',fmt(s.pv,2));t('sp',fmt(s.sp,2));t('out',fmt(s.out,1));
    t('atn',s.at.sw||0);t('att',fmt(Sim.t-(s.at.t0||Sim.t),0)+' s');
    const tr=e('ptrend');if(tr){const h=s.hist,W=270,Hh=80;const n=h.length;const span=(p.eu100-p.eu0)||1;const pts=k=>h.map((q,i)=>`${(i/Math.max(1,479)*W).toFixed(1)},${(Hh-clamp(k(q),0,100)/100*(Hh-4)-2).toFixed(1)}`).join(' ');
      tr.innerHTML=`<svg viewBox="0 0 ${W} ${Hh}" width="100%"><rect x="0" y="0" width="${W}" height="${Hh}" style="fill:var(--body);stroke:var(--line)"/>${[25,50,75].map(g=>`<line x1="0" x2="${W}" y1="${Hh-g/100*(Hh-4)-2}" y2="${Hh-g/100*(Hh-4)-2}" style="stroke:var(--line);stroke-width:.5"/>`).join('')}
        <polyline points="${pts(q=>(q.pv-p.eu0)/span*100)}" fill="none" style="stroke:var(--blue);stroke-width:1.4"/><polyline points="${pts(q=>(q.sp-p.eu0)/span*100)}" fill="none" style="stroke:var(--accent);stroke-width:1.2;stroke-dasharray:4 2"/><polyline points="${pts(q=>q.out)}" fill="none" style="stroke:var(--ok);stroke-width:1.2"/></svg><div class="note"><span style="color:var(--blue)">━ PV</span> <span style="color:var(--accent)">╍ SP</span> <span style="color:var(--ok)">━ OUT</span> · 8 min</div>`;}},
  act(c,a){const s=c.s,p=c.p;if(a.startsWith('mode:')){p.mode=a.slice(5);if(p.mode==='MAN')p.outMan=s.out;return'rr';}
    if(a==='atstart'){if(s.pvBad){toast('Cannot auto-tune: PV is bad / IN not connected');return;}s.at={state:'run',t0:Sim.t,sw:0,out0:s.out,dir:0,sp:s.sp,hist:[]};p.mode=p.mode==='MAN'||p.mode==='OOS'?'AUTO':p.mode;return'rr';}
    if(a==='atstop'){s.at={state:'idle'};return'rr';}
    if(a==='atdisc'){s.at={state:'idle'};return'rr';}
    if(a==='atapply'){const r=s.at.res;if(r){p.gain=+r.gain.toFixed(4);p.reset=+r.reset.toFixed(2);p.rate=+r.rate.toFixed(2);}s.at={state:'idle'};return'rr';}},
  onChange(c,k){if(k==='sp'&&c.s.act!=='CAS')c.s.spTargetUser=true;},
  scan(c,dt){const p=c.p,s=c.s;const span=(p.eu100-p.eu0)||1;const toEU=v=>p.eu0+v/100*span,toPct=v=>(v-p.eu0)/span*100;
    let pvIn=A(c,'in');const bad=pvIn==null;s.pvBad=bad;
    if(!bad){if(s.pvf==null)s.pvf=pvIn;const tf=+p.pvft||0;s.pvf=tf>0?s.pvf+(pvIn-s.pvf)*(1-Math.exp(-dt/tf)):pvIn;}
    const pvp=s.pvf==null?0:s.pvf;s.pv=toEU(pvp);
    let act=p.mode;const trk=p.trkEn&&D(c,'trk');const casV=A(c,'cas');
    if(act==='OOS'){}else if(trk)act='LO';else{if(bad&&act!=='MAN')act='MAN';else if(act==='CAS'&&casV==null)act='AUTO';}
    if(s.act!==act){s.init=false;if(s.act==='CAS'&&act==='AUTO'&&p.mode==='CAS')p.sp=+s.sp.toFixed(4);}
    s.pm=p.mode;s.act=act;
    // setpoint
    let spT=s.sp;
    if(act==='CAS')spT=toEU(clamp(casV,0,100));else if(act==='AUTO')spT=+p.sp;
    if(act==='MAN'||act==='OOS'||act==='LO'){if(p.spTrack&&!bad){s.sp=s.pv;if(act!=='OOS')p.sp=+s.sp.toFixed(4);}else s.sp=clamp(+p.sp,p.splo,p.sphi);}
    else{spT=clamp(spT,Math.min(p.splo,p.sphi),Math.max(p.splo,p.sphi));const d=spT-s.sp;const up=+p.spUp||0,dn=+p.spDn||0;
      if(d>0)s.sp+=up>0?Math.min(d,up*dt):d;else s.sp+=dn>0?Math.max(d,-dn*dt):d;}
    const lo=+p.outLo,hi=+p.outHi;
    // auto-tune relay overrides output
    const at=s.at;
    if(at.state==='run'&&!bad&&(act==='AUTO'||act==='CAS'||act==='MAN')){this.relay(c,dt,pvp,toPct(s.sp));}
    else{
      if(at.state==='run'){s.at={state:'fail',msg:'Auto-tune aborted (PV lost)'};}
      if(act==='MAN'){s.out=clamp(+p.outMan,lo,hi);}
      else if(act==='LO'){s.out=clamp(+p.trkVal,lo,hi);p.outMan=s.out;}
      else if(act==='OOS'){}
      else{ // AUTO / CAS : velocity-form PID, anti-windup by output clamping
        const m=p.direct?1:-1;const spp=toPct(s.sp);const e=m*(pvp-spp);const st=p.st|0;
        let xp,xd;const pvm=m*pvp;
        xp=(st===2)?pvm:(st===5?m*(pvp-(+p.beta)*spp):e);
        xd=(st===0||st===3)?e:(st===5?m*(pvp-(+p.gamma)*spp):pvm);
        const ffv=p.ffEn?(A(c,'ff')??0):0;
        if(!s.init){s.xp=xp;s.xd=xd;s.ef=0;s.Df=0;s.ff=ffv;s.init=true;s.dprev=0;}
        const K=+p.gain;const Ti=+p.reset,Td=+p.rate;const hasI=Ti>0&&(st===0||st===1||st===2||st===5);
        let dOut=K*(xp-s.xp);
        if(hasI)dOut+=K*dt/Ti*e;
        let Dk=0;if(Td>0){const a=0.125*Td;s.ef+=(dt/(a+dt))*((xd-s.xd)/dt-s.ef);Dk=K*Td*s.ef;dOut+=Dk-s.Df;s.Df=Dk;}else{s.Df=0;s.ef=0;}
        if(p.ffEn)dOut+=(+p.ffGain)*(ffv-s.ff);
        s.xp=xp;s.xd=xd;s.ff=ffv;
        s.out=clamp(s.out+dOut,lo,hi);p.outMan=+s.out.toFixed(3);
      }
    }
    // alarms
    const hy=(+p.hys||0)/100*span;const a=p.al,v=s.pv;const dv=v-s.sp;
    s.al.hh=a.hh.en?hyst(s.al.hh,v,+a.hh.sp,hy,true):0;s.al.h=a.h.en?hyst(s.al.h,v,+a.h.sp,hy,true):0;s.al.l=a.l.en?hyst(s.al.l,v,+a.l.sp,hy,false):0;s.al.ll=a.ll.en?hyst(s.al.ll,v,+a.ll.sp,hy,false):0;
    s.al.dvh=a.dvh.en?hyst(s.al.dvh,dv,+a.dvh.sp,hy,true):0;s.al.dvl=a.dvl.en?hyst(s.al.dvl,-dv,+a.dvl.sp,hy,true):0;
    sig[c.id+'.out']=s.out;for(const q of PIDAL){sig[c.id+'.'+q[0]]=s.al[q[0]];if(a[q[0]].en&&s.al[q[0]])Sim.alarms.push({pg:c._pg.id,txt:`${c.tag} ${q[1]} PV ${fmt(v,2)} ${p.units||''}`,lvl:q[2]});}
    if(s.pvBad&&p.mode!=='OOS')Sim.alarms.push({pg:c._pg.id,txt:`${c.tag} BAD PV`,lvl:'amber'});
    if(Sim.t>=s.nh){s.nh=Sim.t+1;s.hist.push({pv:s.pv,sp:s.sp,out:s.out});if(s.hist.length>480)s.hist.shift();}
  },
  relay(c,dt,pv,sp){const p=c.p,s=c.s,at=s.at;const m=p.direct?-1:1;// m=+1: reverse acting => OUT up when PV low
    const d=+p.at.step||5,nb=+p.at.band||0;
    if(at.dir===0){at.dir=pv<sp?1:-1;at.pk=pv;at.last=Sim.t;at.max=pv;at.min=pv;}
    // switching with noise band hysteresis
    if(at.dir>0&&pv>sp+nb){at.dir=-1;this.mark(c,'top');}else if(at.dir<0&&pv<sp-nb){at.dir=1;this.mark(c,'bot');}
    at.max=Math.max(at.max,pv);at.min=Math.min(at.min,pv);
    s.out=clamp(at.out0+m*at.dir*d,+p.outLo,+p.outHi);p.outMan=+s.out.toFixed(3);
    if(Sim.t-at.t0>7200){s.at={state:'fail',msg:'Auto-tune timed out — no sustained oscillation'};return;}
    if(at.sw>=10&&at.state==='run'){this.finish(c);}},
  mark(c,kind){const at=c.s.at;at.sw++;// 'top' switch ends the low half-cycle (record trough); 'bot' switch ends the high half-cycle (record peak)
    at.hist.push({t:Sim.t,kind,v:kind==='top'?at.min:at.max});at.max=c.s.pvf;at.min=c.s.pvf;},
  finish(c){const s=c.s,p=c.p,at=s.at;const h=at.hist.slice(3);// drop the first switches (transient)
    const tops=h.filter(q=>q.kind==='top'),bots=h.filter(q=>q.kind==='bot');
    const mean=l=>l.reduce((x,y)=>x+y,0)/Math.max(1,l.length);
    const tt=[];for(let i=1;i<tops.length;i++)tt.push(tops[i].t-tops[i-1].t);for(let i=1;i<bots.length;i++)tt.push(bots[i].t-bots[i-1].t);
    const a=(mean(bots.map(q=>q.v))-mean(tops.map(q=>q.v)))/2;const Pu=mean(tt);
    if(!(a>0)||!(Pu>0)){s.at={state:'fail',msg:'Auto-tune failed: no usable oscillation'};return;}
    const d=+p.at.step||5;const Ku=4*d/(Math.PI*a);const rule=p.at.rule;let g,ti,td=0;
    if(rule==='tl_pi'){g=Ku/3.2;ti=2.2*Pu;}else if(rule==='tl_pid'){g=Ku/2.2;ti=2.2*Pu;td=Pu/6.3;}else if(rule==='zn_pi'){g=.45*Ku;ti=Pu/1.2;}else{g=.6*Ku;ti=Pu/2;td=Pu/8;}
    s.at={state:'done',ku:Ku,pu:Pu,res:{gain:g,reset:ti,rate:td}};s.out=clamp(at.out0,+p.outLo,+p.outHi);p.outMan=+s.out.toFixed(3);s.init=false;}
});

/* ================= Variable speed drive ================= */
reg('vsd',{name:'Variable speed drive',cat:'Control',prefix:'VSD-',rot:false,size:()=>[140,120],inLabel:true,plin:true,icon:'VSD',
  defaults:()=>({ctl:'local',run:false,spd:60,min:20,max:100,acc:10,dec:10,hz:50,rpm:1480,kw:30}),
  init(c){c.s={speed:0,cmd:false,fault:false,hz:0,pct:0,rpm:0,kw:0};},
  ports:()=>[P('run','disc','in',0,40,'l','RUN'),P('ref','ana','in',0,60,'l','REF'),P('spd','ana','out',140,40,'r','SPD'),P('running','disc','out',140,60,'r','RUNNING'),P('fault','disc','out',140,80,'r','FAULT')],
  sym(c){const s=c.s;return `<rect class="s-body" x="0" y="0" width="140" height="120" rx="4" style="${s.fault?'stroke:var(--red);stroke-width:2.5':''}"/><text class="s-tag" x="70" y="14" text-anchor="middle">${esc(c.tag)}</text><text class="s-pl" x="70" y="26" text-anchor="middle">VSD</text>
    <text class="s-txt b l" x="70" y="52" text-anchor="middle" style="fill:${s.fault?'var(--red)':s.cmd?'var(--ok)':'var(--ink)'}">${s.fault?'FAULT':s.cmd?'RUN':'STOP'}</text>
    <text class="s-txt" x="70" y="68" text-anchor="middle">${fmt(s.hz,1)} Hz · ${fmt(s.pct,1)}%</text><text class="s-txt" x="70" y="82" text-anchor="middle">${fmt(s.rpm,0)} rpm</text><text class="s-txt" x="70" y="96" text-anchor="middle">${fmt(s.kw,1)} kW</text>`;},
  label:()=>[],
  insp(c){const p=c.p;return H.sec('Drive')+H.sel(c,'ctl','Control',[['local','Local'],['remote','Remote (RUN + REF)']],{rr:1})+
    (p.ctl==='local'?`<div class="btnrow">${H.btn('start','Start')}${H.btn('stop','Stop')}</div>`+H.num(c,'spd','Speed (%)',{min:0,max:100})+`<input type="range" min="0" max="100" step="1" data-p="spd" data-t="n" value="${p.spd}" style="width:100%">`:`<div class="note">RUN (discrete) and REF (analog 0–100%) inputs drive the speed.</div>`)+
    H.num(c,'min','Minimum speed (%)',{min:0,max:100})+H.num(c,'max','Maximum speed (%)',{min:0,max:100})+H.num(c,'acc','Acceleration ramp (s, 0→100%)',{min:0})+H.num(c,'dec','Deceleration ramp (s, 100→0%)',{min:0})+
    H.num(c,'hz','Rated frequency (Hz)')+H.num(c,'rpm','Rated speed (rpm)')+H.num(c,'kw','Rated power (kW)')+
    `<div class="btnrow">${H.btn('fault','Simulate fault','warn')}${H.btn('rfault','Reset fault')}</div>`+H.sec('Live')+H.kv([['Status','st'],['Frequency (Hz)','hz'],['Speed (%)','pc'],['Speed (rpm)','rp'],['Shaft power (kW = rated·speed³)','kw']]);},
  liveInsp(c){const s=c.s;const e=k=>$(`[data-live=${k}]`);if(e('st'))e('st').textContent=s.fault?'FAULT':s.cmd?'RUNNING':'STOPPED';if(e('hz'))e('hz').textContent=fmt(s.hz,2);if(e('pc'))e('pc').textContent=fmt(s.pct,1);if(e('rp'))e('rp').textContent=fmt(s.rpm,0);if(e('kw'))e('kw').textContent=fmt(s.kw,2);},
  act(c,a){if(a==='start')c.p.run=true;else if(a==='stop')c.p.run=false;else if(a==='fault')c.s.fault=true;else if(a==='rfault')c.s.fault=false;return'rr';},
  dbl(c){if(c.p.ctl==='local'){c.p.run=!c.p.run;return true;}},
  scan(c,dt){const p=c.p,s=c.s;let cmd=p.ctl==='local'?!!p.run:!!D(c,'run');if(s.fault)cmd=false;s.cmd=cmd;
    let ref=p.ctl==='local'?+p.spd:(A(c,'ref')??0);ref=clamp(ref,0,100);const tgt=cmd?clamp(ref,Math.min(p.min,p.max),p.max)/100:0;
    const up=p.acc>0?dt/p.acc:1,dn=p.dec>0?dt/p.dec:1;const d=tgt-s.speed;s.speed+=d>0?Math.min(d,up):Math.max(d,-dn);if(s.fault&&s.speed<1e-4)s.speed=0;
    s.pct=s.speed*100;s.hz=s.speed*p.hz;s.rpm=s.speed*p.rpm;s.kw=p.kw*Math.pow(s.speed,3);
    sig[c.id+'.spd']=s.pct;sig[c.id+'.running']=cmd&&s.speed>0.005?1:0;sig[c.id+'.fault']=s.fault?1:0;if(s.fault)Sim.alarms.push({pg:c._pg.id,txt:`${c.tag} DRIVE FAULT`,lvl:'red'});}
});

/* ================= Trend ================= */
const PENCOL=['#1f78d1','#e8710a','#2e9e4f','#d3168c','#7a3fc4'];
reg('trend',{name:'Trend',cat:'Instruments',prefix:'TR-',rot:false,size:()=>[300,240],inLabel:true,plin:true,icon:'TR',
  defaults:()=>({n:3,win:10,pens:PENCOL.map((c,i)=>({label:'',color:c,lo:0,hi:100,units:'%',auto:false,ymin:0,ymax:100}))}),
  init(c){c.s={pens:Array.from({length:5},()=>({t:[],v:[],val:null,alo:0,ahi:1})),next:0};},
  ports:c=>Array.from({length:c.p.n},(_,i)=>P('i'+(i+1),'ana','in',0,40+20*i,'l','P'+(i+1))),
  penLabel(c,i){const w=c.p.pens[i].label;if(w)return w;const cn=(c._wi&&c._wi['i'+(i+1)]);return cn?cn:'PEN '+(i+1);},
  sym(c){const s=c.s,p=c.p;const win=p.win*60;const X0=44,Y0=20,CW=248,CH=118;const tn=Sim.t;let g='';
    for(let i=1;i<4;i++)g+=`<line x1="${X0}" x2="${X0+CW}" y1="${Y0+CH*i/4}" y2="${Y0+CH*i/4}" style="stroke:var(--line);stroke-width:.6"/><line y1="${Y0}" y2="${Y0+CH}" x1="${X0+CW*i/4}" x2="${X0+CW*i/4}" style="stroke:var(--line);stroke-width:.6"/>`;
    let lines='',leg='';
    for(let i=0;i<p.n;i++){const pen=p.pens[i],sp=s.pens[i];let lo=pen.auto?sp.alo:+pen.ymin,hi=pen.auto?sp.ahi:+pen.ymax;if(hi<=lo)hi=lo+1;
      let d='';const t0=tn-win;for(let k=0;k<sp.t.length;k++){if(sp.t[k]<t0)continue;const x=X0+CW*(sp.t[k]-t0)/win,y=Y0+CH-CH*clamp((sp.v[k]-lo)/(hi-lo),-.02,1.02);d+=(d?'L':'M')+x.toFixed(1)+' '+y.toFixed(1);}
      if(d)lines+=`<path d="${d}" fill="none" style="stroke:${pen.color};stroke-width:1.5"/>`;
      const ly=156+i*15;const lab=this.penLabel(c,i);
      leg+=`<rect x="10" y="${ly-8}" width="12" height="3" style="fill:${pen.color}"/><text class="s-txt" x="26" y="${ly-3}">${esc(lab.slice(0,11))}</text><text class="s-txt b" x="130" y="${ly-3}" text-anchor="end">${sp.val==null?'--':fmt(sp.val,Math.abs(sp.val)>=100?1:2)}</text><text class="s-pl" x="134" y="${ly-3}">${esc(pen.units)}</text><text class="s-pl" x="296" y="${ly-3}" text-anchor="end">${fmt(lo,Math.abs(hi-lo)>20?0:1)} … ${fmt(hi,Math.abs(hi-lo)>20?0:1)}</text>`;}
    return `<rect class="s-body" x="0" y="0" width="300" height="240" rx="3"/><text class="s-tag" x="${X0}" y="13">${esc(c.tag)}</text><text class="s-pl" x="${X0+CW}" y="13" text-anchor="end">${p.win>=60?p.win/60+' h':p.win+' min'}</text>
      <rect x="${X0}" y="${Y0}" width="${CW}" height="${CH}" style="fill:var(--paper);stroke:var(--ink);stroke-width:1"/>${g}<clipPath id="tc${c.id}"><rect x="${X0}" y="${Y0}" width="${CW}" height="${CH}"/></clipPath><g clip-path="url(#tc${c.id})">${lines}</g>${leg}`;},
  label:()=>[],
  insp(c){const p=c.p;let h=H.sec('Trend')+H.sel(c,'n','Pens',[[1,1],[2,2],[3,3],[4,4],[5,5]],{num:1,rr:1})+H.sel(c,'win','Time window',[[2,'2 min'],[5,'5 min'],[10,'10 min'],[15,'15 min'],[30,'30 min'],[60,'1 h'],[120,'2 h']],{num:1})+`<div class="btnrow">${H.btn('clr','Clear trend')}</div>`;
    for(let i=0;i<p.n;i++){const k='pens.'+i+'.';h+=H.sec('Pen '+(i+1))+H.txt(c,k+'label','Label (blank = connected tag)')+H.color(c,k+'color','Colour')+H.num(c,k+'lo','EU at 0%')+H.num(c,k+'hi','EU at 100%')+H.txt(c,k+'units','Units')+H.chk(c,k+'auto','Autoscale Y axis',{rr:1})+(p.pens[i].auto?'':H.num(c,k+'ymin','Y axis min')+H.num(c,k+'ymax','Y axis max'));}
    return h;},
  act(c,a){if(a==='clr'){c.s.pens.forEach(q=>{q.t=[];q.v=[];q.val=null;});c.s.next=0;}},
  post(c,dt){const s=c.s,p=c.p;const win=p.win*60,iv=win/300;
    for(let i=0;i<p.n;i++){const a=A(c,'i'+(i+1));const pen=p.pens[i],sp=s.pens[i];if(a==null){sp.val=null;continue;}const eu=+pen.lo+a/100*((+pen.hi)-(+pen.lo));sp.val=eu;}
    if(Sim.t>=s.next){s.next=Sim.t+iv;for(let i=0;i<p.n;i++){const sp=s.pens[i];if(sp.val==null)continue;sp.t.push(Sim.t);sp.v.push(sp.val);const t0=Sim.t-win;while(sp.t.length&&sp.t[0]<t0-iv){sp.t.shift();sp.v.shift();}
      let mn=1e18,mx=-1e18;for(const v of sp.v){if(v<mn)mn=v;if(v>mx)mx=v;}if(mx<mn){mn=0;mx=1;}const m=(mx-mn)*.08||.5;sp.alo=mn-m;sp.ahi=mx+m;}}}
});

/* ================= Stack light ================= */
reg('stack',{name:'Stack light',cat:'Alarms',prefix:'YL-',rot:false,size:()=>[100,140],inLabel:true,plin:true,icon:'YL',
  defaults:()=>({lamps:[{color:'red',mode:'steady'},{color:'amber',mode:'steady'},{color:'green',mode:'steady'},{color:'blue',mode:'steady'}]}),
  init(c){c.s={on:[0,0,0,0]};},
  ports:()=>[1,2,3,4].map((n,i)=>P('i'+n,'disc','in',0,40+20*i,'l',String(n))),
  sym(c){const ph=Math.floor(Date.now()/500)%2===0;let h=`<rect class="s-body" x="0" y="0" width="100" height="140" rx="3" style="fill:none;stroke:none"/><text class="s-tag" x="62" y="11" text-anchor="middle">${esc(c.tag)}</text><rect x="46" y="14" width="32" height="8" rx="2" class="s-ln" style="fill:var(--body)"/>`;
    c.p.lamps.forEach((l,i)=>{const on=c.s.on[i]&&(l.mode!=='flash'||ph);const col=lampColors[l.color]||'#e53935';const y=31+20*i;
      h+=`${lnx(0,40+20*i,46,40+20*i,'s-ln2" style="stroke:var(--disc)')}<rect x="46" y="${y}" width="32" height="18" rx="3" class="s-ln" style="fill:${col};fill-opacity:${on?1:.18}"/>${on?`<rect x="43" y="${y-3}" width="38" height="24" rx="6" style="fill:${col};fill-opacity:.25"/>`:''}`;});
    return h+`<rect x="46" y="111" width="32" height="12" class="s-ln" style="fill:var(--body)"/><rect x="58" y="123" width="8" height="12" class="s-ln" style="fill:var(--body)"/>`;},
  label:()=>[],
  insp(c){return H.sec('Lamps (inputs 1–4)')+c.p.lamps.map((l,i)=>H.sel(c,'lamps.'+i+'.color','Lamp '+(i+1)+' colour',[['red','Red'],['amber','Amber'],['green','Green'],['blue','Blue'],['white','White']])+H.sel(c,'lamps.'+i+'.mode','Lamp '+(i+1)+' mode',[['steady','Steady'],['flash','Flashing']])).join('');},
  scan(c){for(let i=0;i<4;i++)c.s.on[i]=D(c,'i'+(i+1));}
});

/* ================= Alarm horn ================= */
const TONES=[['cont','Continuous'],['pulse','Pulsed'],['warble','Warble'],['whoop','Slow whoop'],['yelp','Yelp']];
reg('horn',{name:'Alarm horn',cat:'Alarms',prefix:'XH-',rot:false,size:()=>[100,140],inLabel:true,plin:true,icon:'XH',
  defaults:()=>({tones:['cont','pulse','warble','whoop'],vol:60}),
  init(c){c.s={act:[0,0,0,0],silenced:false,prev:[0,0,0,0],tone:null};},
  ports:()=>[1,2,3,4].map((n,i)=>P('i'+n,'disc','in',0,40+20*i,'l',String(n))),
  sym(c){const s=c.s;const snd=s.tone&&!s.silenced;return `<rect class="s-body" x="0" y="0" width="100" height="140" rx="3"/><text class="s-tag" x="60" y="14" text-anchor="middle">${esc(c.tag)}</text>
    <path class="s-ln" d="M44 54 L58 54 L78 40 L78 94 L58 80 L44 80 Z" style="fill:${snd?'var(--ambersoft)':'var(--paper)'}"/>
    ${snd?`<path class="s-ln" d="M84 56 q8 14 0 28 M90 48 q14 22 0 44" style="stroke:var(--red)"/>`:''}
    <text class="s-txt b" x="60" y="118" text-anchor="middle" style="fill:${s.silenced?'var(--muted)':snd?'var(--red)':'var(--ink)'}">${s.silenced?'SILENCED':snd?'SOUNDING':'quiet'}</text>`;},
  label:()=>[],
  insp(c){return H.sec('Tones per input')+[0,1,2,3].map(i=>H.sel(c,'tones.'+i,'Input '+(i+1),TONES)).join('')+`<div class="note">The lowest-numbered active input sets the tone. Sounds only while the simulation runs.</div>`+
    H.num(c,'vol','Volume (%)',{min:0,max:100})+`<div class="btnrow">${H.btn('sil','Silence')}${H.btn('unsil','Un-silence')}</div><div class="btnrow">${TONES.map(t=>H.btn('prev:'+t[0],'▶ '+t[1])).join('')}</div>`+H.sec('Live')+H.kv([['State','st']]);},
  liveInsp(c){const e=$('[data-live=st]');if(e)e.textContent=c.s.silenced?'SILENCED':c.s.tone?'SOUNDING ('+c.s.tone+')':'quiet';},
  act(c,a){if(a==='sil')c.s.silenced=true;else if(a==='unsil')c.s.silenced=false;else if(a.startsWith('prev:'))Audio_.preview(a.slice(5),c.p.vol);},
  dbl(c){c.s.silenced=true;return true;},
  scan(c){const s=c.s;let any=false,newIn=false,low=-1;for(let i=0;i<4;i++){const v=D(c,'i'+(i+1));s.act[i]=v;if(v){any=true;if(low<0)low=i;if(!s.prev[i])newIn=true;}s.prev[i]=v;}
    if(newIn)s.silenced=false;if(!any)s.silenced=false;s.tone=low>=0?c.p.tones[low]:null;}
});

/* ================= Comment ================= */
const SWATCH=['#000000','#d32f2f','#e8710a','#f0a000','#2e9e4f','#1f78d1','#7a3fc4','#808080'];
function wrapText(text,maxCh){const out=[];for(const para of String(text).split('\n')){if(!para){out.push('');continue;}let line='';for(const w of para.split(' ')){if((line+' '+w).trim().length>maxCh&&line){out.push(line);line=w;}else line=(line?line+' ':'')+w;}out.push(line);}return out;}
reg('comment',{name:'Comment',cat:'Notes',prefix:'NOTE-',rot:false,notag:true,size:c=>[snap(c.p.w||200),snap(c.p.h||100)],inLabel:true,icon:'TXT',
  defaults:()=>({text:'Double-click to edit',w:200,h:100,size:14,bold:false,italic:false,align:'left',color:'',frame:'sticky'}),
  ports:()=>[],
  sym(c){const p=c.p,[W,Hh]=baseSize(c);const sz=clamp(+p.size||14,8,72);const lines=wrapText(p.text,Math.max(4,Math.floor((W-16)/(sz*0.56))));
    const col=p.color||(p.frame==='sticky'?'#222':'var(--ink)');const ax=p.align==='center'?W/2:p.align==='right'?W-8:8,an=p.align==='center'?'middle':p.align==='right'?'end':'start';
    let fr='';if(p.frame==='sticky')fr=`<path d="M0 0 H${W} V${Hh-14} L${W-14} ${Hh} H0 Z" style="fill:#fff0a0;stroke:#c9b441;stroke-width:1"/><path d="M${W-14} ${Hh} V${Hh-14} H${W} Z" style="fill:#e6d36a;stroke:#c9b441;stroke-width:1"/>`;
    else if(p.frame==='box')fr=`<rect x="0" y="0" width="${W}" height="${Hh}" style="fill:none;stroke:var(--ink);stroke-width:1.2"/>`;else fr=`<rect x="0" y="0" width="${W}" height="${Hh}" style="fill:transparent;stroke:none"/>`;
    return fr+`<text class="s-comment-t" text-anchor="${an}" style="font-size:${sz}px;font-weight:${p.bold?700:400};font-style:${p.italic?'italic':'normal'};fill:${col}">${lines.map((l,i)=>`<tspan x="${ax}" y="${8+sz+i*sz*1.22}">${esc(l)||' '}</tspan>`).join('')}</text>`;},
  label:()=>[],
  insp(c){const p=c.p;return H.sec('Comment')+H.ta(c,'text','Text')+H.num(c,'size','Font size (px)',{min:8,max:72,step:1})+
    `<div class="btnrow"><button class="btn sm${p.bold?' on':''}" data-act="bold"><b>B</b></button><button class="btn sm${p.italic?' on':''}" data-act="italic"><i>I</i></button>${['left','center','right'].map(a=>`<button class="btn sm${p.align===a?' on':''}" data-act="align:${a}">${{left:'⇤',center:'↔',right:'⇥'}[a]}</button>`).join('')}</div>`+
    H.color(c,'color','Font colour')+`<div class="swatches">${SWATCH.map(s=>`<i data-swatch="${s}" style="background:${s}"></i>`).join('')}</div><div class="btnrow">${H.btn('themecol','Theme colour',p.color?'':'on')}</div>`+
    H.sel(c,'frame','Frame',[['sticky','Sticky note'],['box','Box'],['none','Text only']])+H.num(c,'w','Width (px)',{min:40,step:20})+H.num(c,'h','Height (px)',{min:20,step:20})+`<div class="note">Annotation only — not simulated. Double-click to edit on the canvas.</div>`;},
  act(c,a){const p=c.p;if(a==='bold')p.bold=!p.bold;else if(a==='italic')p.italic=!p.italic;else if(a.startsWith('align:'))p.align=a.slice(6);else if(a==='themecol')p.color='';return'rr';},
  dbl(c){return 'edit';}
});
