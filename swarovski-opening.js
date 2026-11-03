/* Fixed artboard opening; mobile browser chrome never retimes the scroll track. */
(() => {
'use strict';
const reduce=matchMedia('(prefers-reduced-motion: reduce)'),coarse=matchMedia('(hover: none) and (pointer: coarse)');
const opening=document.querySelector('.opening'),stage=document.querySelector('.opening-stage'),heading=document.querySelector('.opening-heading'),media=document.querySelector('.hero-media');
const caption=heading.querySelector('.hero-caption'),image=media.querySelector('img');
const clamp=v=>Math.max(0,Math.min(1,v)),mix=(a,b,t)=>a+(b-a)*t;
const smooth=v=>{const t=clamp(v);return t*t*(3-2*t)};
let frame=0,lastTime=0,progress=0,target=0,height=900,stageHeight=0,visualHeight=900,visualOffset=0,mediaHeight=0,travel=1620,start=0,end=0;
let scaleFactor=1,measuredWidth=0,headingHeight=900,titleHalfHeight=0;
function draw(p){
 stage.style.setProperty('--kv-tail-opacity',smooth((p-.8)/.2));
 const mobile=coarse.matches&&innerWidth<=980;
 const rise=p*(2-p),scale=mix(mobile?.62:.38,1,rise);
 const finalY=Math.max(0,visualHeight-mediaHeight-36.54125);
 const firstY=mobile?finalY+mediaHeight*.18:visualHeight*1.03;
 const y=visualOffset+mix(firstY,finalY,rise);
 media.style.transform='translate3d(0,'+y+'px,0) scale('+scale+')';
 const headingY=mobile?0:-height*.63*smooth(p/.94);
 heading.style.transform='translate3d(0,'+headingY+'px,0)';
 caption.style.opacity=String(1-smooth((p-.06)/.04));
 const originalFade=1-smooth((p-.22)/.55);
 // Maintain a clear title/image gap even when a late image joins a fast swipe.
 const clearance=y-(headingHeight*.5+headingY+titleHalfHeight+36);
 heading.style.opacity=String(coarse.matches?Math.min(originalFade,smooth(clearance/96)):originalFade);
}
function tick(time){
 frame=0;if(reduce.matches)return;
 const pageY=scrollY/scaleFactor;target=clamp((pageY-start)/travel);
 const active=pageY>=start-height&&pageY<end;opening.classList.toggle('is-active',active);
 const dt=lastTime?Math.min(64,time-lastTime):16.67;lastTime=time;
 // Native touch scroll already interpolates motion. Do not trail it with a second easing loop.
 if(coarse.matches||!active||target===0)progress=target;
 else progress+=(target-progress)*(1-Math.exp(-dt/55));
 if(Math.abs(target-progress)<.0001)progress=target;
 draw(progress);if(progress!==target)frame=requestAnimationFrame(tick);else lastTime=0;
}
function scroll(){if(!reduce.matches&&!frame)frame=requestAnimationFrame(tick);}
function measure(force=false){
 if(!force&&coarse.matches&&measuredWidth===innerWidth)return;
 document.documentElement.classList.toggle('opening-mobile-flow',coarse.matches&&innerWidth<=980&&!reduce.matches);
 measuredWidth=innerWidth;scaleFactor=document.body.getBoundingClientRect().width/1440;
 height=900;mediaHeight=media.offsetHeight;
 const mobile=coarse.matches&&innerWidth<=980,viewport=innerHeight/scaleFactor;
 headingHeight=viewport*(mobile?.55:1);
 titleHalfHeight=heading.querySelector('h1').offsetHeight/2;
 visualHeight=mobile?headingHeight+mediaHeight+36.54125:Math.max(height,mediaHeight+90);
 const stageSize=Math.max(visualHeight,headingHeight);
 opening.style.setProperty('--opening-heading-height',headingHeight+'px');
 opening.style.setProperty('--opening-stage-height',stageSize+'px');
 stageHeight=stage.clientHeight;visualOffset=Math.max(0,stageHeight-visualHeight);
 opening.style.setProperty('--opening-visual-height',visualHeight+'px');
 opening.style.setProperty('--opening-visual-offset',visualOffset+'px');
 travel=mobile?Math.max(60,Math.min(viewport*.32,mediaHeight*.65)):Math.min(stageHeight*1.2,1620);opening.style.setProperty('--opening-travel',(mobile?0:travel)+'px');
 const top=(opening.getBoundingClientRect().top+scrollY)/scaleFactor;
 start=top+(mobile?Math.max(0,headingHeight+mediaHeight/2-viewport/2):0);end=top+opening.offsetHeight;scroll();
}
function setup(){
 cancelAnimationFrame(frame);frame=0;lastTime=0;
 document.documentElement.classList.toggle('opening-enhanced',!reduce.matches);
 if(reduce.matches){heading.style.transform='';heading.style.opacity='';caption.style.opacity='';media.style.transform='';opening.classList.remove('is-active');}
 measure(true);
}
if(image&&!image.complete){
 media.classList.add('is-waiting');
 const ready=()=>{media.classList.remove('is-waiting');scroll();};
 image.addEventListener('load',()=>{image.decode().catch(()=>{}).then(ready);},{once:true});
 image.addEventListener('error',ready,{once:true});
}else if(image?.naturalWidth){image.decode().catch(()=>{});}
addEventListener('scroll',scroll,{passive:true});addEventListener('resize',()=>measure(),{passive:true});reduce.addEventListener('change',setup);setup();
addEventListener('pageshow',event=>{measure();if(event.persisted||window.swarovskiReadingResume?.saved||!location.hash||/^#ppt-page-/.test(location.hash))return;requestAnimationFrame(()=>{let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}const target=document.getElementById(id);if(target)target.scrollIntoView({behavior:'instant',block:'start'});});});
})();