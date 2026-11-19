/*
 * CI-only comparison against the exact V77 and V78 Pages trees.
 *
 * V78_BASELINE_URL=http://127.0.0.1:4174/ V78_BASE_URL=http://127.0.0.1:4173/
 * NODE_PATH=<isolated Playwright install>/node_modules node scripts/qa-mobile-performance-v78.cjs
 *
 * Software Chromium timings describe this runner, not a physical iPhone. The
 * test gates usable gestures and the intended render budget. Timing comparisons
 * are evidence, not a hardware-independent FPS claim.
 */
const {chromium} = require('playwright');
const {mkdirSync, writeFileSync} = require('node:fs');
const path = require('node:path');

const baseline = process.env.V78_BASELINE_URL;
const candidate = process.env.V78_BASE_URL;
if (!baseline || !candidate) throw new Error('Set V78_BASELINE_URL and V78_BASE_URL to the two staged Pages trees.');
const out = process.env.V78_PERF_OUTPUT || path.resolve('v78-performance-evidence');
mkdirSync(out, {recursive:true});
const report = {
  schemaVersion:1,
  generatedAt:new Date().toISOString(),
  setup:{viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,stepsPerGesture:4,separateBrowserProcesses:true},
  limits:[
    'Headless Chromium with SwiftShader on one CI runner; not a physical phone, Safari, or WeChat performance test.',
    'CDP dispatch acknowledgement includes browser scheduling and transport; it is not a measured hardware touch-to-display latency.',
    'Input CPU is the sum of instrumented native event listener execution for each event; browser default actions and GPU work are excluded.',
    'Combined movement CPU includes pointermove and pointerrawupdate listeners, normalized by ordinary pointermove count.',
    'Frame intervals include this runner\'s software rendering and scheduling. Their ratio is descriptive; no device FPS guarantee is made.',
    'Both versions load with the same rigqa pose diagnostics enabled. Instrumentation exists only in this test process.'
  ],
  checks:[],errors:[],versions:[],comparison:null
};
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const percentile = (values, p) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a,b)=>a-b);
  return sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*p))];
};
const stats = values => ({count:values.length,p50:percentile(values,.5),p95:percentile(values,.95),max:values.length?Math.max(...values):null,
  mean:values.length?values.reduce((a,b)=>a+b,0)/values.length:null});
function check(name, pass, detail) {
  report.checks.push({name,pass:!!pass,detail});
  console.log(`${pass?'PASS':'FAIL'} ${name} ${JSON.stringify(detail??null)}`);
  if (!pass) throw new Error(name);
}

/* Executed before application code. No production module is modified. */
function installInstrumentation() {
  let active = null;
  let frameDraws = {calls:0,triangles:0};
  const contexts = new Set();
  const originals = new WeakMap();
  const inputTypes = new Set(['pointerdown','pointerrawupdate','pointermove','pointerup','pointercancel','pointerover','pointerout','touchstart','touchmove','touchend','touchcancel']);
  const nativeAdd = EventTarget.prototype.addEventListener;
  const nativeRemove = EventTarget.prototype.removeEventListener;
  const nativePointers=new Set();
  for(const type of ['pointerdown','pointerrawupdate','pointermove','pointerup','pointercancel']) {
    nativeAdd.call(window,type,event=>{
      if(type==='pointerdown')nativePointers.add(event.pointerId);
      if(type==='pointerup'||type==='pointercancel')nativePointers.delete(event.pointerId);
      if(active)active.nativeInput.push({type,pointerId:event.pointerId,pointerType:event.pointerType,x:event.clientX,y:event.clientY,
        atMs:performance.now()-active.start,target:event.target?.tagName||'',inScene:!!event.target?.closest?.('.tree-stage'),activePointerIds:[...nativePointers]});
    },{capture:true,passive:true});
  }
  const captureOf = options => typeof options === 'boolean' ? options : !!options?.capture;
  function wrappedFor(target, type, callback, capture, create) {
    let byType = originals.get(target);
    if (!byType) {if (!create) return null; originals.set(target,byType=new Map());}
    let byCallback=byType.get(type);
    if (!byCallback) {if (!create) return null; byType.set(type,byCallback=new WeakMap());}
    let byCapture=byCallback.get(callback);
    if (!byCapture) {if (!create) return null; byCallback.set(callback,byCapture=new Map());}
    let wrapped=byCapture.get(capture);
    if (!wrapped && create) {
      wrapped=function(event) {
        const phase=active;
        if (!phase) return typeof callback==='function'?callback.call(this,event):callback.handleEvent(event);
        let sample=phase.eventMap.get(event);
        if (!sample) {
          sample={type:event.type,pointerType:event.pointerType||'',pointerId:event.pointerId,cpuMs:0,handlers:0};
          phase.eventMap.set(event,sample);phase.events.push(sample);
        }
        const start=performance.now();
        try {return typeof callback==='function'?callback.call(this,event):callback.handleEvent(event);}
        finally {sample.cpuMs+=performance.now()-start;sample.handlers++;}
      };
      byCapture.set(capture,wrapped);
    }
    return wrapped;
  }
  EventTarget.prototype.addEventListener=function(type,callback,options) {
    const valid=callback&&(typeof callback==='function'||typeof callback==='object');
    return nativeAdd.call(this,type,inputTypes.has(type)&&valid?wrappedFor(this,type,callback,captureOf(options),true):callback,options);
  };
  EventTarget.prototype.removeEventListener=function(type,callback,options) {
    const valid=callback&&(typeof callback==='function'||typeof callback==='object');
    return nativeRemove.call(this,type,inputTypes.has(type)&&valid?(wrappedFor(this,type,callback,captureOf(options),false)||callback):callback,options);
  };
  function triangleCount(mode,count,instances) {
    if (mode===4) return count/3*instances;
    if (mode===5||mode===6) return Math.max(0,count-2)*instances;
    return 0;
  }
  const patchedPrototypes=new Set();
  for (const Constructor of [window.WebGLRenderingContext,window.WebGL2RenderingContext]) {
    if (!Constructor || patchedPrototypes.has(Constructor.prototype)) continue;
    const prototype=Constructor.prototype;patchedPrototypes.add(prototype);
    for (const [name,countIndex,instanceIndex] of [['drawArrays',2,null],['drawElements',1,null],['drawArraysInstanced',2,3],['drawElementsInstanced',1,4]]) {
      const original=prototype[name];
      if (!original) continue;
      prototype[name]=function(...args) {
        contexts.add(this);
        if (active && this.canvas?.closest?.('.tree-stage')) {
          frameDraws.calls++;
          frameDraws.triangles+=triangleCount(args[0],args[countIndex],instanceIndex===null?1:args[instanceIndex]);
        }
        return original.apply(this,args);
      };
    }
  }
  const longTasks=[];
  let observer;
  if (window.PerformanceObserver?.supportedEntryTypes?.includes('longtask')) {
    observer=new PerformanceObserver(list=>{
      for(const entry of list.getEntries()) longTasks.push({start:entry.startTime,duration:entry.duration});
    });
    observer.observe({type:'longtask',buffered:true});
  }
  function tick(now) {
    if (active) {
      const canvas=document.querySelector('.tree-stage canvas');
      active.frames.push({
        atMs:now,
        intervalMs:active.lastFrame===null?null:now-active.lastFrame,
        drawCalls:frameDraws.calls,triangles:frameDraws.triangles,
        width:canvas?.width||0,height:canvas?.height||0,
        quality:document.documentElement.dataset.sceneQuality||null
      });
      active.lastFrame=now;
    }
    frameDraws={calls:0,triangles:0};
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  window.__mobilePerfQA={
    begin(name) {
      if (active) throw new Error('Performance phase already running');
      frameDraws={calls:0,triangles:0};
      active={name,start:performance.now(),lastFrame:null,frames:[],events:[],nativeInput:[],eventMap:new WeakMap()};
    },
    peek() {
      const eventCounts={};
      for(const event of active?.events||[])eventCounts[event.type]=(eventCounts[event.type]||0)+1;
      return {frames:active?.frames.length||0,drawnFrames:active?.frames.filter(f=>f.drawCalls>0).length||0,eventCounts,
        activePointerIds:[...nativePointers],nativeInput:active?.nativeInput||[]};
    },
    end() {
      if (!active) throw new Error('No performance phase running');
      const phase=active;active=null;
      const end=performance.now();
      return {name:phase.name,durationMs:end-phase.start,frames:phase.frames,events:phase.events,nativeInput:phase.nativeInput,
        longTasks:longTasks.filter(task=>task.start>=phase.start&&task.start<end)};
    },
    environment() {
      return [...contexts].filter(gl=>gl.canvas?.closest?.('.tree-stage')).map(gl=>{
        const extension=gl.getExtension('WEBGL_debug_renderer_info');
        return {version:gl.getParameter(gl.VERSION),renderer:extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),
          antialias:gl.getContextAttributes()?.antialias,drawingBuffer:[gl.drawingBufferWidth,gl.drawingBufferHeight]};
      });
    }
  };
}

const readState = page => page.evaluate(()=>{
  const data=document.documentElement.dataset;
  const canvas=document.querySelector('.tree-stage canvas');
  const rect=canvas?.getBoundingClientRect();
  return {
    ready:data.princessV77,held:data.princessHeldKitten,ground:data.groundCatCount,
    arms:data.princessArmRig,eyelids:data.princessEyelidRig,
    performance:data.scenePerformance,quality:data.sceneQuality,pixelBudget:Number(data.scenePixelBudget),dpr:Number(data.sceneDpr),
    points:JSON.parse(data.characterHitPoints||'{}'),
    camera:{position:(data.cameraPosition||'').split(',').map(Number),target:(data.cameraTarget||'').split(',').map(Number),distance:Number(data.cameraDistance)},
    manual:data.cameraManualHold,
    clock:Number(data.characterClock),rotation:document.querySelector('.tree-stage')?.dataset.rotation,
    pause:{character:data.characterPaused,camera:data.cameraPaused,active:data.cameraActive,visible:data.characterVisible,
      auto:data.cameraAutoEnabled,document:document.visibilityState,focused:document.hasFocus()},
    dialogs:[...document.querySelectorAll('dialog[open]')].map(dialog=>({className:dialog.className,label:dialog.getAttribute('aria-label')})),
    buffer:canvas?{width:canvas.width,height:canvas.height,pixels:canvas.width*canvas.height}:null,
    rect:rect?{x:rect.x,y:rect.y,width:rect.width,height:rect.height}:null,
    fallback:document.body.innerText.includes('当前浏览器无法显示')
  };
});
function summarizePhase(raw) {
  const rendered=raw.frames.filter(frame=>frame.drawCalls>0);
  const intervals=raw.frames.map(frame=>frame.intervalMs).filter(n=>Number.isFinite(n)&&n>0);
  const renderIntervals=rendered.slice(1).map((frame,index)=>frame.atMs-rendered[index].atMs).filter(n=>Number.isFinite(n)&&n>0);
  const events={};
  for(const type of new Set(raw.events.map(event=>event.type))) {
    const samples=raw.events.filter(event=>event.type===type);
    events[type]={...stats(samples.map(event=>event.cpuMs)),totalCpuMs:samples.reduce((sum,event)=>sum+event.cpuMs,0),handlerCalls:samples.reduce((sum,event)=>sum+event.handlers,0)};
  }
  return {
    name:raw.name,durationMs:raw.durationMs,
    frameIntervalsMs:stats(intervals),rafCallbackFps:intervals.length?1000/(intervals.reduce((a,b)=>a+b,0)/intervals.length):null,
    renderedFrameIntervalsMs:stats(renderIntervals),measuredRenderFps:renderIntervals.length?1000/(renderIntervals.reduce((a,b)=>a+b,0)/renderIntervals.length):null,
    renderedFrames:rendered.length,drawCalls:stats(rendered.map(frame=>frame.drawCalls)),triangles:stats(rendered.map(frame=>frame.triangles)),
    renderPixels:stats(rendered.map(frame=>frame.width*frame.height)),qualities:[...new Set(raw.frames.map(frame=>frame.quality))],
    inputEvents:events,nativeInput:raw.nativeInput,longTasks:{...stats(raw.longTasks.map(task=>task.duration)),totalMs:raw.longTasks.reduce((sum,task)=>sum+task.duration,0)}
  };
}
function distance(a,b) {return Math.hypot(...a.map((v,i)=>v-b[i]));}
async function waitForCameraDelta(page,before,field) {
  // CDP acknowledgement does not promise that the renderer has already handled
  // the corresponding pointer event. Wait for the actual OrbitControls result,
  // with the same 20-second ceiling used by the other rendered-scene gates.
  await page.waitForFunction(({before,field})=>{
    const data=document.documentElement.dataset;
    const current=(field==='target'?data.cameraTarget:data.cameraPosition)?.split(',').map(Number)||[];
    return current.length===3&&current.every(Number.isFinite)&&Math.hypot(...current.map((value,index)=>value-before[index]))>.01;
  },{before,field},{timeout:20000});
}
function point(state, target) {
  const r=state.rect;
  if(!r)throw new Error('Missing scene canvas');
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const desired=target==='princess'?state.points.princess:{x:r.x+r.width*.34,y:r.y+r.height*.30};
  if(!desired||!Number.isFinite(desired.x+desired.y))throw new Error('Missing projected princess point');
  return {x:clamp(desired.x,r.x+22,r.x+r.width-22),y:clamp(desired.y,r.y+35,r.y+r.height-35)};
}
async function dispatchTouch(cdp, type, points, samples) {
  const start=performance.now();
  const nativePoints=points.map((p,index)=>({...p,id:p.id??index+1,radiusX:2,radiusY:2,force:1}));
  await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:nativePoints});
  samples.push({type,touchPoints:nativePoints,acknowledgementMs:performance.now()-start});
}
async function probePartialRelease(context) {
  // Chromium has two native CDP touch implementations. Detect their documented
  // observable behavior on an empty page, independent of application listeners.
  const page=await context.newPage(),samples=[];
  try {
    await page.setContent('<!doctype html><html><head><style>html,body{margin:0;width:100%;height:100%;touch-action:none}</style></head><body></body></html>');
    await page.evaluate(()=>{
      window.__nativeTouchProbe=[];
      for(const type of ['pointerdown','pointermove','pointerup','pointercancel'])window.addEventListener(type,event=>window.__nativeTouchProbe.push({type,pointerId:event.pointerId,isTrusted:event.isTrusted}),{capture:true,passive:true});
    });
    const cdp=await context.newCDPSession(page);
    await dispatchTouch(cdp,'touchStart',[{x:110,y:200,id:1},{x:150,y:200,id:2}],samples);
    await dispatchTouch(cdp,'touchMove',[{x:111,y:200,id:1}],samples);
    let events=await page.evaluate(()=>window.__nativeTouchProbe);
    let mode='active-list';
    if(!events.some(event=>event.type==='pointerup')) {
      mode='explicit-end';
      await dispatchTouch(cdp,'touchEnd',[{x:150,y:200,id:2}],samples);
      events=await page.evaluate(()=>window.__nativeTouchProbe);
    }
    const down=events.filter(event=>event.type==='pointerdown'),up=events.filter(event=>event.type==='pointerup');
    check('native CDP probe releases exactly the second finger',down.length===2&&up.length===1&&up[0].pointerId===down[1].pointerId&&events.every(event=>event.isTrusted),{mode,events});
    await dispatchTouch(cdp,'touchEnd',[],samples);
    return {mode,events,dispatches:samples};
  } finally {await page.close();}
}
async function runGesture(page,cdp,version,target,kind) {
  const name=target+'-'+kind;
  const before=await readState(page);
  const first=point(before,target);
  const direction=first.x+72>before.rect.x+before.rect.width?-1:1;
  const second={x:first.x+34*direction,y:first.y+6};
  const acknowledgements=[],checkpoints=[];
  await page.evaluate(name=>window.__mobilePerfQA.begin(name),name);
  let during,after,phase,failure=null;
  const observe=async step=>{
    const state=await readState(page),input=await page.evaluate(()=>window.__mobilePerfQA.peek());
    checkpoints.push({step,state,input});
    if(state.dialogs.length||state.pause.active==='false')throw new Error(name+' stopped rendering behind an overlay: '+JSON.stringify({step,dialogs:state.dialogs,pause:state.pause}));
    return state;
  };
  const touchesAt=fraction=>kind==='pan'
    ?[{x:first.x+26*direction*fraction,y:first.y-18*fraction},{x:second.x+26*direction*fraction,y:second.y-18*fraction}]
    :[{x:first.x-16*direction*fraction,y:first.y-3*fraction},{x:second.x+16*direction*fraction,y:second.y+3*fraction}];
  try {
    // Queue the initial movement in protocol order without waiting for a slow
    // software-GPU visual-state acknowledgement after touchStart. Otherwise the
    // harness itself turns an intended drag into a multi-second stationary hold.
    // A separate stationary two-finger test below retains the long-press gate.
    const started=dispatchTouch(cdp,'touchStart',[first,second],acknowledgements);
    const moving=dispatchTouch(cdp,'touchMove',touchesAt(.6),acknowledgements);
    await Promise.all([started,moving]);
    await observe('start-and-first-move');
    for(const fraction of [.73,.86,1]) {
      await dispatchTouch(cdp,'touchMove',touchesAt(fraction),acknowledgements);
      await observe('move-'+fraction);
      await delay(40);
    }
    // Ensure the gesture's render budget was actually exercised, even when the
    // software renderer completes fewer than one frame per second.
    await page.waitForFunction(()=>window.__mobilePerfQA.peek().drawnFrames>=1,null,{timeout:20000});
    during=await observe('rendered');
  } catch(error) {
    failure=error;
    during=await readState(page).catch(()=>null);
  } finally {
    try {await dispatchTouch(cdp,'touchEnd',[],acknowledgements);}
    catch(error) {failure??=error;}
    await delay(100);
    after=await readState(page);
    const raw=await page.evaluate(()=>window.__mobilePerfQA.end());
    phase=summarizePhase(raw);
    phase.dispatchAcknowledgementMs=stats(acknowledgements.map(sample=>sample.acknowledgementMs));
    phase.dispatches=acknowledgements;
    phase.before=before;phase.during=during;phase.after=after;phase.checkpoints=checkpoints;
    phase.cameraChange={position:distance(before.camera.position,after.camera.position),target:distance(before.camera.target,after.camera.target),distance:after.camera.distance-before.camera.distance};
    if(failure)phase.failure=String(failure);
    version.phases.push(phase);
  }
  if(failure)throw failure;
  check(version.name+' '+name+' moves camera',kind==='pan'?phase.cameraChange.target>.01:Math.abs(phase.cameraChange.distance)>.01,phase.cameraChange);
  check(version.name+' '+name+' handles native touch pointer events',(phase.inputEvents.pointermove?.count||0)>0,phase.inputEvents.pointermove);
  if(version.name==='v78') {
    check('v78 '+name+' selects gesture quality',during.quality==='gesture',during.quality);
    check('v78 '+name+' renders a bounded buffer',during.buffer.pixels<=Math.ceil(during.rect.width*during.rect.height*1.05*1.05),during.buffer);
  }
  console.log('MEASURE '+version.name+' '+name+' '+JSON.stringify({renderFrames:phase.renderedFrameIntervalsMs,input:phase.inputEvents.pointermove,pixels:phase.renderPixels,drawCalls:phase.drawCalls}));
}
async function runV78StationaryHold(page,cdp,version) {
  version.lifecycle??={};
  const before=await readState(page),first=point(before,'princess');
  const direction=first.x+50>before.rect.x+before.rect.width?-1:1;
  const second={x:first.x+34*direction,y:first.y+6},acknowledgements=[];
  await page.evaluate(()=>window.__mobilePerfQA.begin('stationary-two-fingers-on-character'));
  try {
    await dispatchTouch(cdp,'touchStart',[first,second],acknowledgements);
    await page.waitForFunction(()=>window.__mobilePerfQA.peek().activePointerIds.length===2,null,{timeout:20000});
    await delay(900);
    const held=await readState(page),input=await page.evaluate(()=>window.__mobilePerfQA.peek());
    const downIds=[...new Set(input.nativeInput.filter(event=>event.type==='pointerdown').map(event=>event.pointerId))];
    check('v78 stationary two-finger test has two real contacts',downIds.length===2&&input.activePointerIds.length===2,{downIds,active:input.activePointerIds});
    check('v78 two fingers on character do not open a long-press modal',held.dialogs.length===0&&held.pause.active!=='false',held);
    check('v78 stationary two-finger hold keeps gesture quality',held.quality==='gesture',held.quality);
    version.lifecycle.stationaryHold={before,held,input};
  } finally {
    await dispatchTouch(cdp,'touchEnd',[],acknowledgements);
    version.lifecycle.stationaryHoldMetrics=summarizePhase(await page.evaluate(()=>window.__mobilePerfQA.end()));
    version.lifecycle.stationaryHoldDispatches=acknowledgements;
  }
}
async function runV78PausedCamera(page,cdp,version) {
  await page.locator('.tree-stage').focus();
  const entry=await readState(page);
  // The published App intentionally uses the first blank/Space action after a
  // manual camera gesture to release its hold and resume roaming. Only the next
  // action toggles user pause. Exercise that supported entry contract explicitly.
  if(entry.manual==='true'&&entry.rotation==='playing') {
    await page.keyboard.press('Space');
    await page.waitForFunction(()=>document.documentElement.dataset.cameraManualHold==='false'&&document.querySelector('.tree-stage')?.dataset.rotation==='playing',null,{timeout:10000});
    const resumed=await readState(page);
    check('v78 first Space releases the existing manual camera hold',resumed.manual==='false'&&resumed.rotation==='playing',resumed);
    version.lifecycle.pauseEntry={before:entry,afterManualHoldRelease:resumed};
  }
  await page.keyboard.press('Space');
  await page.waitForFunction(()=>document.querySelector('.tree-stage')?.dataset.rotation==='paused',null,{timeout:10000});
  const before=await readState(page),first=point(before,'empty'),second={x:first.x+34,y:first.y+6},acknowledgements=[];
  await page.evaluate(()=>window.__mobilePerfQA.begin('user-paused-camera-pan'));
  try {
    const start=dispatchTouch(cdp,'touchStart',[first,second],acknowledgements);
    const move=dispatchTouch(cdp,'touchMove',[{x:first.x+24,y:first.y-16},{x:second.x+24,y:second.y-16}],acknowledgements);
    await Promise.all([start,move]);
    await waitForCameraDelta(page,before.camera.target,'target');
    const during=await readState(page);
    check('v78 user pause still permits native camera pan',distance(before.camera.target,during.camera.target)>.01,{before:before.camera,after:during.camera});
    check('v78 manual pan does not clear user pause',during.rotation==='paused'&&during.dialogs.length===0,during);
    version.lifecycle.pausedCamera={before,during};
  } finally {
    await dispatchTouch(cdp,'touchEnd',[],acknowledgements);
    version.lifecycle.pausedCameraMetrics=summarizePhase(await page.evaluate(()=>window.__mobilePerfQA.end()));
  }
  const settled=await readState(page);
  await delay(800);
  const after=await readState(page);
  check('v78 paused camera does not resume automatic motion',after.rotation==='paused'&&distance(settled.camera.position,after.camera.position)<.01,{before:settled.camera,after:after.camera,rotation:after.rotation});
  version.lifecycle.pausedCamera.after=after;
  await page.locator('.tree-stage').focus();
  await page.keyboard.press('Space');
  await page.waitForFunction(()=>document.querySelector('.tree-stage')?.dataset.rotation==='playing',null,{timeout:10000});
  const frozen=after.clock;
  await page.waitForFunction(clock=>Number(document.documentElement.dataset.characterClock)>clock,frozen,{timeout:20000});
  check('v78 Space resumes the scene after user pause',(await readState(page)).rotation==='playing');
}
async function runV78Lifecycle(page,cdp,version) {
  version.lifecycle??={};
  const initial=await readState(page);
  const first=point(initial,'empty'),second={x:first.x+34,y:first.y+6};
  const acknowledgements=[];
  await page.evaluate(()=>window.__mobilePerfQA.begin('partial-release'));
  try {
    await dispatchTouch(cdp,'touchStart',[first,second],acknowledgements);
    const remaining={x:first.x+8,y:first.y-3};
    await dispatchTouch(cdp,'touchMove',[remaining,{x:second.x+8,y:second.y-3}],acknowledgements);
    // Choose the native release operation proved by the same-runner blank-page
    // probe, then verify that the app actually receives pointerup as well.
    if(version.touchReleaseProtocol.mode==='active-list')await dispatchTouch(cdp,'touchMove',[remaining],acknowledgements);
    else await dispatchTouch(cdp,'touchEnd',[{x:second.x+8,y:second.y-3,id:2}],acknowledgements);
    await page.waitForFunction(()=>window.__mobilePerfQA.peek().eventCounts.pointerup>=1,null,{timeout:20000});
    const partialEvents=await page.evaluate(()=>window.__mobilePerfQA.peek().eventCounts);
    check('v78 partial release produces a native pointerup',(partialEvents.pointerup||0)>=1,partialEvents);
    const partial=await readState(page);
    check('v78 keeps gesture quality with one finger remaining',partial.quality==='gesture',partial.quality);
    // Wait longer than the quality settle delay. This catches a handler that
    // incorrectly schedules restoration when only the first finger is lifted.
    await delay(600);
    await dispatchTouch(cdp,'touchMove',[{x:remaining.x+18,y:remaining.y-9}],acknowledgements);
    await waitForCameraDelta(page,partial.camera.position,'position');
    const continued=await readState(page);
    check('v78 remaining finger continues at gesture quality',continued.quality==='gesture',continued.quality);
    check('v78 remaining finger continues to move the camera',distance(partial.camera.position,continued.camera.position)>.01,{before:partial.camera,after:continued.camera});
    version.lifecycle.partialRelease={partial,continued};
  } finally {
    await dispatchTouch(cdp,'touchEnd',[],acknowledgements);
    version.lifecycle.partialReleaseMetrics=summarizePhase(await page.evaluate(()=>window.__mobilePerfQA.end()));
  }
  await page.waitForFunction(()=>document.documentElement.dataset.sceneQuality==='idle',null,{timeout:20000});
  check('v78 restores idle only after every finger releases',(await readState(page)).quality==='idle');
  await page.evaluate(()=>window.__mobilePerfQA.begin('touch-cancel'));
  try {
    await dispatchTouch(cdp,'touchStart',[first,second],acknowledgements);
    await dispatchTouch(cdp,'touchMove',[{x:first.x+10,y:first.y},{x:second.x+10,y:second.y}],acknowledgements);
    await page.waitForFunction(()=>document.documentElement.dataset.sceneQuality==='gesture',null,{timeout:20000});
    check('v78 cancel test starts in gesture quality',(await readState(page)).quality==='gesture');
    await dispatchTouch(cdp,'touchCancel',[],acknowledgements);
    await page.waitForFunction(()=>window.__mobilePerfQA.peek().eventCounts.pointercancel>=1,null,{timeout:20000});
    const cancelEvents=await page.evaluate(()=>window.__mobilePerfQA.peek().eventCounts);
    check('v78 receives native pointercancel',(cancelEvents.pointercancel||0)>=1,cancelEvents);
  } finally {
    version.lifecycle.cancelMetrics=summarizePhase(await page.evaluate(()=>window.__mobilePerfQA.end()));
  }
  await page.waitForFunction(()=>document.documentElement.dataset.sceneQuality==='idle',null,{timeout:20000});
  check('v78 cancel restores idle quality',(await readState(page)).quality==='idle');
  version.lifecycle.dispatches=acknowledgements;
  await runV78PausedCamera(page,cdp,version);

  await page.setViewportSize({width:844,height:390});
  await page.waitForFunction(()=>{
    const canvas=document.querySelector('.tree-stage canvas'),data=document.documentElement.dataset;
    const rect=canvas?.getBoundingClientRect();
    return rect&&Math.abs(rect.width-844)<5&&canvas.width*canvas.height<=Number(data.scenePixelBudget)+4&&
      Math.abs(canvas.width/rect.width-Number(data.sceneDpr))<.015;
  },null,{timeout:20000});
  let samples=[],stable=false;
  for(let attempt=0;attempt<4;attempt++) {
    const before=await readState(page);
    await delay(1000);
    const after=await readState(page);
    samples=[before,after];
    if(before.buffer.width===after.buffer.width&&before.buffer.height===after.buffer.height&&before.pixelBudget===after.pixelBudget) {stable=true;break;}
  }
  version.lifecycle.landscape={viewport:{width:844,height:390},samples,stable};
  check('v78 landscape stays within declared pixel budget',samples.every(sample=>sample.buffer.pixels<=sample.pixelBudget+4),samples.map(sample=>({buffer:sample.buffer,budget:sample.pixelBudget,dpr:sample.dpr})));
  check('v78 landscape buffer settles without resize oscillation',stable,samples.map(sample=>sample.buffer));
}
async function runVersion(browser,name,base) {
  const version={name,base,phases:[],environment:[],errors:[],screenshots:[]};
  report.versions.push(version);
  const context=await browser.newContext({viewport:report.setup.viewport,deviceScaleFactor:report.setup.deviceScaleFactor,isMobile:true,hasTouch:true,serviceWorkers:'block'});
  await context.addInitScript(installInstrumentation);
  if(name==='v78')version.touchReleaseProtocol=await probePartialRelease(context);
  const page=await context.newPage();
  page.on('pageerror',error=>version.errors.push(error.message));
  page.on('console',message=>{
    if(message.type()==='error'&&/THREE|WebGL|Shader|V77|cats could not load/.test(message.text()))version.errors.push(message.text());
  });
  try {
    const response=await page.goto(new URL('/christmas/?rigqa=1&perfqa=1',base).href,{waitUntil:'domcontentloaded',timeout:90000});
    check(name+' HTTP',response.status()===200,response.status());
    await page.waitForFunction(()=>document.documentElement.dataset.princessV77==='ready'&&document.documentElement.dataset.princessHeldKitten==='ready'&&document.documentElement.dataset.groundCatCount==='3'&&document.documentElement.dataset.characterHitPoints,null,{timeout:120000});
    const state=await readState(page);
    check(name+' full mobile scene',!state.fallback&&state.arms==='true'&&state.eyelids==='true'&&state.rect.width>0,state);
    if(name==='v78')check('v78 active performance release',state.performance==='v78',state.performance);
    version.initial=state;
    version.environment=await page.evaluate(()=>window.__mobilePerfQA.environment());
    await page.evaluate(()=>window.__mobilePerfQA.begin('idle'));
    await delay(6000);
    await page.waitForFunction(()=>window.__mobilePerfQA.peek().drawnFrames>=2,null,{timeout:25000});
    version.phases.push(summarizePhase(await page.evaluate(()=>window.__mobilePerfQA.end())));
    const cdp=await context.newCDPSession(page);
    for(const [target,kind] of [['princess','pan'],['princess','pinch'],['empty','pan'],['empty','pinch']]) {
      await runGesture(page,cdp,version,target,kind);
      if(name==='v78'&&target==='princess'&&kind==='pan')await runV78StationaryHold(page,cdp,version);
    }
    if(name==='v78') {
      await page.waitForFunction(()=>document.documentElement.dataset.sceneQuality==='idle',null,{timeout:20000});
      check('v78 returns to resting quality',(await readState(page)).quality==='idle');
    }
    version.final=await readState(page);
    try {
      const file=name+'-after-native-touch.png';
      await page.screenshot({path:path.join(out,file),timeout:20000});
      version.screenshots.push(file);
    } catch(error) {version.screenshotWarning=String(error);}
    if(name==='v78')await runV78Lifecycle(page,cdp,version);
    check(name+' no scene JavaScript errors',version.errors.length===0,version.errors);
  } catch(error) {
    report.errors.push({version:name,message:String(error),state:await readState(page).catch(()=>null)});
  } finally {await context.close();}
}
function compare() {
  const old=report.versions.find(version=>version.name==='v77');
  const next=report.versions.find(version=>version.name==='v78');
  const ratio=(before,after)=>Number.isFinite(before)&&before>0&&Number.isFinite(after)?after/before:null;
  const aggregate=version=>{
    const gestures=version.phases.filter(phase=>phase.name!=='idle');
    const eventCount=gestures.reduce((sum,phase)=>sum+(phase.inputEvents.pointermove?.count||0),0);
    const cpuMs=gestures.reduce((sum,phase)=>sum+(phase.inputEvents.pointermove?.totalCpuMs||0),0);
    const rawCount=gestures.reduce((sum,phase)=>sum+(phase.inputEvents.pointerrawupdate?.count||0),0);
    const rawCpuMs=gestures.reduce((sum,phase)=>sum+(phase.inputEvents.pointerrawupdate?.totalCpuMs||0),0);
    return {pointermoveEvents:eventCount,totalPointermoveCpuMs:cpuMs,meanPointermoveCpuMs:eventCount?cpuMs/eventCount:null,
      pointerrawupdateEvents:rawCount,totalRawPointerCpuMs:rawCpuMs,totalMovementCpuMs:cpuMs+rawCpuMs,
      meanMovementCpuMsPerPointermoveEvent:eventCount?(cpuMs+rawCpuMs)/eventCount:null};
  };
  if(!old||!next)return;
  const oldInputs=aggregate(old),newInputs=aggregate(next);
  report.comparison={
    input:{v77:oldInputs,v78:newInputs,ratio:ratio(oldInputs.meanPointermoveCpuMs,newInputs.meanPointermoveCpuMs),
      combinedMovementRatio:ratio(oldInputs.meanMovementCpuMsPerPointermoveEvent,newInputs.meanMovementCpuMsPerPointermoveEvent)},
    phases:old.phases.map(before=>{
      const after=next.phases.find(phase=>phase.name===before.name);
      if(!after)return {name:before.name,incomplete:true};
      return {name:before.name,
        renderPixelRatio:ratio(before.renderPixels.p50,after.renderPixels.p50),
        pointermoveCpuRatio:ratio(before.inputEvents.pointermove?.mean,after.inputEvents.pointermove?.mean),
        renderedFrameIntervalRatio:ratio(before.renderedFrameIntervalsMs.p50,after.renderedFrameIntervalsMs.p50),
        rafCallbackIntervalRatio:ratio(before.frameIntervalsMs.p50,after.frameIntervalsMs.p50),
        drawCallRatio:ratio(before.drawCalls.p50,after.drawCalls.p50),
        triangleRatio:ratio(before.triangles.p50,after.triangles.p50)};
    })
  };
}
async function main() {
  // Use a fresh GPU/browser process and temporary profile for each version so
  // the candidate does not inherit the baseline's compiled shader caches.
  for(const [name,base] of [['v77',baseline],['v78',candidate]]) {
    const browser=await chromium.launch({headless:true,executablePath:process.env.V78_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
    report.browserVersion=browser.version();
    try {await runVersion(browser,name,base);}
    finally {await browser.close();}
  }
  compare();
}
main().catch(error=>report.errors.push({version:'fatal',message:String(error)})).finally(()=>{
  writeFileSync(path.join(out,'performance-report.json'),JSON.stringify(report,null,2)+'\n');
  console.log('COMPARISON '+JSON.stringify(report.comparison,null,2));
  if(report.errors.length||report.checks.some(item=>!item.pass))process.exitCode=1;
});
