/* CAMON 40 opening choreography: title-only arrival, then one continuous KV rise/scale. */
(() => {
'use strict';
const reduce=matchMedia('(prefers-reduced-motion: reduce)'),coarse=matchMedia('(hover: none) and (pointer: coarse)');
const opening=document.querySelector('.opening'),stage=document.querySelector('.opening-stage'),heading=document.querySelector('.opening-heading'),media=document.querySelector('.hero-media');
const caption=heading.querySelector('.hero-caption'),image=media.querySelector('img');
const mobileOpening=matchMedia('(max-width: 980px) and (hover: none) and (pointer: coarse)');
const kvTail=36.54125; // White seam in swarovski-ppt01.css, in artboard pixels.
const clamp=v=>Math.max(0,Math.min(1,v)),mix=(a,b,t)=>a+(b-a)*t;
const smooth=v=>{const t=clamp(v);return t*t*(3-2*t)};
let frame=0,lastTime=0,progress=0,target=0,height=900,stageHeight=0,visualHeight=900,visualOffset=0,mediaHeight=0,travel=1620,start=0,end=0;
let scaleFactor=1,measuredWidth=0,measuredHeight=0,headingHeight=900,titleHalfHeight=0;
function draw(p){
 stage.style.setProperty('--kv-tail-opacity',smooth((p-.8)/.2));
 const mobile=mobileOpening.matches;
 const rise=p*(2-p),scale=mix(.38,1,rise);
 let y;
 if(mobile){
  // Use the stage bottom as the physical landing edge. Percentage translation
  // follows the figure's actual height, even when its first layout was incomplete.
  const remaining=1-rise;
  const dy='calc('+remaining*100+'% + '+remaining*(kvTail+height*.03)+'px)';
  media.style.transform='translate3d(0,'+dy+',0) scale('+scale+')';
 }else{
  const finalY=Math.max(0,visualHeight-mediaHeight-kvTail);
  y=visualOffset+mix(visualHeight*1.03,finalY,rise);
  media.style.transform='translate3d(0,'+y+'px,0) scale('+scale+')';
 }
 const headingY=-height*.63*smooth(p/.94);
 heading.style.transform='translate3d(0,'+headingY+'px,0)';
 caption.style.opacity=String(1-smooth((p-.06)/.04));
 const originalFade=1-smooth((p-.22)/.55);
 // Mobile uses CAMON 40's single progress-driven title fade.
 if(coarse.matches&&!mobile){
  const clearance=y-(headingHeight*.5+headingY+titleHalfHeight+36);
  heading.style.opacity=String(Math.min(originalFade,smooth(clearance/96)));
 }else heading.style.opacity=String(originalFade);
}
function tick(time){
 frame=0;if(reduce.matches)return;
 const pageY=scrollY/scaleFactor;target=clamp((pageY-start)/travel);
 const active=pageY>=start-height&&pageY<end;opening.classList.toggle('is-active',active);
 const dt=lastTime?Math.min(64,time-lastTime):16.67;lastTime=time;
 // Match CAMON 40's 55ms follow on phones as well as mouse-driven narrow windows.
 if(coarse.matches&&innerWidth>980||!active||target===0)progress=target;
 else progress+=(target-progress)*(1-Math.exp(-dt/55));
 if(Math.abs(target-progress)<.0001)progress=target;
 draw(progress);if(progress!==target)frame=requestAnimationFrame(tick);else lastTime=0;
}
function scroll(){if(!reduce.matches&&!frame)frame=requestAnimationFrame(tick);}
// While the title screen is at rest, follow Safari's visible viewport as its
// chrome settles. Once scrolling starts, keep the existing geometry for that gesture.
function viewportHeight(){
 const viewport=window.visualViewport;
 if(mobileOpening.matches&&viewport&&viewport.scale===1&&viewport.height>0)return viewport.height;
 return innerHeight;
}
function refreshAtTop(){
 if(mobileOpening.matches&&scrollY<=0&&Math.abs(viewportHeight()-measuredHeight)>.5)measure();
}
function measure(force=false){
 const viewHeight=viewportHeight();
 if(!force&&coarse.matches&&measuredWidth===innerWidth&&
    (!mobileOpening.matches||scrollY>0||Math.abs(viewHeight-measuredHeight)<=.5))return;
 measuredHeight=viewHeight;
 measuredWidth=innerWidth;scaleFactor=document.body.getBoundingClientRect().width/1440;
 const mobile=mobileOpening.matches&&!reduce.matches;
 media.style.top=mobile?'auto':'';
 media.style.bottom=mobile?kvTail+'px':'';
 height=900;headingHeight=viewHeight/scaleFactor;
 titleHalfHeight=heading.querySelector('h1').offsetHeight/2;
 // The mobile opening is a 900px artboard with a 16:9 KV. It must not
 // inherit the intrinsic image dimensions from a transient layout pass.
 if(!mobile)mediaHeight=media.offsetHeight;
 visualHeight=mobile?height:Math.max(height,mediaHeight+90);
 const stageSize=Math.max(visualHeight,headingHeight);
 opening.style.setProperty('--opening-heading-height',headingHeight+'px');
 opening.style.setProperty('--opening-stage-height',stageSize+'px');
 stageHeight=mobile?stageSize:stage.clientHeight;visualOffset=Math.max(0,stageHeight-visualHeight);
 opening.style.setProperty('--opening-visual-height',visualHeight+'px');
 opening.style.setProperty('--opening-visual-offset',visualOffset+'px');
 travel=Math.min(stageHeight*1.2,1620);opening.style.setProperty('--opening-travel',travel+'px');
 start=(opening.getBoundingClientRect().top+scrollY)/scaleFactor;end=start+opening.offsetHeight;scroll();
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
addEventListener('scroll',()=>{refreshAtTop();scroll();},{passive:true});
addEventListener('resize',()=>measure(),{passive:true});
window.visualViewport?.addEventListener('resize',refreshAtTop,{passive:true});
reduce.addEventListener('change',setup);setup();
addEventListener('pageshow',event=>{measure(mobileOpening.matches&&scrollY===0&&!window.swarovskiReadingResume?.saved);if(event.persisted||window.swarovskiReadingResume?.saved||!location.hash||/^#ppt-page-/.test(location.hash))return;requestAnimationFrame(()=>{let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}const target=document.getElementById(id);if(target)target.scrollIntoView({behavior:'instant',block:'start'});});});
})();