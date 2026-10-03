'use strict';
/* ================= built-in examples ================= */
function Builder(){const comps=[],conns=[];
  const add=(type,x,y,tag,p,orient)=>{const T=TYPES[type];const c={id:uid(),type,tag,x,y,orient:orient||T.orient||'h',locked:false,p:mergeDefaults(T.defaults(),p||{})};
    if(type==='trend')c.p.pens=[...c.p.pens,...T.defaults().pens.slice(c.p.pens.length)];comps.push(c);return c;};
  const link=(a,pa,b,pb,anchors)=>{const A_=TYPES[a.type].ports(a).find(q=>q.id===pa),B_=TYPES[b.type].ports(b).find(q=>q.id===pb);
    if(!A_||!B_){console.error('bad link',a.tag,pa,b.tag,pb);return;}
    let f=a,fp=pa,t=b,tp=pb;if(A_.dir==='in'||(A_.dir==='tap'&&B_.dir==='out')){f=b;fp=pb;t=a;tp=pa;}
    conns.push({id:uid(),kind:A_.kind,from:{c:f.id,p:fp},to:{c:t.id,p:tp},anchors:anchors||[],cond:50,fluid:-1});};
  return{comps,conns,add,link};}
function buildTank(){const b=Builder(),{add,link}=b;
  const P101=add('source',60,60,'P-101',{ctl:'local',run:true,supply:'unlimited',mode:'flow',qset:300,fluid:0,temp:20,latch:true});
  const FT101=add('fm',200,60,'FT-101');
  const TK101=add('vessel',60,220,'TK-101',{mode:'fixed',vmax:6000,area:2,level0:80,fluid:3,temp:85,nin:1,nout:1,al:{hh:{en:false},h:{en:false}}});
  const P102=add('source',200,340,'P-102',{ctl:'remote',supply:'inlet',mode:'flow',qset:150,fluid:3,temp:85});
  const FT102=add('fm',320,340,'FT-102',{hi:300,al:{hh:{en:true,sp:400},h:{en:true,sp:300}}});
  const TK102=add('vessel',520,420,'TK-102',{vmax:5000,area:2,level0:55,nin:2,nout:1,fluid:0,temp:30,al:{l:{en:true,sp:40},ll:{en:true,sp:15}},db:5});
  const FV101=add('cv',680,560,'FV-101',{mode:'manual',open:true,pos:40,cv:600});
  const FT103=add('fm',800,560,'FT-103');
  const PI101=add('pi',740,440,'PI-101',{},'v');
  const TI101=add('ti',880,440,'TI-101',{},'v');
  const TK103=add('vessel',1000,660,'TK-103',{vmax:5000,area:2,level0:40,nin:1,nout:2,fluid:0,temp:30,al:{hh:{en:true,sp:92},h:{en:true,sp:80}},db:2});
  const FV102=add('cv',1160,820,'FV-102',{mode:'analog',cv:600,stroke:10,fail:'closed'});
  const DR101=add('drain',1280,820,'DR-101');
  const XV101=add('sv',1000,880,'XV-101',{nc:true,cv:600},'v');
  const DR102=add('drain',1000,980,'DR-102',{},'v');
  const LIC=add('pid',1240,600,'LIC-101',{mode:'AUTO',sp:50,outMan:40,gain:3,reset:150,rate:0,direct:true,eu0:0,eu100:100,units:'%'});
  const XH=add('horn',1300,60,'XH-101',{tones:['cont','pulse','warble','whoop']});
  const YL=add('stack',1440,60,'YL-101',{lamps:[{color:'red',mode:'flash'},{color:'amber',mode:'steady'},{color:'blue',mode:'steady'},{color:'green',mode:'steady'}]});
  const TR=add('trend',1280,260,'TR-101',{n:3,win:10,pens:[{label:'TK-103 level',color:'#1f78d1',lo:0,hi:100,units:'%',auto:false,ymin:0,ymax:100},{label:'LIC-101 OUT',color:'#e8710a',lo:0,hi:100,units:'%',auto:false,ymin:0,ymax:100},{label:'FT-103 flow',color:'#2e9e4f',lo:0,hi:600,units:'L/min',auto:false,ymin:0,ymax:600}]});
  add('comment',60,620,'',{text:'Tank farm — level control\n• P-101 fills TK-102 via FT-101.\n• TK-102 low level (40 %, 5 % deadband) starts P-102 (85 °C condensate from TK-101).\n• LIC-101 holds TK-103 at 50 % with FV-102; XV-101 dumps on high level; HH trips P-101.',w:360,h:160,size:12,frame:'sticky'});
  link(P101,'dis',FT101,'in');link(FT101,'out',TK102,'in1');
  link(TK101,'out1',P102,'suc');link(P102,'dis',FT102,'in');link(FT102,'out',TK102,'in2');
  link(TK102,'out1',FV101,'in');link(FV101,'out',FT103,'in');link(FT103,'out',TK103,'in1');
  link(PI101,'tap',FT103,'in');link(TI101,'tap',FT103,'out');
  link(TK103,'out1',FV102,'in');link(FV102,'out',DR101,'in');link(TK103,'out2',XV101,'in');link(XV101,'out',DR102,'in');
  link(TK102,'l',P102,'run');
  link(TK103,'lt',LIC,'in');link(LIC,'out',FV102,'ai');
  link(TK103,'h',XV101,'coil');link(TK103,'hh',P101,'trip');
  link(TK103,'hh',XH,'i1');link(TK103,'h',XH,'i2');link(TK102,'ll',XH,'i3');
  link(TK103,'hh',YL,'i1');link(TK103,'h',YL,'i2');link(TK102,'l',YL,'i3');
  link(TK103,'lt',TR,'i1');link(LIC,'out',TR,'i2');link(FT103,'ft',TR,'i3');
  return b;}
function buildChlor(){const b=Builder(),{add,link}=b;
  const TK201=add('vessel',60,540,'TK-201',{mode:'fixed',vmax:6000,area:2,level0:80,fluid:10,temp:80,nin:1,nout:1,al:{hh:{en:false},h:{en:false}}});
  const VSD=add('vsd',200,520,'VSD-201',{ctl:'local',run:true,spd:92,min:20,max:100,acc:10,dec:10,kw:15});
  const P201=add('source',200,700,'P-201',{ctl:'local',run:true,supply:'inlet',mode:'flow',qset:350,fluid:10,temp:80});
  const FT201=add('fm',320,700,'FT-201',{lo:0,hi:600,al:{hh:{en:true,sp:550},h:{en:true,sp:450},ll:{en:true,sp:200}},db:10});
  const TI201=add('ti',400,560,'TI-201',{lo:0,hi:120},'v');
  const EL=add('elec',800,400,'EL-201',{run:true,jset:6});
  const TK202=add('vessel',460,260,'TK-202',{vmax:5000,area:2,level0:30,nin:1,nout:1,fluid:11,temp:80});
  const FV201=add('cv',560,400,'FV-201',{mode:'manual',open:true,pos:40,cv:800});
  const DR201=add('drain',680,400,'DR-201');
  const TK203=add('vessel',1260,260,'TK-203',{vmax:5000,area:2,level0:50,nin:2,nout:2,fluid:8,fluid2:0,blend:50.5,temp:80,al:{hh:{en:true,sp:90},h:{en:true,sp:80}}});
  const P203=add('source',1180,100,'P-203',{ctl:'local',run:true,supply:'unlimited',mode:'flow',qset:55,fluid:0,temp:40});
  const P202=add('source',1260,460,'P-202',{ctl:'local',run:true,supply:'inlet',mode:'flow',qset:505,fluid:8,temp:80},'v');
  const FT202=add('fm',1260,560,'FT-202',{lo:0,hi:800,al:{hh:{en:true,sp:700},h:{en:true,sp:600}}},'v');
  const FV202=add('cv',1400,460,'FV-202',{mode:'analog',cv:200,stroke:10,fail:'closed'},'v');
  const DR202=add('drain',1400,560,'DR-202',{},'v');
  const LIC=add('pid',1440,640,'LIC-202',{mode:'AUTO',sp:50,outMan:25,gain:2,reset:200,rate:0,direct:true,eu0:0,eu100:100,units:'%'});
  const XH=add('horn',940,780,'XH-201',{tones:['cont','pulse','warble','whoop']});
  const YL=add('stack',1060,780,'YL-201',{lamps:[{color:'red',mode:'flash'},{color:'green',mode:'steady'},{color:'amber',mode:'steady'},{color:'blue',mode:'steady'}]});
  const TR=add('trend',60,60,'TR-201',{n:3,win:10,pens:[{label:'EL-201 load',color:'#d3168c',lo:0,hi:100,units:'%',auto:false,ymin:0,ymax:100},{label:'Brine flow',color:'#1f78d1',lo:0,hi:600,units:'L/min',auto:false,ymin:0,ymax:600},{label:'Catholyte flow',color:'#2e9e4f',lo:0,hi:800,units:'L/min',auto:false,ymin:0,ymax:800}]});
  add('comment',60,300,'',{text:'Chlor-alkali cell room\nBrine: TK-201 → P-201 (VSD-201) → FT-201 → EL-201 → TK-202 → FV-201 → drain.\nCatholyte loop: TK-203 → P-202 → FT-202 → EL-201 → TK-203, water make-up P-203, 32 % product drawn off by LIC-202 / FV-202.\nFT-201 low-low trips EL-201.',w:360,h:220,size:12,frame:'sticky'});
  link(TK201,'out1',P201,'suc');link(VSD,'spd',P201,'spd');link(P201,'dis',FT201,'in');link(FT201,'out',EL,'bi');link(TI201,'tap',FT201,'out');
  link(EL,'bo',TK202,'in1');link(TK202,'out1',FV201,'in');link(FV201,'out',DR201,'in');
  link(EL,'co',TK203,'in2');link(P203,'dis',TK203,'in1');link(TK203,'out2',P202,'suc');link(P202,'dis',FT202,'in');link(FT202,'out',EL,'ci');
  link(TK203,'out1',FV202,'in');link(FV202,'out',DR202,'in');
  link(TK203,'lt',LIC,'in');link(LIC,'out',FV202,'ai');
  link(FT201,'ll',EL,'trip');
  link(EL,'alm',XH,'i1');link(EL,'alm',YL,'i1');link(EL,'run',YL,'i2');
  link(EL,'load',TR,'i1');link(FT201,'ft',TR,'i2');link(FT202,'ft',TR,'i3');
  return b;}
function buildBms(){const b=Builder(),{add,link}=b;
  // ---- process (surrogate liquids stand in for fuel gas and combustion air) ----
  const P301=add('source',60,100,'P-301',{ctl:'local',run:true,supply:'unlimited',mode:'press',pset:300,qset:600,fluid:6,temp:20});
  const PI301=add('pi',120,40,'PI-301',{lo:0,hi:400,al:{hh:{en:true,sp:400},h:{en:false},l:{en:false},ll:{en:true,sp:150}}},'v');
  const XV301=add('sv',260,100,'XV-301',{nc:true,cv:30});
  const XV302=add('sv',380,100,'XV-302',{nc:true,cv:30});
  const FT301=add('fm',500,100,'FT-301',{lo:0,hi:200,al:{hh:{en:false},h:{en:false}}});
  const DR301=add('drain',640,100,'DR-301');
  const XV304=add('sv',300,220,'XV-304',{nc:false,cv:100},'v');
  const DR306=add('drain',300,320,'DR-306',{},'v');
  const XV303=add('sv',100,260,'XV-303',{nc:true,cv:6});
  const DR302=add('drain',200,260,'DR-302');
  const P302=add('source',60,420,'P-302',{ctl:'remote',supply:'unlimited',mode:'flow',qset:600,fluid:2,temp:20});
  const FT302=add('fm',200,420,'FT-302',{lo:0,hi:800,al:{hh:{en:false},h:{en:false},ll:{en:true,sp:300}},db:20});
  const DR304=add('drain',380,420,'DR-304');
  const P303=add('source',60,600,'P-303',{ctl:'local',run:true,supply:'unlimited',mode:'flow',qset:70,fluid:3,temp:90});
  const TK301=add('vessel',260,560,'TK-301',{vmax:3000,area:2,level0:55,nin:1,nout:1,fluid:3,temp:90,al:{hh:{en:false},h:{en:false},l:{en:false},ll:{en:true,sp:15}},db:3});
  const FV301=add('cv',460,720,'FV-301',{mode:'manual',open:true,pos:25,cv:300});
  const DR305=add('drain',580,720,'DR-305');
  // ---- operator inputs and field switches ----
  const START=add('di',760,60,'DI-301',{desc:'START PB'});
  const STOP=add('di',760,160,'DI-302',{desc:'STOP PB'});
  const RESET=add('di',760,260,'DI-303',{desc:'RESET PB'});
  const ESD=add('di',760,360,'DI-304',{desc:'ESD PB'});
  const FFS=add('di',760,460,'DI-305',{desc:'SIM FLAME LOSS'});
  // ---- SIS logic ----
  const OR1=add('lsor',940,60,'OR-301',{n:3,desc:'START INHIBIT'});
  const OR2=add('lsor',940,200,'OR-302',{n:2,desc:'STOP REQUEST'});
  const OR3=add('lsor',940,320,'OR-303',{n:2,desc:'VALVES OPEN'});
  const NT2=add('lsnot',940,440,'NOT-302',{desc:'FLAME SIM OK'});
  const NT4=add('lsnot',940,540,'NOT-304',{desc:'AIR FLOW OK'});
  const NT1=add('lsnot',1120,60,'NOT-301',{desc:'START PERMIT'});
  const AN1=add('lsand',1120,160,'AND-301',{n:2,desc:'START CMD'});
  const AN4=add('lsand',1120,280,'AND-304',{n:2,desc:'PURGING, AIR OK'});
  const OD3=add('lsond',1120,400,'OND-303',{pt:20,desc:'PURGE TIME 20 s'});
  const AN2=add('lsand',1120,520,'AND-302',{n:2,desc:'FLAME'});
  const OD1=add('lsond',1120,640,'OND-301',{pt:3,desc:'FLAME PROVEN'});
  const NT3=add('lsnot',1120,760,'NOT-303',{desc:'NO FLAME'});
  const AN3=add('lsand',1120,860,'AND-303',{n:2,desc:'IGNITING, NO FLAME'});
  const OD2=add('lsond',1120,980,'OND-302',{pt:10,desc:'TRIAL TIMEOUT 10 s'});
  const OD4=add('lsond',940,640,'OND-304',{pt:2,desc:'FLAME LOSS 2 s'});
  const STD=add('lsstd',1300,60,'STD-301',{ns:5,nt:7,init:1,desc:'BURNER STATE',sn:['READY','PURGE','IGNITE','RUN','STOP','','',''],tn:['START','PURGE DONE','FLAME PROVEN','STOP / TRIP','TRIP (PURGE)','TRIP (IGNITE)','RESET OK',''],
    tr:[{from:1,to:2,inp:1},{from:2,to:3,inp:2},{from:3,to:4,inp:3},{from:4,to:5,inp:4},{from:2,to:5,inp:5},{from:3,to:5,inp:6},{from:5,to:1,inp:7},{from:1,to:1,inp:8}]});
  const SEQ=add('lsseq',1300,300,'SEQ-301',{no:5,ns:5,desc:'VALVE POSITIONS',on:['FD FAN','PILOT','MAIN BLOCK 1','MAIN BLOCK 2','VENT CLOSE','','',''],
    sm:(()=>{const m=mkMatrix(16,8,false);[[1,0],[2,0],[2,1],[2,4],[3,0],[3,2],[3,3],[3,4],[4,0]].forEach(([s,o])=>m[s][o]=true);m[1][0]=true;return m;})()});
  const mk=Array.from({length:16},()=>Array(8).fill(true));const setMask=(i,st)=>{mk[i]=Array(8).fill(false);st.forEach(s=>mk[i][s-1]=true);};
  setMask(0,[1,2,3,4,5]);setMask(1,[3,4]);setMask(2,[3,4]);setMask(3,[3,4]);setMask(4,[2,3,4]);setMask(5,[4]);setMask(6,[3]);
  const mx=mkMatrix(16,16,false);for(let i=0;i<7;i++){mx[i][0]=true;mx[i][1]=true;}
  const CEM=add('lscem',1300,480,'CEM-301',{nc:7,ne:2,sm:true,latch:true,tv:'1',desc:'BMS CAUSE & EFFECT',mx,mk,
    cn:['ESD PUSHBUTTON','LOW AIR FLOW','FUEL PRESS LOW','FUEL PRESS HIGH','DRUM LEVEL LL','FLAME FAILURE','IGNITION TRIAL','','','','','','','','',''],en:['BURNER TRIP','HORN / LAMP','','','','','','','','','','','','','','']});
  const NT5=add('lsnot',1300,740,'NOT-305',{desc:'TRIP HEALTHY'});
  const V1=add('lsand',1480,440,'AND-V1',{n:2,desc:'PILOT COIL'});
  const V2=add('lsand',1480,560,'AND-V2',{n:2,desc:'MAIN 1 COIL'});
  const V3=add('lsand',1480,680,'AND-V3',{n:2,desc:'MAIN 2 COIL'});
  const V4=add('lsand',1480,800,'AND-V4',{n:2,desc:'VENT COIL'});
  const YL=add('stack',1500,60,'YL-301',{lamps:[{color:'red',mode:'flash'},{color:'amber',mode:'steady'},{color:'green',mode:'steady'},{color:'blue',mode:'steady'}]});
  const XH=add('horn',1500,220,'XH-301',{tones:['cont','pulse','warble','whoop']});
  const TR=add('trend',60,880,'TR-301',{n:3,win:10,pens:[{label:'BMS state',color:'#d3168c',lo:0,hi:5,units:'#',auto:false,ymin:0,ymax:5},{label:'Fuel flow',color:'#e8710a',lo:0,hi:200,units:'L/min',auto:false,ymin:0,ymax:200},{label:'Air flow',color:'#1f78d1',lo:0,hi:800,units:'L/min',auto:false,ymin:0,ymax:800}]});
  add('comment',400,880,'',{text:'Burner management system (DeltaV SIS style)\nSTD-301 holds the burner state: READY → PURGE → IGNITE → RUN → STOP.\nSEQ-301 sets valve positions per state; CEM-301 trips with state-based cause masking and first-out capture.\n\nTo run: double-click DI-301 (START), then DI-301 again to release. Double-click DI-305 to simulate flame loss, DI-304 for ESD; trip clears after the cause is removed and DI-303 (RESET) is pulsed. Fuel and air are surrogate liquids.',w:420,h:240,size:11,frame:'sticky'});
  // process piping
  link(P301,'dis',XV301,'in');link(XV301,'out',XV302,'in');link(XV302,'out',FT301,'in');link(FT301,'out',DR301,'in');
  link(XV301,'out',XV304,'in');link(XV304,'out',DR306,'in');link(P301,'dis',XV303,'in');link(XV303,'out',DR302,'in');link(PI301,'tap',P301,'dis');
  link(P302,'dis',FT302,'in');link(FT302,'out',DR304,'in');
  link(P303,'dis',TK301,'in1');link(TK301,'out1',FV301,'in');link(FV301,'out',DR305,'in');
  // permissive / sequence logic
  link(PI301,'ll',OR1,'i1');link(TK301,'ll',OR1,'i2');link(ESD,'q',OR1,'i3');link(OR1,'q',NT1,'i');link(NT1,'q',AN1,'i1');link(START,'q',AN1,'i2');link(AN1,'q',STD,'t1');
  link(FT302,'ll',NT4,'i');link(STD,'s2',AN4,'i1');link(NT4,'q',AN4,'i2');link(AN4,'q',OD3,'i');link(OD3,'q',STD,'t2');
  link(OR3,'q',AN2,'i1');link(FFS,'q',NT2,'i');link(NT2,'q',AN2,'i2');link(AN2,'q',OD1,'i');link(OD1,'q',STD,'t3');
  link(STOP,'q',OR2,'i1');link(CEM,'e1',OR2,'i2');link(OR2,'q',STD,'t4');link(CEM,'e1',STD,'t5');link(CEM,'e1',STD,'t6');link(CEM,'e1',NT5,'i');link(NT5,'q',STD,'t7');
  link(STD,'st',SEQ,'seq');link(STD,'st',CEM,'st');link(RESET,'q',CEM,'rst');
  link(AN2,'q',NT3,'i');link(STD,'s3',AN3,'i1');link(NT3,'q',AN3,'i2');link(AN3,'q',OD2,'i');
  // causes
  link(ESD,'q',CEM,'c1');link(FT302,'ll',CEM,'c2');link(PI301,'ll',CEM,'c3');link(PI301,'hh',CEM,'c4');link(TK301,'ll',CEM,'c5');link(NT3,'q',OD4,'i');link(OD4,'q',CEM,'c6');link(OD2,'q',CEM,'c7');
  // final elements (valve coils de-energise on trip)
  link(SEQ,'o1',P302,'run');link(SEQ,'o2',V1,'i1');link(NT5,'q',V1,'i2');link(V1,'q',XV303,'coil');
  link(SEQ,'o3',V2,'i1');link(NT5,'q',V2,'i2');link(V2,'q',XV301,'coil');link(SEQ,'o4',V3,'i1');link(NT5,'q',V3,'i2');link(V3,'q',XV302,'coil');
  link(SEQ,'o5',V4,'i1');link(NT5,'q',V4,'i2');link(V4,'q',XV304,'coil');
  link(V1,'q',OR3,'i1');link(V3,'q',OR3,'i2');
  // annunciation and trend
  link(CEM,'e2',YL,'i1');link(STD,'s2',YL,'i2');link(STD,'s4',YL,'i3');link(STD,'s1',YL,'i4');link(CEM,'e2',XH,'i1');
  link(STD,'st',TR,'i1');link(FT301,'ft',TR,'i2');link(FT302,'ft',TR,'i3');
  return b;}function fillPage(pg,b,title){const used=new Set();for(const p of doc.pages)if(p!==pg)for(const c of p.comps)used.add(c.tag);
  for(const c of b.comps){if(TYPES[c.type].notag){c.tag='NOTE';continue;}if(used.has(c.tag))c.tag=retag(c.tag,used);used.add(c.tag);}
  for(const c of b.comps)resetRuntime(c);
  Sim.rebase(()=>{pg.comps=b.comps;pg.conns=b.conns;});pg.title=title;pg.sheet='A3';pg.orient='landscape';pg.view={x:20,y:20,k:1};}
function loadExample(which){closeEdit();
  if(which==='tank'){fillPage(page(),buildTank(),'Tank farm — level control');}
  else if(which==='bms'){const pg=newPage('Burner management system');doc.pages.push(pg);doc.cur=doc.pages.length-1;fillPage(pg,buildBms(),'Burner management system (SIS)');}
  else{const pg=newPage('Chlor-alkali cell room');doc.pages.push(pg);doc.cur=doc.pages.length-1;fillPage(pg,buildChlor(),'Chlor-alkali cell room');}
  reindex();for(const c of allComps())if(!c.s)resetRuntime(c);dirtyNet();ensureNet();tidyRoutes(page().conns);V.sel=new Set();V.selW=new Set();
  renderAll();syncToolbar();renderPagebar();renderInspector();fitView();onDocChange();toast('Loaded example: '+page().title);}

