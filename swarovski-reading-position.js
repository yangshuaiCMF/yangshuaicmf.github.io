/* Own reading position across resize and reload. Run before animation controllers
   so they can restore document geometry without following an obsolete URL fragment. */
(() => {
  'use strict';
  const html=document.documentElement;
  if(html.dataset.project!=='swarovski')return;
  const selector='.sg-page,.cmf-development-grid > article,.cmf-development-grid > figure,main > section,.page-stack > section,.case-conclusion,.project-footer';
  const probeRatio=.45;
  const storageKey='swarovski-reading-v1',route=location.pathname+location.search;
  const reload=performance.getEntriesByType('navigation')[0]?.type==='reload';
  let saved=null;
  try{const value=JSON.parse(sessionStorage.getItem(storageKey));if(reload&&value?.route===route&&value.version===1)saved=value;}catch{}
  let gallery=null,restoring=!!saved;
  window.swarovskiReadingResume={saved,registerGallery(api){gallery=api;}};
  const previousBehavior=html.style.scrollBehavior;
  if(saved){history.scrollRestoration='manual';html.style.scrollBehavior='auto';}
  let snapshot=null,resizing=false,restoreFrame=0,settleTimer=0,captureFrame=0,persistTimer=0,touching=false,viewportWidth=innerWidth;
  const coarse=matchMedia('(hover: none) and (pointer: coarse)');
  const animationOwnsScroll=()=>html.matches('.sg-scroll-locked,.sg-dissolve-locked,.sg-home-approach-locked');

  function identify(element){
    if(element.id)return {id:element.id};
    if(element.parentElement?.classList.contains('cmf-development-grid'))return {cmf:[...element.parentElement.children].indexOf(element)};
    return null;
  }
  function resolve(key){return key?.id?document.getElementById(key.id):Number.isInteger(key?.cmf)?document.querySelector('.cmf-development-grid')?.children[key.cmf]:null;}
  function persist(){
    if(restoring||resizing)return;
    const element=snapshot?.element, fraction=snapshot?.fraction||0;
    try{sessionStorage.setItem(storageKey,JSON.stringify({version:1,route,anchor:element?identify(element):null,fraction,scrollY,gallery:gallery?.snapshot()}));}catch{}
  }

  function usable(element){
    if(!element||!element.isConnected||element.getAttribute('aria-hidden')==='true')return false;
    const style=getComputedStyle(element),rect=element.getBoundingClientRect();
    return style.display!=='none'&&style.visibility!=='hidden'&&rect.height>1;
  }
  function chooseAnchor(){
    const probe=innerHeight*probeRatio,pointY=Math.max(0,Math.min(innerHeight-1,probe));
    const hit=document.elementFromPoint(innerWidth*.5,pointY);
    let element=hit?.closest?.(selector);
    if(usable(element))return element;
    let best=null,bestDistance=Infinity;
    for(const candidate of document.querySelectorAll(selector)){
      if(!usable(candidate))continue;
      const rect=candidate.getBoundingClientRect();
      const distance=probe<rect.top?rect.top-probe:probe>rect.bottom?probe-rect.bottom:0;
      if(distance<bestDistance){best=candidate;bestDistance=distance;if(distance===0)break;}
    }
    return best;
  }
  function capture(){
    captureFrame=0;
    if(restoring||resizing||animationOwnsScroll())return;
    const element=chooseAnchor();if(!element)return;
    const rect=element.getBoundingClientRect(),probe=innerHeight*probeRatio;
    snapshot={element,fraction:Math.max(0,Math.min(1,(probe-rect.top)/rect.height))};
    if(!persistTimer)persistTimer=setTimeout(()=>{persistTimer=0;persist();},250);
  }
  function queueCapture(){if(!captureFrame)captureFrame=requestAnimationFrame(capture);}
  function restore(){
    restoreFrame=0;
    if(!snapshot||touching||animationOwnsScroll()||!usable(snapshot.element))return;
    const rect=snapshot.element.getBoundingClientRect(),probe=innerHeight*probeRatio;
    const target=scrollY+rect.top+rect.height*snapshot.fraction-probe;
    scrollTo({top:Math.max(0,target),left:0,behavior:'instant'});
  }
  function queueRestore(){
    cancelAnimationFrame(restoreFrame);
    restoreFrame=requestAnimationFrame(()=>{restoreFrame=requestAnimationFrame(restore);});
  }
  function resized(){
    const width=innerWidth;
    if(coarse.matches&&width===viewportWidth)return;
    viewportWidth=width;
    if(restoring)return;
    if(!resizing){if(!snapshot)capture();resizing=true;}
    queueRestore();clearTimeout(settleTimer);
    settleTimer=setTimeout(()=>{restore();resizing=false;queueCapture();},180);
  }
  addEventListener('touchstart',()=>{touching=true;if(resizing){cancelAnimationFrame(restoreFrame);clearTimeout(settleTimer);resizing=false;queueCapture();}},{passive:true});
  addEventListener('touchend',()=>{touching=false;queueCapture();},{passive:true});
  addEventListener('touchcancel',()=>{touching=false;queueCapture();},{passive:true});
  addEventListener('scroll',queueCapture,{passive:true});
  addEventListener('resize',resized,{passive:true});
  addEventListener('pagehide',()=>{clearTimeout(persistTimer);persistTimer=0;capture();persist();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)persist();});
  addEventListener('pageshow',event=>{
    if(!saved||event.persisted){restoring=false;requestAnimationFrame(capture);return;}
    const restoreReload=()=>{
      if(saved.gallery?.phase&&saved.gallery.phase!=='reading'){
        const stage=document.querySelector('.sg');
        // Only an actually visible animation owns the reload viewport.
        if(saved.gallery.active&&stage){scrollTo({top:scrollY+stage.getBoundingClientRect().top,behavior:'instant'});return;}
      }
      const element=resolve(saved.anchor);
      if(usable(element)){const rect=element.getBoundingClientRect();scrollTo({top:Math.max(0,scrollY+rect.top+rect.height*saved.fraction-innerHeight*probeRatio),behavior:'instant'});}
      else scrollTo({top:saved.scrollY||0,behavior:'instant'});
    };
    // Layout, opening measurements and the browser's fragment handling settle first.
    restoreReload();requestAnimationFrame(()=>{restoreReload();requestAnimationFrame(()=>{
      restoreReload();restoring=false;html.style.scrollBehavior=previousBehavior;history.scrollRestoration='auto';capture();
    });});
  });
  addEventListener('load',()=>{if(!restoring)requestAnimationFrame(capture);},{once:true});
})();
