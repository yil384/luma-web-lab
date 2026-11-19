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
  const inputTypes = new Set(['pointerdown','pointermove','pointerup','pointercancel','pointerover','pointerout','touchstart','touchmove','touchend','touchcancel']);
  const nativeAdd = EventTarget.prototype.addEventListener;
  const nativeRemove = EventTarget.prototype.removeEventListener;
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
          sample={type:event.type,pointerType:event.pointerType||'',cpuMs:0,handlers:0};
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
      active={name,start:performance.now(),lastFrame:null,frames:[],events:[],eventMap:new WeakMap()};
    },
    peek() {
      const eventCounts={};
      for(const event of active?.events||[])eventCounts[event.type]=(eventCounts[event.type]||0)+1;
      return {frames:active?.frames.length||0,drawnFrames:active?.frames.filter(f=>f.drawCalls>0).length||0,eventCounts};
    },
    end() {
      if (!active) throw new Error('No performance phase running');
      const phase=active;active=null;
      const end=performance.now();
      return {name:phase.name,durationMs:end-phase.start,frames:phase.frames,events:phase.events,
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
    buffer:canvas?{width:canvas.width,height:canvas.height,pixels:canvas.width*canvas.height}:null,
    rect:rect?{x:rect.x,y:rect.y,width:rect.width,height:rect.height}:null,
    fallback:document.body.innerText.includes('当前浏览器无法显示')
  };
});
function summarizePhase(raw) {
  const rendered=raw.frames.filter(frame=>frame.drawCalls>0);
  const intervals=raw.frames.map(frame=>frame.intervalMs).filter(n=>Number.isFinite(n)&&n>0);
  const events={};
  for(const type of new Set(raw.events.map(event=>event.type))) {
    const samples=raw.events.filter(event=>event.type===type);
    events[type]={...stats(samples.map(event=>event.cpuMs)),totalCpuMs:samples.reduce((sum,event)=>sum+event.cpuMs,0),handlerCalls:samples.reduce((sum,event)=>sum+event.handlers,0)};
  }
  return {
    name:raw.name,durationMs:raw.durationMs,
    frameIntervalsMs:stats(intervals),measuredFps:intervals.length?1000/(intervals.reduce((a,b)=>a+b,0)/intervals.length):null,
    renderedFrames:rendered.length,drawCalls:stats(rendered.map(frame=>frame.drawCalls)),triangles:stats(rendered.map(frame=>frame.triangles)),
    renderPixels:stats(rendered.map(frame=>frame.width*frame.height)),qualities:[...new Set(raw.frames.map(frame=>frame.quality))],
    inputEvents:events,longTasks:{...stats(raw.longTasks.map(task=>task.duration)),totalMs:raw.longTasks.reduce((sum,task)=>sum+task.duration,0)}
  };
}
function distance(a,b) {return Math.hypot(...a.map((v,i)=>v-b[i]));}
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
  await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map((p,id)=>({...p,id:id+1,radiusX:2,radiusY:2,force:1}))});
  samples.push({type,acknowledgementMs:performance.now()-start});
}
async function runGesture(page,cdp,version,target,kind) {
  const name=target+'-'+kind;
  const before=await readState(page);
  const first=point(before,target);
  const direction=first.x+72>before.rect.x+before.rect.width?-1:1;
  const second={x:first.x+34*direction,y:first.y+6};
  const acknowledgements=[];
  await page.evaluate(name=>window.__mobilePerfQA.begin(name),name);
  let during;
  try {
    await dispatchTouch(cdp,'touchStart',[first,second],acknowledgements);
    for(let step=1;step<=4;step++) {
      const fraction=step/4;
      const touches=kind==='pan'
        ?[{x:first.x+26*direction*fraction,y:first.y-18*fraction},{x:second.x+26*direction*fraction,y:second.y-18*fraction}]
        :[{x:first.x-16*direction*fraction,y:first.y-3*fraction},{x:second.x+16*direction*fraction,y:second.y+3*fraction}];
      await dispatchTouch(cdp,'touchMove',touches,acknowledgements);
      await delay(40);
    }
    // Ensure the gesture's render budget was actually exercised, even when the
    // software renderer completes fewer than one frame per second.
    await page.waitForFunction(()=>window.__mobilePerfQA.peek().drawnFrames>=1,null,{timeout:20000});
    during=await readState(page);
  } finally {
    await dispatchTouch(cdp,'touchEnd',[],acknowledgements);
  }
  await delay(100);
  const after=await readState(page);
  const raw=await page.evaluate(()=>window.__mobilePerfQA.end());
  const phase=summarizePhase(raw);
  phase.dispatchAcknowledgementMs=stats(acknowledgements.map(sample=>sample.acknowledgementMs));
  phase.dispatches=acknowledgements;
  phase.before=before;phase.during=during;phase.after=after;
  phase.cameraChange={position:distance(before.camera.position,after.camera.position),target:distance(before.camera.target,after.camera.target),distance:after.camera.distance-before.camera.distance};
  version.phases.push(phase);
  check(version.name+' '+name+' moves camera',kind==='pan'?phase.cameraChange.target>.01:Math.abs(phase.cameraChange.distance)>.01,phase.cameraChange);
  check(version.name+' '+name+' handles native touch pointer events',(phase.inputEvents.pointermove?.count||0)>0,phase.inputEvents.pointermove);
  if(version.name==='v78') {
    check('v78 '+name+' selects gesture quality',during.quality==='gesture',during.quality);
    check('v78 '+name+' renders a bounded buffer',during.buffer.pixels<=Math.ceil(during.rect.width*during.rect.height*1.05*1.05),during.buffer);
  }
  console.log('MEASURE '+version.name+' '+name+' '+JSON.stringify({frames:phase.frameIntervalsMs,input:phase.inputEvents.pointermove,pixels:phase.renderPixels,drawCalls:phase.drawCalls}));
}
async function runV78Lifecycle(page,cdp,version) {
  version.lifecycle={};
  const initial=await readState(page);
  const first=point(initial,'empty'),second={x:first.x+34,y:first.y+6};
  const acknowledgements=[];
  await page.evaluate(()=>window.__mobilePerfQA.begin('partial-release'));
  try {
    await dispatchTouch(cdp,'touchStart',[first,second],acknowledgements);
    const remaining={x:first.x+8,y:first.y-3};
    await dispatchTouch(cdp,'touchMove',[remaining,{x:second.x+8,y:second.y-3}],acknowledgements);
    // CDP touchEnd and touchCancel require an empty list. A touchMove with the
    // remaining active id causes Chromium to release the omitted id. Verify
    // the resulting native pointerup rather than assuming the transition.
    await dispatchTouch(cdp,'touchMove',[remaining],acknowledgements);
    const partialEvents=await page.evaluate(()=>window.__mobilePerfQA.peek().eventCounts);
    check('v78 partial release produces a native pointerup',(partialEvents.pointerup||0)>=1,partialEvents);
    const partial=await readState(page);
    check('v78 keeps gesture quality with one finger remaining',partial.quality==='gesture',partial.quality);
    // Wait longer than the quality settle delay. This catches a handler that
    // incorrectly schedules restoration when only the first finger is lifted.
    await delay(600);
    await dispatchTouch(cdp,'touchMove',[{x:remaining.x+18,y:remaining.y-9}],acknowledgements);
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
    check('v78 cancel test starts in gesture quality',(await readState(page)).quality==='gesture');
    await dispatchTouch(cdp,'touchCancel',[],acknowledgements);
    const cancelEvents=await page.evaluate(()=>window.__mobilePerfQA.peek().eventCounts);
    check('v78 receives native pointercancel',(cancelEvents.pointercancel||0)>=1,cancelEvents);
  } finally {
    version.lifecycle.cancelMetrics=summarizePhase(await page.evaluate(()=>window.__mobilePerfQA.end()));
  }
  await page.waitForFunction(()=>document.documentElement.dataset.sceneQuality==='idle',null,{timeout:20000});
  check('v78 cancel restores idle quality',(await readState(page)).quality==='idle');
  version.lifecycle.dispatches=acknowledgements;

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
    return {pointermoveEvents:eventCount,totalPointermoveCpuMs:cpuMs,meanPointermoveCpuMs:eventCount?cpuMs/eventCount:null};
  };
  if(!old||!next)return;
  const oldInputs=aggregate(old),newInputs=aggregate(next);
  report.comparison={
    input:{v77:oldInputs,v78:newInputs,ratio:ratio(oldInputs.meanPointermoveCpuMs,newInputs.meanPointermoveCpuMs)},
    phases:old.phases.map(before=>{
      const after=next.phases.find(phase=>phase.name===before.name);
      if(!after)return {name:before.name,incomplete:true};
      return {name:before.name,
        renderPixelRatio:ratio(before.renderPixels.p50,after.renderPixels.p50),
        pointermoveCpuRatio:ratio(before.inputEvents.pointermove?.mean,after.inputEvents.pointermove?.mean),
        frameIntervalRatio:ratio(before.frameIntervalsMs.p50,after.frameIntervalsMs.p50),
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
