/* Pinned CAMON40 opening, copied 2026-10-19; isolate future template edits. */
(() => {
'use strict';
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const opening=document.querySelector('.opening'),stage=document.querySelector('.opening-stage'),heading=document.querySelector('.opening-heading'),media=document.querySelector('.hero-media');
const caption=heading.querySelector('.hero-caption');
// Scroll coordinates are screen pixels; animation geometry uses the fixed artboard.
const layoutScale=()=>document.body.getBoundingClientRect().width/1440;
const clamp=v=>Math.max(0,Math.min(1,v)),mix=(a,b,t)=>a+(b-a)*t;
const smooth=v=>{const t=clamp(v);return t*t*(3-2*t)};
let frame=0,lastTime=0,progress=0,target=0,height=900,stageHeight=0,visualHeight=900,visualOffset=0,mediaHeight=0,travel=1620,start=0,end=0;
function draw(p){
 // One continuous rise: position and scale share a monotone curve with no restart.
 const rise=p*(2-p),scale=mix(.38,1,rise);
 const finalY=Math.max(0,visualHeight-mediaHeight-45);
 const y=visualOffset+mix(visualHeight*1.03,finalY,rise);
 media.style.transform='translate3d(0,'+y+'px,0) scale('+scale+')';
 const headingY=-height*.63*smooth(p/.94);
 heading.style.transform='translate3d(0,'+headingY+'px,0)';
 // Fade once with scroll progress; the moving KV/title gap can reopen later.
 caption.style.opacity=String(1-smooth((p-.06)/.04));
 heading.style.opacity=String(1-smooth((p-.22)/.55));
}
function tick(time){frame=0;const dt=lastTime?Math.min(64,time-lastTime):16.67;lastTime=time;progress+=(target-progress)*(1-Math.exp(-dt/55));if(Math.abs(target-progress)<.0001)progress=target;draw(progress);if(progress!==target)frame=requestAnimationFrame(tick);else lastTime=0;}
function scroll(){if(reduce.matches)return;const pageY=scrollY/layoutScale();target=clamp((pageY-start)/travel);const active=pageY>=start-height&&pageY<end;opening.classList.toggle('is-active',active);if(!active||target===0){cancelAnimationFrame(frame);frame=0;lastTime=0;progress=target;draw(progress);}else if(!frame)frame=requestAnimationFrame(tick);}
// Keep the pinned stage at least viewport-high, so copy enters only after release.
function measure(){
 height=900;mediaHeight=media.offsetHeight;
 // Center the title in the visible viewport; the KV keeps its fixed artboard.
 opening.style.setProperty('--opening-heading-height',innerHeight/layoutScale()+'px');
 visualHeight=Math.max(height,mediaHeight+90);
 const stageSize=Math.max(visualHeight,innerHeight/layoutScale());
 opening.style.setProperty('--opening-stage-height',stageSize+'px');
 stageHeight=stage.clientHeight;
 visualOffset=Math.max(0,stageHeight-visualHeight);
 opening.style.setProperty('--opening-visual-height',visualHeight+'px');
 opening.style.setProperty('--opening-visual-offset',visualOffset+'px');
 // Finish sooner on desktop, without adding a long hold in tall preview windows.
 travel=Math.min(stageHeight*1.2,1620);
 opening.style.setProperty('--opening-travel',travel+'px');
 start=(opening.getBoundingClientRect().top+scrollY)/layoutScale();end=start+opening.offsetHeight;scroll();
}
function setup(){cancelAnimationFrame(frame);frame=0;lastTime=0;document.documentElement.classList.toggle('opening-enhanced',!reduce.matches);if(reduce.matches){heading.style.transform='';heading.style.opacity='';caption.style.opacity='';media.style.transform='';opening.classList.remove('is-active');}measure();}
addEventListener('scroll',scroll,{passive:true});addEventListener('resize',measure,{passive:true});reduce.addEventListener('change',setup);setup();
// Resolve deep links after the opening stage has established its scroll height.
addEventListener('pageshow',event=>{measure();if(event.persisted||!location.hash)return;requestAnimationFrame(()=>{let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}const target=document.getElementById(id);if(target)target.scrollIntoView({behavior:'instant',block:'start'});});});
})();
