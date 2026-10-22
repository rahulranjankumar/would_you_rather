/* FUN FRIDAY ARENA — LAUNCH SEQUENCE v24 (~3.3s total) */
(function (global) {
  'use strict';
  var CFG={W:980,H:440,FRAGMENTS:18,SNAP_AT:2050,SNAP_MS:780,STAGGER:22,TAIL:90,COOLDOWN_MS:30*60*1000};
  function outCubic(t){return 1-Math.pow(1-t,3);}
  function outQuint(t){return 1-Math.pow(1-t,5);}
  function clamp01(t){return t<0?0:t>1?1:t;}
  function seg(now,start,dur){return clamp01((now-start)/dur);}
  function chevPath(ctx,x,y,s){var w=s*.42,h=s*.58;ctx.beginPath();ctx.moveTo(x-w/2,y-h/2);ctx.lineTo(x+w/2,y);ctx.lineTo(x-w/2,y+h/2);}
  function chevLen(s){var w=s*.42,h=s*.58;return 2*Math.sqrt(w*w*.25+h*h*.25)*2;}
  function drawCurrys(ctx,cx,cy,d){ctx.save();ctx.beginPath();ctx.arc(cx,cy,d/2,0,Math.PI*2);
    ctx.fillStyle='#4B18A8';ctx.shadowColor='rgba(161,0,255,.75)';ctx.shadowBlur=d*.32;ctx.fill();ctx.shadowBlur=0;
    ctx.lineWidth=Math.max(1,d*.012);ctx.strokeStyle='rgba(255,255,255,.22)';ctx.stroke();
    ctx.fillStyle='#FFF';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.font='600 '+(d*.30).toFixed(1)+'px Poppins,"Century Gothic",Futura,"Segoe UI",sans-serif';
    ctx.fillText('currys',cx,cy+d*.015);ctx.restore();}
  function build(opts){
    opts=opts||{};
    var host=document.getElementById('intro'); if(!host) return;
    var reduced=global.matchMedia&&global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var lite=document.body.classList.contains('lite');
    var doSnap=!reduced&&!lite&&opts.snap!==false;
    var stage=host.querySelector('#intro-stage'),canvas=host.querySelector('#intro-canvas');
    var fragLayer=host.querySelector('#intro-frags'),skip=host.querySelector('.intro-skip');
    if(!canvas) return;
    var dpr=Math.min(global.devicePixelRatio||1,2),W=CFG.W,H=CFG.H;
    var scale=Math.min(1,(global.innerWidth*.94)/W);
    canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);
    canvas.style.width=Math.round(W*scale)+'px';canvas.style.height=Math.round(H*scale)+'px';
    var ctx=canvas.getContext('2d'),started=0,raf=null,finished=false,snapped=false;
    function paintAcn(p,now){
      var dx=(1-outCubic(p))*-280,a=clamp01(p*1.4),right=W*.5-74,y=H*.235;
      ctx.save();ctx.globalAlpha=a;ctx.translate(dx,0);
      ctx.fillStyle='#FBF9FF';ctx.textAlign='right';ctx.textBaseline='middle';
      ctx.font='600 48px Poppins,"Segoe UI",system-ui,sans-serif';
      ctx.fillText('accenture',right-46,y);
      var s=52,cx=right-14,cy=y,len=chevLen(s),draw=seg(now,300,540);
      var g=ctx.createLinearGradient(cx-s/2,cy-s/2,cx+s/2,cy+s/2);
      g.addColorStop(0,'#C77DFF');g.addColorStop(.55,'#A100FF');g.addColorStop(1,'#00AEEF');
      var blink=1,bt=now-920;
      if(bt>0){var c=bt%2600;if(c>1700&&c<1820)blink=.22;else if(c>1900&&c<1980)blink=.38;}
      ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=9;ctx.strokeStyle=g;
      ctx.globalAlpha=a*blink;ctx.setLineDash([len,len]);ctx.lineDashOffset=len*(1-outCubic(draw));
      chevPath(ctx,cx,cy,s);ctx.stroke();
      if(draw>=1){
        var rt=((now-850)%1500)/1500;
        if(rt<.82){
          var hl=len*.20,pos=-hl+(len+hl)*outCubic(clamp01(rt/.82));
          ctx.globalAlpha=a*(rt<.1?rt/.1:rt>.7?(.82-rt)/.12:1);
          ctx.strokeStyle='#FFFFFF';ctx.lineWidth=9.5;ctx.shadowColor='#A100FF';ctx.shadowBlur=22;
          ctx.setLineDash([hl,len*2]);ctx.lineDashOffset=-pos;
          chevPath(ctx,cx,cy,s);ctx.stroke();ctx.shadowBlur=0;}}
      ctx.setLineDash([]);ctx.restore();}
    function paintCur(p){
      var e=outCubic(p),dx=(1-e)*280,s=.88+.12*e,d=90,cx=W*.5+46,cy=H*.235;
      ctx.save();ctx.globalAlpha=clamp01(p*1.4);ctx.translate(dx,0);
      ctx.strokeStyle='rgba(255,255,255,.22)';ctx.lineWidth=1.5;ctx.beginPath();
      ctx.moveTo(W*.5-26,cy-27);ctx.lineTo(W*.5-26,cy+27);ctx.stroke();
      ctx.translate(cx,cy);ctx.scale(s,s);drawCurrys(ctx,0,0,d);ctx.restore();}
    function paintTitle(p){var e=outCubic(p);ctx.save();ctx.globalAlpha=clamp01(p*1.5);
      ctx.translate(0,(1-e)*26);ctx.fillStyle='#FBF9FF';ctx.textAlign='center';
      ctx.font='400 84px Anton,Impact,sans-serif';ctx.fillText('FUN FRIDAY',W/2,H*.60);ctx.restore();}
    function paintScript(p){var e=outCubic(p);ctx.save();ctx.globalAlpha=clamp01(p*1.5);ctx.translate(0,(1-e)*20);
      var g=ctx.createLinearGradient(W*.35,0,W*.65,0);g.addColorStop(0,'#C77DFF');g.addColorStop(1,'#5FD8FF');
      ctx.fillStyle=g;ctx.textAlign='center';ctx.shadowColor='rgba(161,0,255,.65)';ctx.shadowBlur=26;
      ctx.font='400 50px Condiment,cursive';ctx.fillText('arena',W/2,H*.745);ctx.restore();}
    function paintRule(p){var w=300*outQuint(p);if(w<=0)return;
      var y=H*.805,h=4,g=ctx.createLinearGradient(W/2-w/2,0,W/2+w/2,0);
      g.addColorStop(0,'#A100FF');g.addColorStop(.45,'#6D28D9');g.addColorStop(1,'#00AEEF');
      ctx.save();ctx.fillStyle=g;ctx.shadowColor='rgba(161,0,255,.8)';ctx.shadowBlur=20;ctx.beginPath();
      if(ctx.roundRect)ctx.roundRect(W/2-w/2,y,w,h,h/2);else ctx.rect(W/2-w/2,y,w,h);ctx.fill();ctx.restore();}
    function paintBy(p){ctx.save();ctx.globalAlpha=clamp01(p);ctx.fillStyle='rgba(251,249,255,.90)';
      ctx.textAlign='center';ctx.font='13px ui-monospace,Menlo,Consolas,monospace';
      if('letterSpacing' in ctx)ctx.letterSpacing='4px';
      ctx.fillText('MADE BY PPA WARRIORS',W/2,H*.915);
      if('letterSpacing' in ctx)ctx.letterSpacing='0px';ctx.restore();}
    function paint(now){
      ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);
      paintAcn(seg(now,80,580),now);paintCur(seg(now,80,580));
      paintTitle(seg(now,720,460));paintScript(seg(now,950,460));
      paintRule(seg(now,1190,520));paintBy(seg(now,1480,400));}
    function snap(){
      if(snapped)return;snapped=true;if(!doSnap)return end();
      var src,px;
      try{src=document.createElement('canvas');src.width=W;src.height=H;
        src.getContext('2d').drawImage(canvas,0,0,W,H);
        px=src.getContext('2d').getImageData(0,0,W,H);}catch(e){return end();}
      var n=CFG.FRAGMENTS,data=px.data,buckets=new Array(n),wts=new Float32Array(n);
      for(var b=0;b<n;b++)buckets[b]=new Uint8ClampedArray(data.length);
      function pick(peak){var t=0,i;
        for(i=0;i<n;i++){var d=n-Math.abs(peak-i),v=d>0?d*d*d:0;wts[i]=v;t+=v;}
        var r=Math.random()*t;
        for(i=0;i<n;i++){r-=wts[i];if(r<=0)return i;}return n-1;}
      for(var y=0;y<H;y++)for(var x=0;x<W;x++){
        var i4=(y*W+x)*4;if(data[i4+3]===0)continue;
        var tg=buckets[pick(Math.floor((x/W)*n))];
        tg[i4]=data[i4];tg[i4+1]=data[i4+1];tg[i4+2]=data[i4+2];tg[i4+3]=data[i4+3];}
      var rect=canvas.getBoundingClientRect(),sr=stage.getBoundingClientRect();
      fragLayer.style.width=rect.width+'px';fragLayer.style.height=rect.height+'px';
      fragLayer.style.left=(rect.left-sr.left)+'px';fragLayer.style.top=(rect.top-sr.top)+'px';
      var frags=[];
      for(var k=0;k<n;k++){
        var fc=document.createElement('canvas');fc.width=W;fc.height=H;
        fc.getContext('2d').putImageData(new ImageData(buckets[k],W,H),0,0);
        fc.style.transition='transform '+(CFG.SNAP_MS+k*CFG.STAGGER)+'ms cubic-bezier(.36,.06,.30,1), opacity '+
          (CFG.SNAP_MS*.8+k*CFG.STAGGER)+'ms cubic-bezier(.55,0,.75,.2), filter '+(CFG.SNAP_MS*.55)+'ms ease-out';
        fc.style.transitionDelay=(k*CFG.STAGGER)+'ms';
        fragLayer.appendChild(fc);frags.push(fc);buckets[k]=null;}
      px=null;data=null;src=null;canvas.style.visibility='hidden';
      requestAnimationFrame(function(){requestAnimationFrame(function(){
        for(var k=0;k<frags.length;k++){
          var dX=60+Math.random()*130+k*5,dY=-(40+Math.random()*120),rot=(Math.random()*26-13);
          frags[k].style.transform='translate('+dX.toFixed(1)+'px,'+dY.toFixed(1)+'px) rotate('+rot.toFixed(1)+'deg) scale(1.04)';
          frags[k].style.filter='blur(2.4px)';frags[k].style.opacity='0';}});});
      setTimeout(end,CFG.SNAP_MS+n*CFG.STAGGER+CFG.TAIL);}
    function loop(ts){if(!started)started=ts;var now=ts-started;
      if(!snapped)paint(now);
      if(!snapped&&now>=(reduced?450:CFG.SNAP_AT))snap();
      if(!finished)raf=requestAnimationFrame(loop);}
    function end(){if(finished)return;finished=true;if(raf)cancelAnimationFrame(raf);
      host.classList.add('done');document.removeEventListener('keydown',onKey);host.removeEventListener('click',onClick);
      setTimeout(function(){if(host.parentNode)host.parentNode.removeChild(host);},450);}
    function bail(){snapped=true;end();}
    function onKey(){bail();}
    function onClick(){bail();}
    document.addEventListener('keydown',onKey);host.addEventListener('click',onClick);
    if(skip)skip.addEventListener('click',function(e){e.stopPropagation();bail();});
    setTimeout(function(){if(!finished)end();},6500);
    function go(){raf=requestAnimationFrame(loop);}
    if(document.fonts&&document.fonts.ready){var settled=false;
      document.fonts.ready.then(function(){if(!settled){settled=true;go();}});
      setTimeout(function(){if(!settled){settled=true;go();}},700);}
    else go();}
  function markup(){return '<div id="intro"><div class="intro-glow"></div><div class="stars"></div>'+
    '<div id="intro-stage"><canvas id="intro-canvas"></canvas><div id="intro-frags"></div></div>'+
    '<button class="intro-skip" type="button">Skip</button></div>';}
  function allowed(policy,key){
    try{
      if(policy==='session'){if(sessionStorage.getItem(key)==='1')return false;sessionStorage.setItem(key,'1');return true;}
      if(policy==='cooldown'){var last=parseInt(localStorage.getItem(key)||'0',10);
        if(Date.now()-last<CFG.COOLDOWN_MS)return false;localStorage.setItem(key,String(Date.now()));return true;}
    }catch(e){}
    return true;}
  function mount(opts){opts=opts||{};var slot=document.getElementById('intro-mount');if(!slot)return;
    var policy=opts.policy||'always',key='ffa-intro-'+(opts.key||policy);
    if(!allowed(policy,key)){slot.innerHTML='';return;}
    slot.innerHTML=markup();build(opts);}
  global.FFAIntro={mount:mount,markup:markup,build:build};
})(window);
