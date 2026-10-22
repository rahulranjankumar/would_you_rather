/* FUN FRIDAY ARENA — shared client runtime v24 */
(function (global) {
  'use strict';
  var $=function(s,r){return (r||document).querySelector(s);};
  var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));};
  function el(tag,cls,txt){var n=document.createElement(tag);if(cls)n.className=cls;if(txt!=null)n.textContent=txt;return n;}
  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
  var store={get:function(k){try{return localStorage.getItem(k);}catch(e){return null;}},
             set:function(k,v){try{localStorage.setItem(k,v);}catch(e){}},
             del:function(k){try{localStorage.removeItem(k);}catch(e){}}};
  var tn=null,tt=null;
  function toast(msg,ms){if(!tn){tn=el('div','glass toast f-mono');document.body.appendChild(tn);}
    tn.textContent=msg;tn.classList.add('show');clearTimeout(tt);
    tt=setTimeout(function(){tn.classList.remove('show');},ms||2600);}
  function post(path,body){return fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})})
    .then(function(r){if(r.status===204)return{};return r.json().catch(function(){return{};}).then(function(j){
      if(!r.ok){var e=new Error(j.error||j.e||('HTTP '+r.status));e.status=r.status;e.code=j.code;throw e;}return j;});});}
  function getJSON(path){return fetch(path).then(function(r){return r.json().catch(function(){return{};}).then(function(j){
      if(!r.ok){var e=new Error(j.error||('HTTP '+r.status));e.status=r.status;throw e;}return j;});});}
  function connect(opts){
    var h=opts.on||{},src=null,closed=false,retry=0;
    function open(){
      if(closed)return;
      var q='/api/events?room='+encodeURIComponent(opts.room)+'&role='+encodeURIComponent(opts.role||'player');
      if(opts.playerId)q+='&playerId='+encodeURIComponent(opts.playerId);
      src=new EventSource(q);
      src.onopen=function(){retry=0;if(h.__open)h.__open();};
      Object.keys(h).forEach(function(ev){
        if(ev.indexOf('__')===0)return;
        src.addEventListener(ev,function(e){var d={};try{d=JSON.parse(e.data);}catch(err){return;}h[ev](d);});});
      src.onerror=function(){if(closed)return;try{src.close();}catch(e){}
        if(h.__drop)h.__drop();retry=Math.min(retry+1,6);setTimeout(open,600*retry);};}
    open();
    return {close:function(){closed=true;if(src)try{src.close();}catch(e){}},
      /* drop the live connection exactly like a network blip would (used by QA + visibility recovery) */
      kick:function(ms){if(closed)return;try{src.close();}catch(e){}if(h.__drop)h.__drop();setTimeout(open,ms||600);}};}
  function fmtMs(ms){return ms==null?'--':(ms/1000).toFixed(2)+'s';}
  function fmtClock(ms){var s=Math.max(0,Math.ceil(ms/1000));return s<10?'0'+s:String(s);}
  function makeTimer(barEl,readEl,onPhase){
    var raf=null,cfg=null,phase=null;
    function stop(){if(raf)cancelAnimationFrame(raf);raf=null;}
    function start(c){stop();cfg=c;phase=null;loop();}
    function loop(){
      if(!cfg)return;
      var now=Date.now(),p,frac,rem;
      if(now<cfg.answerAt){p='read';rem=cfg.answerAt-now;frac=cfg.readMs?rem/cfg.readMs:0;}
      else{p='answer';rem=cfg.answerAt+cfg.durationMs-now;frac=Math.max(0,rem/cfg.durationMs);}
      if(barEl){barEl.style.transform='scaleX('+Math.max(0,Math.min(1,frac))+')';
        var w=barEl.parentElement;
        if(w){w.classList.toggle('is-read',p==='read');w.classList.toggle('is-low',p==='answer'&&frac<.25);}}
      if(readEl)readEl.textContent=fmtClock(rem);
      if(p!==phase){phase=p;if(onPhase)onPhase(p);}
      if(rem<=0&&p==='answer'){stop();return;}
      raf=requestAnimationFrame(loop);}
    return {start:start,stop:stop,phase:function(){return phase;}};}
  function reveal(){
    var n=$$('.reveal');if(!n.length)return;
    if(!('IntersectionObserver' in window)){n.forEach(function(x){x.classList.add('in');});return;}
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{threshold:.12});
    n.forEach(function(x){io.observe(x);});}
  var seq=0;
  function brandBar(href){
    var id='bmg'+(++seq);
    var inner='<span class="acn-word">accenture</span>'+
      '<svg class="acn-chev" viewBox="0 0 48 48" aria-hidden="true">'+
        '<defs><linearGradient id="'+id+'" x1="0" y1="0" x2="1" y2="1">'+
        '<stop offset="0%" stop-color="#C77DFF"/><stop offset="60%" stop-color="#A100FF"/><stop offset="100%" stop-color="#00AEEF"/>'+
        '</linearGradient></defs>'+
        '<path class="chev-base" d="M14 10 L34 24 L14 38" fill="none" stroke="url(#'+id+')" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>'+
        '<path class="chev-run" d="M14 10 L34 24 L14 38" fill="none" stroke="#fff" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>'+
      '</svg><span class="brand-sep"></span>'+
      '<img class="currys-dot" src="/assets/branding/currys.svg" alt="Currys" width="256" height="256">';
    return href?'<a class="brandbar" href="'+href+'" aria-label="Fun Friday Arena">'+inner+'</a>':'<div class="brandbar">'+inner+'</div>';}
  function backdrop(stars){
    return '<div class="acn-wash"></div><div class="space-bg">'+(stars===false?'':'<div class="stars"></div>')+'</div>'+
           (stars===false?'':'<div class="texture"></div>');}
  function videos(){
    var v=$$('video[data-src]');
    if(!v.length||document.body.classList.contains('lite'))return;
    function hy(x){if(x.dataset.on)return;x.dataset.on='1';x.src=x.dataset.src;}
    function pl(x){var p=x.play();if(p&&p.catch)p.catch(function(){});}
    if(!('IntersectionObserver' in window)){v.forEach(function(x){hy(x);pl(x);});return;}
    var io=new IntersectionObserver(function(es){es.forEach(function(e){var x=e.target;
      if(e.isIntersecting){hy(x);pl(x);}else{try{x.pause();}catch(err){}}});},{rootMargin:'300px 0px',threshold:.01});
    v.forEach(function(x){io.observe(x);});
    document.addEventListener('visibilitychange',function(){if(document.hidden)v.forEach(function(x){try{x.pause();}catch(e){}});});}
  function liteToggle(){
    var K='ffa-lite',saved=store.get(K),c=navigator.connection;
    var auto=!!(c&&(c.saveData||['slow-2g','2g'].indexOf(c.effectiveType)>=0));
    var on=saved===null?auto:saved==='1';
    if(on)document.body.classList.add('lite');
    var b=$('[data-lite]');if(!b)return;
    b.textContent=on?'Lite mode: on':'Lite mode: off';
    b.addEventListener('click',function(){store.set(K,document.body.classList.contains('lite')?'0':'1');location.reload();});}
  function intro(o){if(global.FFAIntro)global.FFAIntro.mount(o||{});}
  function qrURL(d,s){s=s||240;
    return 'https://api.qrserver.com/v1/create-qr-code/?size='+s+'x'+s+
      '&margin=1&format=png&color=07031C&bgcolor=FFFFFF&data='+encodeURIComponent(d);}
  function download(name,content,mime){
    var b=new Blob([content],{type:mime||'text/plain;charset=utf-8'});
    var u=URL.createObjectURL(b),a=document.createElement('a');
    a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(u);},2000);}
  function keepWarm(){setInterval(function(){fetch('/healthz',{cache:'no-store'}).catch(function(){});},4*60*1000);}
  /* typewriter — adapted from the Mainframe hero spec */
  function typewriter(node,text,speed,startDelay,onDone){
    var i=0,timer=null;
    node.textContent='';
    var cur=el('span','tw-cursor');
    setTimeout(function(){
      node.appendChild(cur);
      timer=setInterval(function(){
        if(i>=text.length){clearInterval(timer);if(cur.parentNode)cur.remove();if(onDone)onDone();return;}
        cur.insertAdjacentText('beforebegin',text.charAt(i));i++;
      },speed||38);
    },startDelay||400);
    return {stop:function(){clearInterval(timer);}};}
  global.FFA={$:$,$$:$$,el:el,esc:esc,store:store,toast:toast,post:post,getJSON:getJSON,connect:connect,
    fmtMs:fmtMs,fmtClock:fmtClock,makeTimer:makeTimer,reveal:reveal,brandBar:brandBar,backdrop:backdrop,
    videos:videos,liteToggle:liteToggle,intro:intro,keepWarm:keepWarm,qrURL:qrURL,download:download,
    typewriter:typewriter};
})(window);
