/* One document strip: grid -> fixed preview viewport -> native document reading. */
(()=>{'use strict';const root=document.querySelector('.sg');if(!root)return;
const intro=root.querySelector('.sg-intro'),stage=root.querySelector('.sg-stage'),cards=[...root.querySelectorAll('.sg-card')],reader=root.querySelector('.sg-reader'),reduce=matchMedia('(prefers-reduced-motion: reduce)');
const clamp=t=>Math.max(0,Math.min(1,t)),out=t=>1-Math.pow(1-t,4),smooth=t=>t*t*(3-2*t),seg=(t,a,b)=>clamp((t-a)/(b-a));
// Drawer begins and reaches cruising speed in half the time; travel is twice as fast.
const previewFlowDelay=40,previewFlowRamp=385,previewFlowSpeed=.68;
let seen=false;let phase='ready',h=900,z=1,start=0,previewStart=0,offset=0,raf=0,lastInput=-Infinity,settle=0,zoomProgress=0,frameTime=0,brakeStart=0,flowSpeed=0,zoomTarget=0,reverseOffset=0,internalScrollUntil=0,retractElapsed=0,retractDirection=1,boundaryNeedsFresh=false,aligning=false,nativeExit=false,travelFrom=0,travelTo=0,travelDuration=0,travelRest='parked';
let homeReturn=null,windowReadTarget=null,readingApproach=null,readingRaf=0,readingWheelUntil=0,readingReturnArmed=false,readingLastY=scrollY,stageLocked=false,dissolveIntent=null;
const reloadGallery=window.swarovskiReadingResume?.saved?.gallery;
let reloadPausedAt=null;
function resumeReload(){
  if(reloadPausedAt===null)return;
  const now=performance.now(),pause=now-reloadPausedAt;
  start+=pause;previewStart+=pause;brakeStart+=pause;if(homeReturn)homeReturn.start+=pause;
  frameTime=now;reloadPausedAt=null;root.removeAttribute('data-reload-paused');schedule();
}
// Normal wheel/keyboard timing remains 1x. Held or click-latched middle-button
// navigation and repeated mobile swipes run authored motion at 3x.
let middleFast=false,touchFastUntil=0,touchFastTimer=0;
function motionRate(now=performance.now()){return !reduce.matches&&(middleFast||now<touchFastUntil)?3:1;}
function exposeMotionRate(now=performance.now()){root.dataset.motionRate=String(motionRate(now));}
function setMiddleFast(active){middleFast=active;exposeMotionRate();if(active)schedule();}
function resetTouchFast(){clearTimeout(touchFastTimer);touchFastTimer=0;touchFastUntil=0;exposeMotionRate();}
function extendTouchFast(now=performance.now()){
  touchFastUntil=now+550;clearTimeout(touchFastTimer);exposeMotionRate(now);schedule();
  touchFastTimer=setTimeout(()=>{if(performance.now()>=touchFastUntil)resetTouchFast();},580);
}
exposeMotionRate();
// Three 3x3 views: cols 0..2/rows 0..2 -> cols 2..4/rows 0..2 -> cols 2..4/rows 2..4.
// Each leg retains exactly three cards and introduces six. Remaining cards sit beyond the right edge.
const cells=[];
for(let r=0;r<3;r++)for(let c=0;c<5;c++)cells.push({r,c});
for(let r=3;r<5;r++)for(let c=2;c<5;c++)cells.push({r,c});
for(let r=0;r<3;r++)cells.push({r,c:5});
const order=Array.from({length:cards.length},(_,i)=>i);[order[0],order[16]]=[order[16],order[0]];
root.querySelector('.sg-title')?.remove();root.querySelector('.sg-focus')?.remove();root.removeAttribute('aria-labelledby');root.setAttribute('aria-label','联名设计与完整原稿');
const viewport=document.createElement('div');viewport.className='sg-window';stage.append(viewport);
function remember(){seen=true;}
function base(){return root.getBoundingClientRect().top+scrollY;}
function jump(y){dissolveIntent=null;internalScrollUntil=performance.now()+150;scrollTo({top:y,left:0,behavior:'instant'});}
// Prevent native/diagonal wheel momentum from moving the document while the stage owns input.
function lockStage(){if(stageLocked)return;stageLocked=true;document.documentElement.classList.add('sg-scroll-locked');jump(scrollY);}
function unlockStage(){stageLocked=false;document.documentElement.classList.remove('sg-scroll-locked');}
function leaveStage(event,delta){const owned=stageLocked;unlockStage();nativeExit=true;if(owned){event.preventDefault();scrollBy({top:delta,behavior:'smooth'});}}
function alignStage(){if(aligning)return;lockStage();aligning=true;const from=scrollY,target=base(),began=performance.now();let previous=began,elapsedMotion=0;const step=now=>{if(!aligning)return;elapsedMotion+=(now-previous)*motionRate(now);previous=now;const u=clamp(elapsedMotion/360);jump(from+(target-from)*smooth(u));if(u<1)requestAnimationFrame(step);else{aligning=false;const elapsed=now-began;if(phase==='entry'||phase==='travel')start+=elapsed;if(phase==='preview')previewStart+=elapsed;frameTime=now;lastInput=now;settle=now+100;schedule();}};requestAnimationFrame(step);}
function setPhase(p){if(p!=='ready'&&p!=='reading')lockStage();phase=p;if(p!=='parked')nativeExit=false;root.dataset.phase=p;if(['preview','parked','backMiddle','exitReady'].includes(p))boundaryNeedsFresh=true;}
function schedule(){if(!raf&&reloadPausedAt===null)raf=requestAnimationFrame(draw);}
const pageImages=[...reader.querySelectorAll('.sg-page:not([data-transition="dissolve"]) > img')];let loadedPage=-1;
// Each pair owns its progress; both reading modes use the same images and state.
const dissolves=[...reader.querySelectorAll('[data-transition="dissolve"]')].map(page=>{
  const source=page.previousElementSibling,step=source.querySelector('.sg-dissolve-step');
  return {page,source,step,image:page.querySelector('img'),index:pageImages.indexOf(source.querySelector('img')),value:-1,unavailable:false,duration:step?1550:820};
});
let pageFade=null,pageFadeRaf=0,pageFadeRest=null;
// Use screen coordinates: the same visual center applies at every CSS zoom/viewport ratio.
function dissolveAnchor(pair){const r=pair.source.getBoundingClientRect();return scrollY+r.top+(r.height-innerHeight)/2;}
function setPageDissolve(pair,value){
  if(value===pair.value)return;pair.value=value;
  if(pair.step)pair.step.style.opacity=String(smooth(seg(value*pair.duration,0,500)));
  pair.page.style.opacity=String(smooth(pair.step?seg(value*pair.duration,650,1550):value));
  pair.page.style.pointerEvents=value===1?'auto':'none';
  pair.page.setAttribute('aria-hidden',String(value===0));pair.source.setAttribute('aria-hidden',String(value===1));
}
for(const pair of dissolves){pair.page.parentElement.classList.add('sg-dissolve-ready');pair.image.loading='eager';if(pair.step)pair.step.querySelector('img').loading='eager';setPageDissolve(pair,reduce.matches?1:0);}
function clearPageFade(){
  if(pageFadeRaf)cancelAnimationFrame(pageFadeRaf);pageFadeRaf=0;
  if(pageFade)setPageDissolve(pageFade.pair,pageFade.progress>=.5?1:0);
  pageFade=null;pageFadeRest=null;dissolveIntent=null;document.documentElement.classList.remove('sg-dissolve-locked');
}
function finishPageFade(end){
  const f=pageFade;if(!f)return;f.progress=end;setPageDissolve(f.pair,end);clearPageFade();readingLastY=scrollY;
  if(f.kind==='window')windowReadTarget=end?null:(f.rewindTarget??offset);
  else pageFadeRest={pair:f.pair,until:performance.now()+140};
}
function paintPageFade(now){
  pageFadeRaf=0;const f=pageFade;if(!f)return;
  const rawDt=Math.min(48,Math.max(0,now-f.time)),rate=motionRate(now),dt=rawDt*rate;
  if(f.mode==='align'&&rate>1)f.start-=rawDt*(rate-1);
  f.time=now;exposeMotionRate(now);
  if(f.mode==='align'){
    const u=clamp((now-f.start)/f.brakeDuration);jump(f.origin+(f.source-f.origin)*out(u));
    if(u===1){f.mode='prepare';preparePageFade(f);return;}
  }else if(f.mode==='fade'){
    f.progress=clamp(f.progress+(f.target?1:-1)*dt/f.pair.duration);setPageDissolve(f.pair,f.progress);
    if(f.progress===f.target){finishPageFade(f.target);return;}
  }
  if(pageFade===f)pageFadeRaf=requestAnimationFrame(paintPageFade);
}
async function preparePageFade(f){
  const images=[f.pair.source.querySelector('img'),f.pair.image];if(f.pair.step)images.push(f.pair.step.querySelector('img'));
  for(const image of images)image.loading='eager';
  const loaded=await Promise.race([Promise.all(images.map(image=>image.decode())).then(()=>true,()=>false),new Promise(resolve=>setTimeout(()=>resolve(false),2500))]);
  if(pageFade!==f)return;
  if(!loaded){f.pair.unavailable=true;f.progress=1;clearPageFade();return;}
  f.mode='fade';f.time=performance.now();pageFadeRaf=requestAnimationFrame(paintPageFade);
}
function beginPageFade(pair,target,inWindow=false){
  stopReadingApproach();readingReturnArmed=false;
  const source=dissolveAnchor(pair),now=performance.now();
  pageFade={pair,kind:inWindow?'window':'reading',origin:scrollY,source,start:now,time:now,progress:pair.value,target,mode:'align',brakeDuration:Math.max(280,Math.min(460,180+Math.abs(source-scrollY)*.45))};pageFadeRest=null;
  if(inWindow&&!target)pageFade.rewindTarget=windowReadTarget;
  if(!inWindow){document.documentElement.classList.add('sg-dissolve-locked');jump(scrollY);}
  if(inWindow||Math.abs(scrollY-source)<=1){if(!inWindow)jump(source);pageFade.mode='prepare';preparePageFade(pageFade);}
  else pageFadeRaf=requestAnimationFrame(paintPageFade);
}
function dissolveInput(delta,e){
  if(pageFade){
    e.preventDefault();const target=delta>0?1:0;
    if(pageFade.mode==='fade')pageFade.target=target;
    else if(target!==pageFade.target)clearPageFade();
    return true;
  }
  if(reduce.matches)return false;
  if(pageFadeRest){
    const remaining=dissolveAnchor(pageFadeRest.pair)-scrollY;
    if(Math.abs(remaining)<=2&&performance.now()<pageFadeRest.until){e.preventDefault();return true;}
    pageFadeRest=null;
  }
  const target=delta>0?1:0,now=performance.now(),direction=Math.sign(delta);
  // Wheel events can arrive before the previous native scroll has moved a pixel.
  // Include that queued distance, so a rapid burst cannot step over the trigger.
  if(!dissolveIntent||now>dissolveIntent.until||direction!==dissolveIntent.direction)dissolveIntent={origin:scrollY,target:scrollY,direction,until:now};
  dissolveIntent.target=(direction>0?Math.max(scrollY,dissolveIntent.target):Math.min(scrollY,dissolveIntent.target))+delta;
  dissolveIntent.until=now+600;
  const distance=dissolveIntent.target-scrollY;
  const ordered=delta>0?dissolves:[...dissolves].reverse();
  for(const pair of ordered){
    if(pair.index<0||pair.unavailable||target===pair.value)continue;
    const remaining=dissolveAnchor(pair)-scrollY;
    const crossing=delta>0?remaining>=-8&&remaining<=distance+1:remaining<=8&&remaining>=distance-1;
    if(!crossing)continue;
    e.preventDefault();beginPageFade(pair,target);return true;
  }
  return false;
}
function advanceFlow(dt,speed){
  if(pageFade?.kind==='window')return;
  const next=Math.min(maxOffset(),offset+dt*speed);
  for(const pair of dissolves){
    const edge=pair.index*810;
    if(pair.index>=0&&!pair.unavailable&&pair.value<1&&offset<=edge+.25&&next>=edge){offset=edge;beginPageFade(pair,1,true);return;}
  }
  offset=next;
}
// Keep the original home image behind one continuous drawer of all following pages.
const homePage=pageImages[0].parentElement,drawer=document.createElement('div');drawer.className='sg-drawer';
for(const child of [...reader.children])if(child!==homePage)drawer.append(child);
reader.append(drawer);homePage.classList.add('sg-home-layer');
function paintHomeLayer(position){homePage.style.transform=`translateY(${Math.max(0,Math.min(810,position))}px)`;}
// Native reading pins this same node with CSS, without a scroll/paint compensation loop.
function loadNear(){const i=Math.floor(offset/810);if(i===loadedPage)return;loadedPage=i;pageImages.slice(Math.max(0,i-1),i+5).forEach(img=>img.loading='eager');}
function maxOffset(height=810){return Math.max(0,pageImages.length*810-height);}
function windowGeometry(scale,y,height=810,x=0){
// The visible aperture changes during zoom/resize; never scroll past the strip's bottom.
height=Math.min(height,pageImages.length*810);
const limit=maxOffset(height);offset=Math.max(0,Math.min(offset,limit));if(offset>=limit)flowSpeed=0;
if(!pageFade&&phase!=='reading')for(const pair of dissolves)if(offset<pair.index*810-.5)setPageDissolve(pair,0);
paintHomeLayer(offset);
viewport.style.transform=`translate(${720*(1-scale)+x}px,${y}px) scale(${scale})`;viewport.style.height=height+'px';reader.style.transform=`translateY(${-offset}px)`;loadNear();}
function toReading(scroll=true){const continueFade=pageFade?.kind==='window';if(!continueFade)clearPageFade();aligning=false;const b=base();homeReturn=null;windowReadTarget=null;readingReturnArmed=false;stopReadingApproach();setPhase('reading');remember();reader.style.transform='';root.append(reader);root.classList.add('sg-reading');viewport.style.opacity='0';settle=performance.now();if(scroll)jump(b+offset*z);unlockStage();homePage.style.transform='';readingLastY=scrollY;if(continueFade){pageFade.kind='reading';document.documentElement.classList.add('sg-dissolve-locked');}}
function cancel(){const b=base();offset=0;toReading(false);jump(Math.max(0,b-innerHeight*.8));settle=performance.now()+220;}
function launch(){if(phase!=='ready')return;setPhase('entry');start=performance.now();jump(base());schedule();}
function travel(from,to,rest,duration){travelFrom=from;travelTo=to;travelRest=rest;travelDuration=duration;setPhase('travel');start=performance.now();schedule();}
function retract(){reverseOffset=offset;retractElapsed=0;retractDirection=1;setPhase('retract');start=performance.now();schedule();}
function expand(distance){if(phase==='preview'){setPhase('zoom');zoomProgress=zoomTarget=0;}if(phase==='brake')setPhase('zoom');if(phase!=='zoom')return;zoomTarget=clamp(zoomTarget+distance/Math.max(900,innerHeight*1.5));if(distance<0&&zoomTarget===0&&zoomProgress<.001)retract();schedule();}
function stopReadingApproach(){if(readingRaf)cancelAnimationFrame(readingRaf);readingRaf=0;readingApproach=null;document.documentElement.classList.remove('sg-home-approach-locked');}
function beginHomeReturn(){
  if(homeReturn||!['reading','preview','zoom','brake'].includes(phase))return;
  stopReadingApproach();readingReturnArmed=false;windowReadTarget=null;flowSpeed=0;offset=0;
  if(phase==='reading'){
    const b=base();root.style.minHeight=(reader.getBoundingClientRect().height/z)+'px';
    root.classList.remove('sg-reading');viewport.append(reader);zoomProgress=zoomTarget=1;
    setPhase('zoom');windowGeometry(1,0,h);viewport.style.opacity='1';jump(b);root.style.minHeight='';
  }else if(phase==='preview'){zoomProgress=zoomTarget=0;setPhase('zoom');}
  else setPhase('zoom');
  zoomTarget=0;frameTime=performance.now();
  if(zoomProgress<=.0005){retract();return;}
  // Contact with the home edge starts one continuous, gently braking return.
  homeReturn={from:zoomProgress,start:frameTime,duration:Math.max(360,950*zoomProgress)};schedule();
}
function approachHome(delta){
  const b=base();
  if(!readingApproach){
    // Cancel pending native wheel motion before the return animation owns scrollY.
    const y=scrollY;document.documentElement.classList.add('sg-home-approach-locked');jump(y);
    readingApproach={target:y,position:y,time:performance.now()};
  }
  readingApproach.target=Math.max(b,readingApproach.target+delta);
  if(readingRaf)return;
  const step=now=>{
    readingRaf=0;if(phase!=='reading'||!readingApproach)return;
    const dt=Math.min(64,now-readingApproach.time);readingApproach.time=now;
    const edge=base(),target=Math.max(edge,readingApproach.target),next=readingApproach.position+(target-readingApproach.position)*(1-Math.exp(-dt/65));readingApproach.position=next;
    if(target<=edge+.5&&next<=edge+.75){jump(edge);beginHomeReturn();return;}
    if(Math.abs(target-next)<.75){jump(target);stopReadingApproach();return;}
    jump(next);readingRaf=requestAnimationFrame(step);
  };readingRaf=requestAnimationFrame(step);
}
function rewindWindow(distance){
  flowSpeed=0;zoomTarget=zoomProgress;
  const scale=760/1440+(1-760/1440)*zoomProgress;
  windowReadTarget=Math.max(0,(windowReadTarget??offset)-distance/(z*scale));
  if(offset<=.25)beginHomeReturn();else schedule();
}
function readWindow(dt){
  if(reloadPausedAt!==null)return true;
  if(pageFade?.kind==='window')return true;
  if(windowReadTarget===null)return false;
  const next=offset+(windowReadTarget-offset)*(1-Math.exp(-dt/85));flowSpeed=0;
  for(const pair of [...dissolves].reverse()){const edge=pair.index*810;if(!pair.unavailable&&pair.value>0&&offset>=edge-.25&&next<=edge){offset=edge;beginPageFade(pair,0,true);return true;}}
  offset=next;
  if(Math.abs(offset-windowReadTarget)<.25){offset=windowReadTarget;if(offset===0)beginHomeReturn();}
  return true;
}
function size(){dissolveIntent=null;stopReadingApproach();readingReturnArmed=false;if(pageFade)finishPageFade(pageFade.progress>=.5?1:0);z=document.body.getBoundingClientRect().width/1440;h=innerHeight/z;root.style.setProperty('--sg-h',h+'px');if(stageLocked&&!aligning)jump(base());if(phase!=='reading'){if(reloadPausedAt!==null)draw(reloadPausedAt);else schedule();}}
// Early velocity peak, extended deceleration; zero velocity/acceleration at both ends.
const glide=t=>t*t*t*(35+t*(-105+t*(126+t*(-70+15*t))));
function draw(now){raf=0;if(phase==='reading'||reduce.matches)return;if(aligning){frameTime=now;schedule();return;}
const rawDt=frameTime?Math.min(64,now-frameTime):0,rate=motionRate(now),dt=rawDt*rate;
if(rawDt&&rate>1){const gain=rawDt*(rate-1);if(phase==='entry'||phase==='travel')start-=gain;if(phase==='preview')previewStart-=gain;if(phase==='brake')brakeStart-=gain;if(homeReturn)homeReturn.start-=gain;}
frameTime=now;exposeMotionRate(now);if(phase==='retract')retractElapsed=Math.max(0,Math.min(1950,retractElapsed+dt*retractDirection));
let t=phase==='entry'?now-start:phase==='ready'||phase==='exitReady'?0:phase==='backMiddle'?2450:phase==='travel'?travelFrom+(travelTo-travelFrom)*clamp((now-start)/travelDuration):phase==='parked'?5330:phase==='retract'?Math.max(5330,7280-retractElapsed):7280;
const enter=smooth(seg(t,0,1000)),focus=glide(seg(t,5330,7080)),leave=smooth(seg(t,5930,7180));
const rowStart=[1360,1420,1300,1360,1360],rowEnd=[2320,2450,2240,2320,2320],pitch=650;
const cardHeight=550*9/16,wideRowPitch=Math.max(355,h*.36);
// Halve only the empty space between rows on narrow windows; keep card size and wide layouts.
const narrow=innerWidth<=980,rowPitch=narrow?cardHeight+(wideRowPitch-cardHeight)*.5:wideRowPitch;
let homeX=0,homeY=0,homeVisibility=1;
order.forEach((idx,cell)=>{const {r,c}=cells[cell];const horizontal=glide(seg(t,rowStart[r],rowEnd[r]));// Vertical motion stays on each column's x axis; staggered columns create the reference's traveling wave.
const column=((c-2)%3+3)%3;
const vertical=glide(seg(t,[3360,3250,3310][column],[4480,4350,4420][column]));
let x=(c-1)*pitch-2*pitch*horizontal,y=(r-1)*rowPitch-2*rowPitch*vertical;const selected=idx===0;
// Keep the compact window to three rows; fade exchanged rows through the gap during travel.
const rowVisibility=narrow?1-smooth(seg(Math.abs(y),rowPitch+cardHeight*.5,2*rowPitch-cardHeight*.5)):1;
if(!selected){x+=Math.sign(x)*440*focus;y+=Math.sign(y)*300*focus;}
x+=Math.sign(x||1)*260*(1-enter);y+=Math.sign(y||1)*200*(1-enter);
if(selected){homeX=x;homeY=y;homeVisibility=rowVisibility;}
cards[idx].style.width='550px';cards[idx].style.transform=`translate(-50%,-50%) translate(${x}px,${y}px) scale(${selected?1+(760/550-1)*focus:1-.68*focus})`;cards[idx].style.opacity=String(enter*(selected?0:1-leave)*rowVisibility);});
const small=760/1440;
viewport.style.opacity=String(['ready','entry','travel','backMiddle','exitReady'].includes(phase)?enter*homeVisibility:1);
if(['ready','entry','retract','parked','travel','backMiddle','exitReady'].includes(phase)){offset=phase==='retract'?reverseOffset*(1-glide(clamp(retractElapsed/1950))):0;const landingScale=(550+210*focus)/1440;windowGeometry(landingScale,(h-810*landingScale)/2+homeY,810,homeX);if(t>=7280&&phase==='entry'){setPhase('preview');previewStart=now;settle=now+220;}}
if(phase==='retract'&&retractElapsed===0&&retractDirection<0){setPhase('preview');previewStart=now-previewFlowDelay-previewFlowRamp;offset=reverseOffset;}
if(phase==='retract'){viewport.style.opacity='1';cards[0].style.opacity='0';if(retractElapsed>=1950){offset=0;setPhase('parked');viewport.style.opacity='1';cards[0].style.opacity='0';settle=now+250;}}
if(phase==='travel'&&now-start>=travelDuration){setPhase(travelRest);settle=now+250;}
if(phase==='preview'){if(!readWindow(dt)){flowSpeed=previewFlowSpeed*smooth(seg(now-previewStart,previewFlowDelay,previewFlowDelay+previewFlowRamp));advanceFlow(dt,flowSpeed);}windowGeometry(small,(h-810*small)/2);}
if(phase==='zoom'){
  if(homeReturn){const p=clamp((now-homeReturn.start)/homeReturn.duration);zoomProgress=homeReturn.from*(1-glide(p));if(p===1)homeReturn=null;}
  else{zoomProgress+=(zoomTarget-zoomProgress)*(1-Math.exp(-dt/85));if(Math.abs(zoomTarget-zoomProgress)<.0005)zoomProgress=zoomTarget;}
  if(zoomProgress===1&&!homeReturn){flowSpeed=0;windowGeometry(1,0,h);toReading();return;}
  else if(zoomProgress===0&&zoomTarget===0){retract();}
}
if(phase==='zoom'||phase==='brake'){const braking=phase==='brake',b=braking?clamp((now-brakeStart)/450):0;const p=zoomProgress,scale=small+(1-small)*p;if(homeReturn){offset=0;flowSpeed=0;}else if(!readWindow(dt)){const target=previewFlowSpeed*small/scale;flowSpeed+=(target-flowSpeed)*(1-Math.exp(-dt/180));advanceFlow(dt,flowSpeed*(1-smooth(b))*(1-smooth(seg(p,.62,1))));}const height=810+(h-810)*p;windowGeometry(scale,(h-810*small)/2*(1-p),height);if(braking&&b===1){toReading();return;}}
if(phase==='entry'||phase==='travel'||phase==='retract'||phase==='zoom'||phase==='brake'||phase==='preview'&&offset<maxOffset())schedule();}
function mount(){root.classList.remove('sg-reading');viewport.append(reader);reader.style.transform='';offset=0;setPhase('ready');viewport.style.opacity='0';size();}
root.classList.add('sg-ready');if(seen||reduce.matches||reloadGallery?.phase==='reading'){setPhase('reading');root.classList.add('sg-reading');}else mount();size();
function input(direction,fresh,distance=100){if(pageFade?.kind==='window'){pageFade.target=direction>0?1:0;return;}if(phase==='entry'||phase==='travel')return;if(homeReturn){if(direction<0)return;homeReturn=null;zoomTarget=zoomProgress;}if(direction>0)windowReadTarget=null;if(['preview','parked','backMiddle','exitReady'].includes(phase)&&boundaryNeedsFresh){if(!fresh||performance.now()<settle)return;boundaryNeedsFresh=false;}if(phase==='retract'){retractDirection=direction<0?1:-1;schedule();return;}if(direction<0){if(['preview','zoom','brake'].includes(phase))rewindWindow(distance);else if(phase==='parked')travel(4480,3250,'backMiddle',1230);else if(phase==='backMiddle')travel(2450,0,'exitReady',2000);return;}if(phase==='exitReady'){travel(0,2450,'backMiddle',2000);return;}if(phase==='backMiddle'){travel(3250,4480,'parked',1230);return;}if(phase==='parked'){setPhase('entry');start=performance.now()-5330;schedule();return;}if(phase==='ready')launch();else if(phase==='zoom'||phase==='preview'&&fresh&&performance.now()>settle)expand(distance);}
// Wheel and middle-button scrolling share the same content/boundary/animation owner.
function scrollInput(delta,e,fresh,source='wheel'){
  const now=performance.now(),middle=source==='middle',gap=middle?Infinity:fresh===undefined?now-lastInput:fresh?Infinity:0,r=root.getBoundingClientRect();
  if(aligning){e.preventDefault();lastInput=now;return;}
  // Once the reader has moved below the Gallery, a downward middle-button cruise
  // keeps traversing the document instead of relaunching a barely visible stage edge.
  if(middle&&delta>0&&r.bottom<innerHeight*.3)return;
  if(phase==='reading'){
    lastInput=now;
    if(dissolveInput(delta,e))return;
    const homeTop=root.getBoundingClientRect().top;
    if(delta<0&&(homeTop<=2||readingReturnArmed&&now<readingWheelUntil)){
      readingReturnArmed=true;readingWheelUntil=now+280;
      if(homeTop>=-.5){e.preventDefault();beginHomeReturn();return;}
      // Take ownership before native wheel momentum can carry the home edge past the top.
      if(readingApproach||-homeTop<=Math.max(innerHeight*.85,-delta*2)){
        e.preventDefault();approachHome(delta);
      }
      return;
    }
    const owned=!!readingApproach;readingReturnArmed=false;stopReadingApproach();
    if(owned){e.preventDefault();scrollBy({top:delta,behavior:'smooth'});}
    return;
  }
  if(nativeExit&&delta>0)nativeExit=false;
  if(phase==='ready'&&delta<0){leaveStage(e,delta);lastInput=now;return;}
  if(phase==='exitReady'&&delta<0){
    if(boundaryNeedsFresh&&(gap<=180||now<settle)){e.preventDefault();lastInput=now;return;}
    boundaryNeedsFresh=false;leaveStage(e,delta);lastInput=now;return;
  }
  if(!nativeExit&&r.top<innerHeight*.7&&r.bottom>innerHeight*.3&&Math.abs(r.top)>2){resumeReload();e.preventDefault();lastInput=now;alignStage();return;}
  if(phase==='exitReady'&&(delta<0||r.top>2)){
    if(r.top<=2&&boundaryNeedsFresh){if(gap<=180||now<settle){e.preventDefault();lastInput=now;return;}boundaryNeedsFresh=false;}
    leaveStage(e,delta);lastInput=now;return;
  }
  if(r.top>90||r.bottom<0||phase==='ready'&&delta<0)return;
  resumeReload();e.preventDefault();lastInput=now;input(Math.sign(delta),middle||gap>180,Math.abs(delta));
}
addEventListener('wheel',e=>{
  stopMiddleScroll();
  if(e.ctrlKey||reduce.matches||Math.abs(e.deltaX)>Math.abs(e.deltaY)||!e.deltaY)return;
  scrollInput(e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?innerHeight:1),e);
},{passive:false});
// Native Windows middle-button autoscroll emits scroll, not wheel, and otherwise
// bypasses the animation boundary. Translate that gesture before native scrolling.
let middleScroll=null,middleRaf=0;
function stopMiddleScroll(){if(middleRaf)cancelAnimationFrame(middleRaf);middleRaf=0;if(middleScroll)lastInput=-Infinity;middleScroll=null;setMiddleFast(false);}
function middleStep(now){
  middleRaf=0;const m=middleScroll;if(!m)return;
  const dt=Math.min(32,Math.max(0,now-m.time));m.time=now;
  const distance=m.y-m.anchorY,direction=Math.abs(distance)>12?Math.sign(distance):0;
  setMiddleFast(!!direction);
  if(!direction){m.fresh=true;m.direction=0;}
  else{
    if(direction!==m.direction){m.fresh=true;m.direction=direction;}
    const delta=direction*Math.min(2.4,Math.pow((Math.abs(distance)-12)/110,1.45))*dt;
    if(delta){
      let handled=false;
      scrollInput(delta,{preventDefault(){handled=true;}},true,'middle');
      if(!handled)scrollBy({top:delta,behavior:'instant'});
    }
  }
  if(middleScroll===m)middleRaf=requestAnimationFrame(middleStep);
}
addEventListener('mousedown',e=>{
  if(middleScroll){stopMiddleScroll();if(e.button===1)e.preventDefault();return;}
  if(e.button!==1||e.defaultPrevented||e.ctrlKey||e.metaKey||e.altKey||reduce.matches||e.target.closest?.('a,button,input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="button"],[role="slider"]'))return;
  e.preventDefault();
  middleScroll={anchorY:e.clientY,y:e.clientY,time:performance.now(),moved:false,fresh:true,direction:0};
  middleRaf=requestAnimationFrame(middleStep);
},{passive:false});
addEventListener('mousemove',e=>{if(middleScroll){middleScroll.y=e.clientY;if(Math.abs(e.clientY-middleScroll.anchorY)>12)middleScroll.moved=true;}},{passive:true});
// Drag-release stops; a click without leaving the 12px dead zone stays active.
// The existing next-mousedown, wheel, Escape and blur handlers all exit this latch.
addEventListener('mouseup',e=>{if(e.button===1&&middleScroll?.moved)stopMiddleScroll();},{passive:true});
addEventListener('blur',stopMiddleScroll);
addEventListener('pagehide',stopMiddleScroll);
addEventListener('visibilitychange',()=>{if(document.hidden)stopMiddleScroll();});
addEventListener('keydown',e=>{if(middleScroll){stopMiddleScroll();if(e.key==='Escape')e.preventDefault();}},{capture:true});

// Mobile fast-reading intent. Ordinary single-finger scrolling stays native; only a
// burst of three qualifying same-direction flicks raises authored motion to 3x.
let fastTouch=null,touchBurst={direction:0,count:0,first:0,lastEnd:-Infinity};
function resetTouchBurst(clearFast=true){fastTouch=null;touchBurst={direction:0,count:0,first:0,lastEnd:-Infinity};if(clearFast)resetTouchFast();}
addEventListener('touchstart',e=>{
  if(e.touches.length!==1){resetTouchBurst();return;}
  const t=e.touches[0],now=performance.now();
  if(now-touchBurst.lastEnd>360){touchBurst={direction:0,count:0,first:0,lastEnd:-Infinity};resetTouchFast();}
  fastTouch={startX:t.clientX,startY:t.clientY,x:t.clientX,y:t.clientY,start:now};
},{passive:true,capture:true});
addEventListener('touchmove',e=>{
  if(!fastTouch||e.touches.length!==1)return;
  const t=e.touches[0],now=performance.now();fastTouch.x=t.clientX;fastTouch.y=t.clientY;
  const dy=fastTouch.startY-fastTouch.y,dx=fastTouch.x-fastTouch.startX,duration=now-fastTouch.start,direction=Math.sign(dy);
  if(direction&&touchBurst.direction&&direction!==touchBurst.direction)resetTouchFast();
  const qualifies=duration>=80&&duration<=420&&Math.abs(dy)>=60&&Math.abs(dy)>=Math.abs(dx)*1.5&&Math.abs(dy)/duration>=.45;
  if(qualifies&&touchBurst.count>=2&&direction===touchBurst.direction&&now-touchBurst.first<=1100)extendTouchFast(now);
},{passive:true,capture:true});
addEventListener('touchend',()=>{
  if(!fastTouch)return;
  const now=performance.now(),duration=now-fastTouch.start,dy=fastTouch.startY-fastTouch.y,dx=fastTouch.x-fastTouch.startX,direction=Math.sign(dy);
  const qualifies=duration>=80&&duration<=420&&Math.abs(dy)>=60&&Math.abs(dy)>=Math.abs(dx)*1.5&&Math.abs(dy)/duration>=.45;
  if(!qualifies){resetTouchBurst();return;}
  const continues=direction===touchBurst.direction&&fastTouch.start-touchBurst.lastEnd<=360&&now-touchBurst.first<=1100;
  touchBurst=continues?{...touchBurst,count:touchBurst.count+1,lastEnd:now}:{direction,count:1,first:now,lastEnd:now};
  fastTouch=null;if(touchBurst.count>=3)extendTouchFast(now);
},{passive:true,capture:true});
addEventListener('touchcancel',()=>resetTouchBurst(),{passive:true,capture:true});
// Also catch a pending native scroll frame that reaches the edge between wheel events.
addEventListener('scroll',()=>{
  const y=scrollY,previousY=readingLastY,movingUp=y<previousY;readingLastY=y;
  if(phase==='reading'&&!pageFade&&!reduce.matches&&dissolveIntent&&performance.now()<=dissolveIntent.until){
    const target=dissolveIntent.direction>0?1:0,ordered=target?dissolves:[...dissolves].reverse();
    // Coalesced native scroll events may omit the position at which the wheel began.
    const from=target?Math.min(previousY,dissolveIntent.origin):Math.max(previousY,dissolveIntent.origin);
    for(const pair of ordered){
      if(pair.unavailable||pair.value===target)continue;
      const edge=dissolveAnchor(pair);
      if(target?from<=edge&&y>=edge:from>=edge&&y<=edge){beginPageFade(pair,target);return;}
    }
  }
  if(phase==='reading'&&!pageFade)for(const pair of dissolves){const r=pair.source.getBoundingClientRect();if(r.bottom<=0)setPageDissolve(pair,1);else if(r.top>=innerHeight)setPageDissolve(pair,reduce.matches?1:0);}
  if(phase!=='reading'||reduce.matches||!readingReturnArmed||!movingUp||performance.now()>readingWheelUntil)return;
  if(root.getBoundingClientRect().top>=-.5)beginHomeReturn();
},{passive:true});
let touch=null;stage.addEventListener('touchstart',e=>{if(e.touches.length===1)touch={y:e.touches[0].clientY,fired:false};},{passive:true});stage.addEventListener('touchmove',e=>{if(!touch||e.touches.length!==1||phase==='reading'||reduce.matches)return;const dy=touch.y-e.touches[0].clientY;if(phase==='exitReady'&&dy<0){unlockStage();nativeExit=true;touch.y=e.touches[0].clientY;return;}if(Math.abs(dy)>2){e.preventDefault();touch.y=e.touches[0].clientY;input(Math.sign(dy),!touch.fired,Math.abs(dy));touch.fired=true;}},{passive:false});stage.addEventListener('touchend',()=>touch=null);
addEventListener('keydown',e=>{
  if(e.defaultPrevented||e.ctrlKey||e.metaKey||e.altKey||e.target.closest?.('input,textarea,select,[contenteditable="true"]'))return;
  if(e.key==='Escape'&&readingApproach){e.preventDefault();stopReadingApproach();readingReturnArmed=false;return;}
  const readingKey=['ArrowUp','PageUp','ArrowDown','PageDown',' '].includes(e.key);
  if(['Home','End','Escape'].includes(e.key))dissolveIntent=null;
  if(phase==='reading'&&!pageFade&&readingKey){
    const direction=['ArrowUp','PageUp'].includes(e.key)||e.key===' '&&e.shiftKey?-1:1;
    if(dissolveInput(direction*(e.key.startsWith('Arrow')?40:innerHeight*.8),e))return;
  }
  if(pageFade){
    if(e.key==='Escape'){e.preventDefault();finishPageFade(pageFade.progress>=.5?1:0);return;}
    if(readingKey){e.preventDefault();if(pageFade.mode==='fade')pageFade.target=['ArrowUp','PageUp'].includes(e.key)||e.key===' '&&e.shiftKey?0:1;return;}
  }
  if(e.defaultPrevented||e.ctrlKey||e.metaKey||e.altKey||(!stageLocked&&!stage.contains(document.activeElement))||e.target.closest?.('input,textarea,select,[contenteditable="true"]'))return;
  if(phase==='reading')return;
  if((phase==='exitReady'||phase==='ready')&&['ArrowUp','PageUp'].includes(e.key)){leaveStage(e,e.key==='PageUp'?-innerHeight*.8:-100);return;}
  if(['ArrowUp','PageUp'].includes(e.key)){e.preventDefault();input(-1,true,e.key==='PageUp'?innerHeight*.6:100);}
  else if(['ArrowDown','PageDown',' '].includes(e.key)){e.preventDefault();input(1,!e.repeat);}
  else if(e.key==='Escape'){e.preventDefault();cancel();}
});
addEventListener('click',e=>{
  const link=e.target.closest?.('a[href]');
  if(link)dissolveIntent=null;
  // The custom Top control prevents the native click and then animates scroll itself.
  const navigates=link&&(!e.defaultPrevented||link.getAttribute('href')==='#top')&&e.button===0&&!e.ctrlKey&&!e.metaKey;
  if(readingApproach&&navigates){stopReadingApproach();readingReturnArmed=false;}
  if(pageFade&&navigates)clearPageFade();
  if(stageLocked&&!e.defaultPrevented&&e.button===0&&!e.ctrlKey&&!e.metaKey&&link&&(!link.target||link.target==='_self'))toReading(false);
});
addEventListener('resize',size);reduce.addEventListener('change',()=>{if(reduce.matches){stopMiddleScroll();resetTouchBurst();toReading(false);for(const pair of dissolves)setPageDissolve(pair,1);}});
function syncFadeAnchor(){
  dissolveIntent=null;const number=Number(location.hash.replace('#ppt-page-','')),page=document.getElementById('ppt-page-'+number);if(!page)return;
  if(phase!=='reading')toReading(false);
  if(number===6)homePage.style.transform='';
  // A named frame selects its state directly; native smooth anchor travel must not reset it en route.
  const pair=dissolves.find(pair=>pair.source===page||pair.page===page);
  jump(number===6?base():pair?dissolveAnchor(pair):scrollY+page.getBoundingClientRect().top);readingLastY=scrollY;
  for(const pair of dissolves)setPageDissolve(pair,reduce.matches||number>=Number(pair.page.dataset.page)?1:0);
}
addEventListener('hashchange',()=>{clearPageFade();syncFadeAnchor();});
addEventListener('pagehide',clearPageFade);
// Direct source-page links are a reading request, not an animation request.
if(!window.swarovskiReadingResume?.saved&&/^#ppt-page-/.test(location.hash)){
  const initialAnchor=location.hash;
  const html=document.documentElement,scrollBehavior=html.style.scrollBehavior;
  // Suppress native smooth fragment travel while this controller selects the named frame.
  html.style.scrollBehavior='auto';
  const settleAnchor=()=>{if(location.hash===initialAnchor&&phase==='reading'&&!pageFade&&lastInput===-Infinity)syncFadeAnchor();};
  toReading(false);syncFadeAnchor();
  // Gallery fragments have one positioning owner, after the native fragment jump.
  addEventListener('pageshow',event=>{requestAnimationFrame(()=>{if(!event.persisted)settleAnchor();html.style.scrollBehavior=scrollBehavior;});},{once:true});
}
// Reload restores the layout/state that existed before unloading. Saved animation
// frames stay still until input; stale fragments never select a different page.
function snapshotGallery(){
  const now=reloadPausedAt??performance.now(),r=root.getBoundingClientRect();
  return {phase,active:stageLocked&&phase!=='reading'&&r.top<innerHeight&&r.bottom>0,
    elapsed:now-start,previewElapsed:now-previewStart,brakeElapsed:now-brakeStart,
    offset,zoomProgress,zoomTarget,reverseOffset,retractElapsed,retractDirection,windowReadTarget,
    travelFrom,travelTo,travelDuration,travelRest,flowSpeed,
    homeReturn:homeReturn?{from:homeReturn.from,duration:homeReturn.duration,elapsed:now-homeReturn.start}:null,
    fades:dissolves.map(pair=>pair.value)};
}
function restoreGallery(state){
  if(!state||reduce.matches)return;
  if(!['reading','ready','entry','preview','zoom','brake','retract','parked','travel','backMiddle','exitReady'].includes(state.phase))return;
  cancelAnimationFrame(raf);raf=0;
  if(state.phase==='reading'){
    if(phase!=='reading')toReading(false);
  }else{
    const now=performance.now();
    offset=Number(state.offset)||0;zoomProgress=Number(state.zoomProgress)||0;zoomTarget=Number(state.zoomTarget)||0;
    reverseOffset=Number(state.reverseOffset)||0;retractElapsed=Number(state.retractElapsed)||0;retractDirection=state.retractDirection===-1?-1:1;
    windowReadTarget=Number.isFinite(state.windowReadTarget)?state.windowReadTarget:null;
    travelFrom=Number(state.travelFrom)||0;travelTo=Number(state.travelTo)||0;travelDuration=Number(state.travelDuration)||0;travelRest=state.travelRest||'parked';flowSpeed=Number(state.flowSpeed)||0;
    start=now-(Number(state.elapsed)||0);previewStart=now-(Number(state.previewElapsed)||0);brakeStart=now-(Number(state.brakeElapsed)||0);
    homeReturn=state.homeReturn?{from:state.homeReturn.from,duration:state.homeReturn.duration,start:now-state.homeReturn.elapsed}:null;
    phase=state.phase;root.dataset.phase=phase;frameTime=now;reloadPausedAt=now;root.dataset.reloadPaused='true';
    if(state.active&&phase!=='ready')lockStage();
    draw(now);
  }
  state.fades?.forEach((value,i)=>{if(dissolves[i]&&Number.isFinite(value))setPageDissolve(dissolves[i],clamp(value));});
  readingLastY=scrollY;
}
window.swarovskiReadingResume?.registerGallery({snapshot:snapshotGallery});
restoreGallery(reloadGallery);
stage.addEventListener('touchmove',e=>{if(e.touches.length===1)resumeReload();},{passive:true,capture:true});
addEventListener('keydown',e=>{if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&['ArrowDown','ArrowUp','PageDown','PageUp',' '].includes(e.key)&&(stageLocked||stage.contains(document.activeElement)))resumeReload();},{capture:true});
const pages=[...reader.querySelectorAll('.sg-page')];const observer=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){let i=pages.indexOf(e.target);pages.slice(Math.max(0,i-1),i+4).forEach(p=>p.querySelector('img').loading='eager');}}),{rootMargin:'900px'});pages.forEach(p=>{observer.observe(p);const img=p.querySelector('img');img.addEventListener('error',()=>p.querySelector('a').hidden=false);});
})();

