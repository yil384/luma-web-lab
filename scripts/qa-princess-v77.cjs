/* CI-only real-browser checks. Run against the staged Pages tree, never a Vite rebuild. */
const {chromium} = require('playwright');
const {mkdirSync, writeFileSync} = require('node:fs');
const path = require('node:path');
const base = process.env.V77_BASE_URL;
if (!base) throw new Error('Set V77_BASE_URL to the staged Pages URL.');
const out = process.env.V77_QA_OUTPUT || path.resolve('v77-browser-evidence');
mkdirSync(out,{recursive:true});
const report = {base,checks:[],errors:[],requests:[],screenshots:[],limits:['Software-rendered Chromium; not a physical phone or Safari performance test.']};
function check(name, pass, detail) {
  report.checks.push({name,pass:!!pass,detail});
  console.log(`${pass?'PASS':'FAIL'} ${name} ${JSON.stringify(detail??null)}`);
  if (!pass) throw new Error(name);
}
const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));
const readState = page => page.evaluate(()=>({
  version:document.documentElement.dataset.princessVersion,
  model:document.documentElement.dataset.princessV77,
  held:document.documentElement.dataset.princessHeldKitten,
  arms:document.documentElement.dataset.princessArmRig,
  eyelids:document.documentElement.dataset.princessEyelidRig,
  ground:document.documentElement.dataset.groundCatCount,
  runtime:document.documentElement.dataset.characterRuntime,
  clock:Number(document.documentElement.dataset.characterClock),
  pose:JSON.parse(document.documentElement.dataset.princessV77Pose||'null'),
  actions:JSON.parse(document.documentElement.dataset.characterActions||'{}'),
  points:JSON.parse(document.documentElement.dataset.characterHitPoints||'{}'),
  lastTap:document.documentElement.dataset.characterLastTap,
  canvas:document.querySelectorAll('.tree-stage canvas').length,
  fallback:document.body.innerText.includes('当前浏览器无法显示'),
  rotation:document.querySelector('.tree-stage')?.dataset.rotation
}));
async function tapActor(page, actor, mobile) {
  for (const [dx,dy] of [[0,0],[0,-5],[5,0],[-5,0],[0,5]]) {
    const p = (await readState(page)).points[actor];
    if (!p || !Number.isFinite(p.x+p.y)) throw new Error('Missing projected actor '+actor);
    if (mobile) await page.touchscreen.tap(p.x+dx,p.y+dy);
    else await page.mouse.click(p.x+dx,p.y+dy);
    await delay(150);
    if ((await readState(page)).lastTap === actor) return;
  }
  throw new Error('Could not tap the rendered '+actor);
}
async function capture(page, name) {
  try {
    await page.screenshot({path:path.join(out,name+'.png'),timeout:20000,animations:'disabled'});
    report.screenshots.push({name,captured:true});
  } catch (error) {
    report.screenshots.push({name,captured:false,detail:String(error)});
  }
}
async function checkV78PhotoInput(page,context,mode) {
  if(!await page.evaluate(()=>document.documentElement.dataset.scenePerformance==='v78'))return;
  await page.waitForFunction(()=>typeof window.__lumaPhotoTargetsQA==='function'&&window.__lumaPhotoTargetsQA().length>0,null,{timeout:45000});
  const dialog=page.locator('dialog.photo-dialog[open]');
  let selected=null;
  // Re-read each projection immediately before input. A previous missed target
  // may have moved as the real default camera animation advanced.
  for(let attempt=0;attempt<3;attempt++) {
    const targets=await page.evaluate(()=>window.__lumaPhotoTargetsQA());
    const target=targets[Math.min(attempt,targets.length-1)];
    if(!target)continue;
    if(mode.mobile)await page.touchscreen.tap(target.x,target.y);
    else await page.mouse.click(target.x,target.y);
    try {
      await dialog.waitFor({timeout:6000});
      selected=target;
      break;
    } catch { /* Try another genuinely selectable face, never invoke app callbacks. */ }
  }
  check(mode.name+' V78 real photo click opens album',selected!==null,selected);
  // The current production Gallery-v10 opens the book first. PhotoViewer is
  // mounted only after a second click on a print inside that book.
  await page.locator('dialog.photo-dialog[open] .memory-album-book').waitFor({timeout:20000});
  await page.waitForFunction(()=>[...document.querySelectorAll('dialog.photo-dialog[open] .memory-album-spread .memory-album-print img')]
    .some(img=>img.complete&&img.naturalWidth>0),null,{timeout:20000});
  check(mode.name+' V78 opened album displays a loaded photo',true);
  await page.locator('dialog.photo-dialog[open] .dialog-close').click({timeout:15000});
  await dialog.waitFor({state:'detached',timeout:15000});
  check(mode.name+' V78 photo album closes back to scene',await dialog.count()===0);
  await page.waitForFunction(()=>window.__lumaPhotoTargetsQA().length>0,null,{timeout:30000});
  const target=await page.evaluate(()=>window.__lumaPhotoTargetsQA()[0]);
  const cameraBefore=await page.evaluate(()=>document.documentElement.dataset.cameraPosition);
  const dx=target.x>mode.width/2?-38:38,dy=target.y>mode.height/2?-24:24;
  if(mode.mobile) {
    const cdp=await context.newCDPSession(page);
    const point=(x,y)=>({x,y,id:1,radiusX:2,radiusY:2,force:1});
    const start=cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(target.x,target.y)]});
    try {
      // The first move already exceeds the controller's drag threshold, before
      // a slow GPU acknowledgement can turn a queued drag into a long press.
      const moving=cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(target.x+dx*.7,target.y+dy*.7)]});
      await Promise.all([start,moving]);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(target.x+dx,target.y+dy)]});
      await page.waitForFunction(before=>document.documentElement.dataset.cameraPosition&&document.documentElement.dataset.cameraPosition!==before,cameraBefore,{timeout:20000});
    } finally {
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    }
    await cdp.detach();
  } else {
    const cdp=await context.newCDPSession(page);
    const evidence={mode:mode.name,target,cameraBefore,events:[]};
    (report.photoDrags??=[]).push(evidence);
    await page.evaluate(()=>{
      const events=[],start=performance.now();
      const listener=event=>events.push({type:event.type,pointerId:event.pointerId,pointerType:event.pointerType,
        buttons:event.buttons,button:event.button,x:event.clientX,y:event.clientY,receivedMs:performance.now()-start,
        eventTime: event.timeStamp,isTrusted:event.isTrusted,target:event.target?.tagName,
        inScene:!!event.target?.closest?.('.tree-stage')});
      for(const type of ['pointerdown','pointermove','pointerup','pointercancel'])window.addEventListener(type,listener,{capture:true,passive:true});
      window.__photoDragReceipt={events,stop:()=>{for(const type of ['pointerdown','pointermove','pointerup','pointercancel'])window.removeEventListener(type,listener,true);}};
    });
    await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:target.x,y:target.y,button:'none',buttons:0,pointerType:'mouse'});
    const pressed=cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x:target.x,y:target.y,button:'left',buttons:1,clickCount:1,pointerType:'mouse'});
    try {
      // Use one native CDP session with explicit held-button state. Independent
      // Playwright mouse calls can otherwise be acknowledged between software
      // rendered frames and leave the intended drag looking like a long press.
      const moving=cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:target.x+dx,y:target.y+dy,button:'none',buttons:1,pointerType:'mouse'});
      await Promise.all([pressed,moving]);
      await page.waitForFunction(before=>{
        const current=(document.documentElement.dataset.cameraPosition||'').split(',').map(Number);
        const prior=before.split(',').map(Number);
        return document.documentElement.dataset.cameraManualHold==='true'&&current.length===3&&Math.hypot(...current.map((v,i)=>v-prior[i]))>.5;
      },cameraBefore,{timeout:20000});
    } catch(error) {
      evidence.failure=String(error);
      throw error;
    } finally {
      await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:target.x+dx,y:target.y+dy,button:'left',buttons:0,clickCount:1,pointerType:'mouse'});
      await page.waitForFunction(()=>window.__photoDragReceipt.events.some(event=>event.type==='pointerup'),null,{timeout:20000}).catch(error=>{evidence.receiptFailure=String(error);});
      evidence.events=await page.evaluate(()=>{window.__photoDragReceipt.stop();return window.__photoDragReceipt.events;});
      evidence.after=await page.evaluate(()=>({camera:document.documentElement.dataset.cameraPosition,manual:document.documentElement.dataset.cameraManualHold,
        dialogs:[...document.querySelectorAll('dialog[open]')].map(dialog=>dialog.className)}));
      await cdp.detach();
    }
    const down=evidence.events.find(event=>event.type==='pointerdown');
    const moved=evidence.events.find(event=>event.type==='pointermove'&&(event.buttons&1)&&down&&Math.hypot(event.x-down.x,event.y-down.y)>8);
    check('desktop V78 photo drag receives real held-button input',down?.buttons===1&&!!moved&&evidence.events.some(event=>event.type==='pointerup'&&event.buttons===0)&&evidence.events.every(event=>event.isTrusted),evidence);
  }
  await delay(800);
  const cameraAfter=await page.evaluate(()=>document.documentElement.dataset.cameraPosition);
  check(mode.name+' V78 drag starting on photo moves camera',cameraBefore!==cameraAfter,{target,before:cameraBefore,after:cameraAfter});
  check(mode.name+' V78 photo drag does not open album',await dialog.count()===0);
}
async function main() {
  const browser=await chromium.launch({headless:true,executablePath:process.env.V78_CHROMIUM_EXECUTABLE_PATH||undefined,args:[
    '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
    '--enable-unsafe-swiftshader','--disable-dev-shm-usage'
  ]});
  try {
    for (const mode of [
      {name:'desktop',width:1280,height:800,mobile:false,route:'/'},
      {name:'mobile',width:390,height:844,mobile:true,route:'/christmas/'}
    ]) {
      const context=await browser.newContext({viewport:{width:mode.width,height:mode.height},
        deviceScaleFactor:1,isMobile:mode.mobile,hasTouch:mode.mobile,serviceWorkers:'block'});
      const page=await context.newPage();
      page.on('pageerror',e=>report.errors.push({mode:mode.name,message:e.message}));
      page.on('console',message=>{
        if (message.type()==='error' && /THREE|WebGL|Shader|V77|cats could not load/.test(message.text())) {
          report.errors.push({mode:mode.name,message:message.text()});
        }
      });
      page.on('response',r=>{
        if (/luma-princess-rigged-v77|chonky-cat-trio|TreeScene-PrincessRig-V77/.test(r.url())) {
          report.requests.push({mode:mode.name,url:r.url(),status:r.status()});
        }
      });
      try {
        const response=await page.goto(new URL(mode.route+'?rigqa=1',base).href,{waitUntil:'domcontentloaded',timeout:90000});
        check(mode.name+' HTTP',response.status()===200,response.status());
        await page.waitForFunction(()=>document.documentElement.dataset.princessV77==='ready' &&
          document.documentElement.dataset.princessV77Pose &&
          document.documentElement.dataset.groundCatCount==='3',null,{timeout:120000});
        let state=await readState(page);
        check(mode.name+' actual V77 WebGL scene',state.canvas===1&&!state.fallback&&state.model==='ready'&&
          state.held==='ready'&&state.arms==='true'&&state.eyelids==='true'&&state.runtime==='v77',state);
        const lidY=state.pose.upperLidY;
        // SwiftShader advances capped simulation time slowly. Trigger a real
        // cuddle blink with input, instead of assuming 50 wall seconds reaches
        // the next four-second natural blink on a sub-one-FPS software renderer.
        await tapActor(page,'held-cat',mode.mobile);
        check(mode.name+' held kitten owns its click', (await readState(page)).lastTap==='held-cat');
        await page.waitForFunction(y=>{
          const p=JSON.parse(document.documentElement.dataset.princessV77Pose||'null');
          return p&&Math.abs(p.upperLidY-y)>0.0001;
        },lidY,{timeout:90000});
        check(mode.name+' real eyelid bones animate',true,{from:lidY,to:(await readState(page)).pose.upperLidY});
        await tapActor(page,'princess',mode.mobile);
        await page.waitForFunction(()=>{
          const p=JSON.parse(document.documentElement.dataset.princessV77Pose||'null');
          return p&&p.leftArm.slice(0,3).some(v=>Math.abs(v)>0.002);
        },null,{timeout:90000});
        check(mode.name+' tap drives actual arm bones',true,(await readState(page)).pose);
        await capture(page,mode.name+'-v77-scene');
        await page.locator('.greeting-gate').click({force:true,timeout:15000});
        await page.locator('dialog.film-dialog[open]').waitFor({timeout:20000});
        await page.waitForFunction(()=>document.documentElement.dataset.characterPaused==='true',null,{timeout:10000});
        await delay(350);
        const frozen=(await readState(page)).clock;
        await delay(900);
        check(mode.name+' film pauses interaction clock',(await readState(page)).clock===frozen,{clock:frozen});
        await page.locator('dialog.film-dialog .dialog-close').click({force:true,timeout:15000});
        await page.waitForFunction(c=>Number(document.documentElement.dataset.characterClock)>c,frozen,{timeout:20000});
        check(mode.name+' returns from film',!(await page.locator('dialog.film-dialog[open]').count()));
        await checkV78PhotoInput(page,context,mode);
        await page.emulateMedia({reducedMotion:'reduce'});
        await page.waitForFunction(()=>{
          const p=JSON.parse(document.documentElement.dataset.princessV77Pose||'null');
          return document.documentElement.dataset.characterReducedMotion==='true'&&p&&p.leftArm.slice(0,3).every(v=>Math.abs(v)<1e-7)&&p.rightArm.slice(0,3).every(v=>Math.abs(v)<1e-7);
        },null,{timeout:15000});
        check(mode.name+' reduced motion restores arm pose',true,(await readState(page)).pose);
        check(mode.name+' no JavaScript errors',report.errors.filter(e=>e.mode===mode.name).length===0,report.errors);
      } catch(error) {
        report.checks.push({name:mode.name+' complete scene flow',pass:false,detail:String(error),state:await readState(page).catch(()=>null)});
        await capture(page,mode.name+'-failure');
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
  for(const route of ['/','/christmas/','/letter/','/album-preview/']) {
    const response=await fetch(new URL(route,base));
    check('route preserved '+route,response.status===200,response.status);
  }
}
main().catch(error=>report.errors.push({mode:'fatal',message:String(error)})).finally(()=>{
  writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
  if(report.errors.length||report.checks.some(c=>!c.pass))process.exitCode=1;
});
