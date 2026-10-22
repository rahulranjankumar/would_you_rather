/* ==================================================================
   FUN FRIDAY ARENA — "Pip" the astronaut mascot  v25
   Hand-built SVG of the hero astronaut from the 3D intro (cream glossy
   helmet, dark visor, peach face, big sparkly purple eyes, blush,
   Accenture-chevron chest panel, accent ear pods, antenna).

   Why SVG and not the intro's three.js model: the play page runs on
   ~600 phones at once. three.js + WebGL would be ~650 KB and a GPU
   render loop per phone. This is ~8 KB, animates with CSS transforms
   only (compositor thread), and costs the Render server nothing.

   API
     Mascot.mount(el)         -> instance
     m.look(x,y)              -> x,y in -1..1 (eyes + head follow)
     m.dance()                -> random 1 of 10 celebration routines
     m.tease()                -> random 1 of 10 teasing routines
     m.face('happy'|'open'|'closed'|'wow'|'smug'|'sad')
   ================================================================== */
(function(g){
  'use strict';
  var NS='http://www.w3.org/2000/svg',uid=0;
  var DANCES=['wiggle','robot','floss','spin','chicken','disco','moon','hula','headbang','wave'];
  var TEASES=['tongue','shrug','facepalm','laughpt','thumbsdn','yawn','eyeroll','slowclap','wag','snooze'];
  var DANCE_FACE={wiggle:'happy',robot:'smug',floss:'happy',spin:'wow',chicken:'happy',disco:'smug',moon:'smug',hula:'happy',headbang:'closed',wave:'happy'};
  var TEASE_FACE={tongue:'tongue',shrug:'smug',facepalm:'closed',laughpt:'laugh',thumbsdn:'smug',yawn:'yawn',eyeroll:'smug',slowclap:'smug',wag:'smug',snooze:'closed'};
  function svg(id){return ''+
'<svg viewBox="0 0 200 250" xmlns="'+NS+'" aria-hidden="true" class="m-svg">'+
'<defs>'+
 '<radialGradient id="h'+id+'" cx="34%" cy="26%" r="78%"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#f4efff"/><stop offset="1" stop-color="#cfc3f2"/></radialGradient>'+
 '<radialGradient id="b'+id+'" cx="38%" cy="30%" r="80%"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#efe9ff"/><stop offset="1" stop-color="#c8bbee"/></radialGradient>'+
 '<linearGradient id="f'+id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff5f0"/><stop offset="1" stop-color="#fbd2c6"/></linearGradient>'+
 '<radialGradient id="e'+id+'" cx="50%" cy="72%" r="70%"><stop offset="0" stop-color="#8a4dff"/><stop offset=".5" stop-color="#4a1f99"/><stop offset="1" stop-color="#1a0f33"/></radialGradient>'+
 '<linearGradient id="a'+id+'" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C77DFF"/><stop offset=".6" stop-color="#A100FF"/><stop offset="1" stop-color="#00AEEF"/></linearGradient>'+
'</defs>'+
'<ellipse class="m-shadow" cx="100" cy="238" rx="46" ry="7" fill="rgba(0,0,0,.35)"/>'+
'<g class="m-all">'+
 /* legs */
 '<g class="m-legL"><rect x="76" y="186" width="20" height="34" rx="10" fill="url(#b'+id+')"/><rect x="70" y="214" width="30" height="16" rx="8" fill="#d9d0f4"/><rect x="70" y="226" width="30" height="5" rx="2.5" fill="#A100FF"/></g>'+
 '<g class="m-legR"><rect x="104" y="186" width="20" height="34" rx="10" fill="url(#b'+id+')"/><rect x="100" y="214" width="30" height="16" rx="8" fill="#d9d0f4"/><rect x="100" y="226" width="30" height="5" rx="2.5" fill="#A100FF"/></g>'+
 /* body */
 '<g class="m-body">'+
  '<ellipse cx="100" cy="166" rx="44" ry="40" fill="url(#b'+id+')"/>'+
  '<path d="M60 160 Q100 172 140 160" stroke="#d6ccf2" stroke-width="2" fill="none"/>'+
  '<rect x="80" y="150" width="40" height="26" rx="7" fill="#d9d0f4"/>'+
  '<path d="M90 156 L104 163 L90 170 L90 166 L98 163 L90 160Z" fill="url(#a'+id+')"/>'+
  '<circle cx="111" cy="157" r="2.6" fill="#ff3d5a"/><circle cx="111" cy="163.5" r="2.6" fill="#ffd23d"/><circle cx="111" cy="170" r="2.6" fill="#39e07a"/>'+
  '<ellipse cx="100" cy="196" rx="38" ry="5" fill="#d6ccf2"/>'+
 '</g>'+
 /* arms */
 '<g class="m-armL"><rect x="40" y="140" width="22" height="44" rx="11" fill="url(#b'+id+')"/><rect x="40" y="172" width="22" height="7" rx="3.5" fill="#A100FF"/><circle cx="51" cy="188" r="12" fill="#f3efff"/></g>'+
 '<g class="m-armR"><rect x="138" y="140" width="22" height="44" rx="11" fill="url(#b'+id+')"/><rect x="138" y="172" width="22" height="7" rx="3.5" fill="#A100FF"/><circle cx="149" cy="188" r="12" fill="#f3efff"/><circle cx="141" cy="182" r="5" fill="#4B18A8"/></g>'+
 /* head */
 '<g class="m-head"><g class="m-look">'+
  '<g class="m-ant"><line x1="66" y1="40" x2="56" y2="14" stroke="#cfc3f2" stroke-width="3" stroke-linecap="round"/><circle cx="55" cy="12" r="6" fill="url(#a'+id+')"/></g>'+
  '<circle cx="100" cy="82" r="60" fill="url(#h'+id+')"/>'+
  '<path d="M84 30 Q100 22 116 30" stroke="#1d1830" stroke-width="3" fill="none" stroke-linecap="round"/>'+
  '<circle cx="40" cy="86" r="14" fill="url(#a'+id+')"/><circle cx="160" cy="86" r="14" fill="url(#a'+id+')"/>'+
  '<circle cx="35" cy="86" r="6" fill="#d9d0f4"/><circle cx="165" cy="86" r="6" fill="#d9d0f4"/>'+
  '<ellipse cx="100" cy="90" rx="46" ry="37" fill="#1d1830"/>'+
  '<ellipse cx="100" cy="91" rx="41" ry="32" fill="url(#f'+id+')"/>'+
  /* blush */
  '<ellipse class="m-blush" cx="70" cy="102" rx="9" ry="5" fill="rgba(255,105,150,.55)"/><ellipse class="m-blush" cx="130" cy="102" rx="9" ry="5" fill="rgba(255,105,150,.55)"/>'+
  /* eyes */
  '<g class="m-eyes"><g class="m-pupils">'+
   '<g class="m-eo"><ellipse cx="83" cy="86" rx="8.5" ry="10.5" fill="url(#e'+id+')"/><ellipse cx="86" cy="81.5" rx="3.4" ry="2.9" fill="#fff"/><circle cx="80" cy="90.5" r="1.6" fill="#fff"/>'+
    '<ellipse cx="117" cy="86" rx="8.5" ry="10.5" fill="url(#e'+id+')"/><ellipse cx="120" cy="81.5" rx="3.4" ry="2.9" fill="#fff"/><circle cx="114" cy="90.5" r="1.6" fill="#fff"/></g>'+
  '</g>'+
   '<g class="m-eh" fill="none" stroke="#2b1f4f" stroke-width="3.4" stroke-linecap="round"><path d="M75 89 Q83 79 91 89"/><path d="M109 89 Q117 79 125 89"/></g>'+
   '<g class="m-ec" fill="none" stroke="#2b1f4f" stroke-width="3.4" stroke-linecap="round"><path d="M75 85 Q83 92 91 85"/><path d="M109 85 Q117 92 125 85"/></g>'+
   '<g class="m-es" fill="#2b1f4f"><rect x="75" y="86" width="16" height="3.4" rx="1.7"/><rect x="109" y="86" width="16" height="3.4" rx="1.7"/></g>'+
  '</g>'+
  '<ellipse cx="100" cy="97" rx="2" ry="1.4" fill="#f29aa8"/>'+
  /* mouths */
  '<g class="m-mouth" fill="none" stroke="#2b1f4f" stroke-width="2.8" stroke-linecap="round">'+
   '<path class="mm-cat" d="M93 103 Q96.5 107 100 103 Q103.5 107 107 103"/>'+
   '<path class="mm-smile" d="M91 103 Q100 112 109 103"/>'+
   '<g class="mm-open"><path d="M90 102 Q100 116 110 102Z" fill="#2b1f4f"/><ellipse cx="100" cy="108" rx="5" ry="2.6" fill="#ff7d9c" stroke="none"/></g>'+
   '<g class="mm-tongue"><path d="M90 102 Q100 114 110 102Z" fill="#2b1f4f"/><ellipse cx="102" cy="111" rx="5" ry="6" fill="#ff6f91" stroke="none"/></g>'+
   '<ellipse class="mm-o" cx="100" cy="106" rx="4.5" ry="5.5" fill="#2b1f4f"/>'+
   '<path class="mm-smug" d="M93 105 Q102 108 109 101"/>'+
   '<path class="mm-sad" d="M92 108 Q100 101 108 108"/>'+
  '</g>'+
  /* glass + shine */
  '<ellipse cx="100" cy="90" rx="46" ry="37" fill="rgba(230,238,255,.08)"/>'+
  '<path d="M70 66 Q82 56 100 56" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".85"/>'+
  '<circle cx="128" cy="62" r="3" fill="#fff" opacity=".85"/>'+
  '<g class="m-zz" fill="#C77DFF" font-family="Anton,Impact,sans-serif" font-size="16"><text x="150" y="40">z</text><text x="162" y="26" font-size="12">z</text></g>'+
 '</g></g>'+
'</g></svg>';}

  var CSS=''+
'.mascot{width:100%;height:100%;pointer-events:none;user-select:none}'+
'.m-svg{width:100%;height:100%;overflow:visible;display:block}'+
'.m-svg *{transform-box:view-box}'+
'.m-all{transform-origin:100px 230px;animation:m-idle 3.2s ease-in-out infinite}'+
'@keyframes m-idle{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}'+
'.m-head{transform-origin:100px 140px}.m-look{transform-origin:100px 140px;transition:transform .45s cubic-bezier(.34,1.3,.4,1)}'+
'.m-pupils{transition:transform .38s cubic-bezier(.34,1.3,.4,1)}'+
'.m-armL{transform-origin:51px 146px}.m-armR{transform-origin:149px 146px}'+
'.m-legL{transform-origin:86px 190px}.m-legR{transform-origin:114px 190px}'+
'.m-body{transform-origin:100px 200px}.m-ant{transform-origin:66px 40px;animation:m-ant 2.6s ease-in-out infinite}'+
'@keyframes m-ant{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(8deg)}}'+
/* face states */
'.m-eh,.m-ec,.m-es,.m-zz,.mm-smile,.mm-open,.mm-tongue,.mm-o,.mm-smug,.mm-sad{display:none}'+
'[data-face=happy] .m-eo,[data-face=laugh] .m-eo,[data-face=tongue] .m-eo{display:none}'+
'[data-face=happy] .m-eh,[data-face=laugh] .m-eh,[data-face=tongue] .m-eh{display:inline}'+
'[data-face=closed] .m-eo,[data-face=yawn] .m-eo{display:none}[data-face=closed] .m-ec,[data-face=yawn] .m-ec{display:inline}'+
'[data-face=smug] .m-eo{display:none}[data-face=smug] .m-es{display:inline}'+
'[data-face=happy] .mm-cat,[data-face=laugh] .mm-cat,[data-face=wow] .mm-cat,[data-face=tongue] .mm-cat,[data-face=smug] .mm-cat,[data-face=sad] .mm-cat,[data-face=yawn] .mm-cat,[data-face=closed] .mm-cat{display:none}'+
'[data-face=happy] .mm-smile,[data-face=closed] .mm-smile{display:inline}[data-face=laugh] .mm-open{display:inline}'+
'[data-face=tongue] .mm-tongue{display:inline}[data-face=wow] .mm-o,[data-face=yawn] .mm-o{display:inline}'+
'[data-face=smug] .mm-smug{display:inline}[data-face=sad] .mm-sad{display:inline}'+
'[data-face=yawn] .mm-o{transform:scale(1.8);transform-origin:100px 106px}'+
'.m-snooze .m-zz{display:inline;animation:m-zz 1.2s ease-in-out infinite}'+
'@keyframes m-zz{0%{opacity:0;transform:translate(0,6px)}50%{opacity:1}100%{opacity:0;transform:translate(8px,-8px)}}'+
/* ---------------- 10 DANCES ---------------- */
'.d-wiggle .m-all{animation:dw .5s ease-in-out 5}@keyframes dw{0%,100%{transform:rotate(0)}25%{transform:rotate(-9deg)}75%{transform:rotate(9deg)}}'+
'.d-wiggle .m-armL{animation:dwa .5s ease-in-out 5}.d-wiggle .m-armR{animation:dwa .5s ease-in-out 5 reverse}@keyframes dwa{0%,100%{transform:rotate(0)}50%{transform:rotate(150deg)}}'+
'.d-robot .m-armL{animation:dra 1s steps(1) 3}.d-robot .m-armR{animation:drb 1s steps(1) 3}.d-robot .m-head{animation:drh 1s steps(1) 3}'+
'@keyframes dra{0%{transform:rotate(90deg)}25%{transform:rotate(0)}50%{transform:rotate(-90deg)}75%{transform:rotate(180deg)}}'+
'@keyframes drb{0%{transform:rotate(0)}25%{transform:rotate(-90deg)}50%{transform:rotate(90deg)}75%{transform:rotate(-180deg)}}'+
'@keyframes drh{0%{transform:rotate(-12deg)}50%{transform:rotate(12deg)}}'+
'.d-floss .m-body{animation:dfb .36s ease-in-out 8}.d-floss .m-armL,.d-floss .m-armR{animation:dfa .36s ease-in-out 8}'+
'@keyframes dfb{0%,100%{transform:translateX(-7px)}50%{transform:translateX(7px)}}@keyframes dfa{0%,100%{transform:rotate(35deg)}50%{transform:rotate(-35deg)}}'+
'.d-spin .m-all{animation:dsp 1.4s cubic-bezier(.5,0,.3,1) 2}@keyframes dsp{0%{transform:translateY(0) scaleX(1)}30%{transform:translateY(-38px) scaleX(-1)}60%{transform:translateY(-38px) scaleX(1)}80%{transform:translateY(0) scale(1.1,.88)}100%{transform:none}}'+
'.d-spin .m-armL,.d-spin .m-armR{transform:rotate(160deg);transition:transform .2s}'+
'.d-chicken .m-armL{animation:dca .28s ease-in-out 10}.d-chicken .m-armR{animation:dcb .28s ease-in-out 10}.d-chicken .m-head{animation:dch .28s ease-in-out 10}'+
'@keyframes dca{0%,100%{transform:rotate(0)}50%{transform:rotate(55deg)}}@keyframes dcb{0%,100%{transform:rotate(0)}50%{transform:rotate(-55deg)}}@keyframes dch{0%,100%{transform:translateX(0)}50%{transform:translateX(6px)}}'+
'.d-disco .m-armR{animation:dda .6s ease-in-out 5}.d-disco .m-all{animation:ddb .6s ease-in-out 5}'+
'@keyframes dda{0%,100%{transform:rotate(-150deg)}50%{transform:rotate(-20deg)}}@keyframes ddb{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(5deg) translateY(-6px)}}'+
'.d-moon .m-all{animation:dm 2.8s linear 1}.d-moon .m-legL{animation:dml .35s ease-in-out 8}.d-moon .m-legR{animation:dml .35s ease-in-out 8 reverse}'+
'@keyframes dm{0%{transform:translateX(0)}50%{transform:translateX(-30px)}100%{transform:translateX(0)}}@keyframes dml{0%,100%{transform:rotate(0)}50%{transform:rotate(18deg) translateY(-4px)}}'+
'.d-hula .m-body,.d-hula .m-legL,.d-hula .m-legR{animation:dhu .5s ease-in-out 6}.d-hula .m-armL{transform:rotate(120deg)}.d-hula .m-armR{transform:rotate(-120deg)}'+
'@keyframes dhu{0%,100%{transform:translateX(-8px) rotate(-4deg)}50%{transform:translateX(8px) rotate(4deg)}}'+
'.d-headbang .m-head{animation:dhb .22s ease-in-out 12}.d-headbang .m-armR{transform:rotate(-165deg)}@keyframes dhb{0%,100%{transform:rotate(0)}50%{transform:rotate(16deg) translateY(4px)}}'+
'.d-wave .m-armL{animation:dwv .5s ease-in-out 6}.d-wave .m-armR{animation:dwv .5s ease-in-out .25s 6}.d-wave .m-all{animation:djump .5s ease-in-out 6}'+
'@keyframes dwv{0%,100%{transform:rotate(-170deg)}50%{transform:rotate(-130deg)}}@keyframes djump{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}'+
'.d-wave .m-armL{animation-name:dwv2}@keyframes dwv2{0%,100%{transform:rotate(170deg)}50%{transform:rotate(130deg)}}'+
/* ---------------- 10 TEASES ---------------- */
'.t-tongue .m-head{animation:tt .4s ease-in-out 6}@keyframes tt{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(8deg)}}.t-tongue .m-armL{transform:rotate(150deg)}.t-tongue .m-armR{transform:rotate(-150deg)}'+
'.t-shrug .m-armL{animation:tsa 1s ease-in-out 3}.t-shrug .m-armR{animation:tsb 1s ease-in-out 3}.t-shrug .m-head{animation:tsh 1s ease-in-out 3}'+
'@keyframes tsa{0%,100%{transform:rotate(0)}40%,60%{transform:rotate(70deg) translateY(-6px)}}@keyframes tsb{0%,100%{transform:rotate(0)}40%,60%{transform:rotate(-70deg) translateY(-6px)}}@keyframes tsh{40%,60%{transform:translateY(5px) rotate(-6deg)}}'+
'.t-facepalm .m-armR{animation:tfp 2.8s ease-in-out 1 forwards}.t-facepalm .m-head{animation:tfh 2.8s ease-in-out 1}'+
'@keyframes tfp{0%{transform:rotate(0)}20%,85%{transform:rotate(-142deg) translate(-12px,4px)}100%{transform:rotate(0)}}@keyframes tfh{20%,85%{transform:rotate(10deg) translateY(4px)}}'+
'.t-laughpt .m-armR{transform:rotate(-95deg)}.t-laughpt .m-all{animation:tl .18s ease-in-out 14}@keyframes tl{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px) rotate(2deg)}}'+
'.t-thumbsdn .m-armR{animation:ttd 2.6s ease-in-out 1}@keyframes ttd{0%,100%{transform:rotate(0)}20%,80%{transform:rotate(-40deg) translateY(10px)}}'+
'.t-thumbsdn .m-head{animation:tsh 1.3s ease-in-out 2}'+
'.t-yawn .m-armL{animation:tya 2.8s ease-in-out 1}.t-yawn .m-armR{animation:tyb 2.8s ease-in-out 1}.t-yawn .m-all{animation:tyy 2.8s ease-in-out 1}'+
'@keyframes tya{30%,70%{transform:rotate(165deg)}}@keyframes tyb{30%,70%{transform:rotate(-165deg)}}@keyframes tyy{30%,70%{transform:scaleY(1.05)}}'+
'.t-eyeroll .m-pupils{animation:ter 1.4s ease-in-out 2!important}@keyframes ter{0%{transform:translate(0,0)}25%{transform:translate(-6px,-6px)}50%{transform:translate(0,-8px)}75%{transform:translate(6px,-6px)}100%{transform:translate(0,0)}}'+
'.t-eyeroll .m-head{animation:tsh 1.4s ease-in-out 2}'+
'.t-slowclap .m-armL{animation:tca 1s ease-in 3}.t-slowclap .m-armR{animation:tcb 1s ease-in 3}'+
'@keyframes tca{0%,100%{transform:rotate(35deg)}60%{transform:rotate(-12deg)}}@keyframes tcb{0%,100%{transform:rotate(-35deg)}60%{transform:rotate(12deg)}}'+
'.t-wag .m-armR{animation:twg .3s ease-in-out 9;transform-origin:149px 146px}@keyframes twg{0%,100%{transform:rotate(-150deg)}50%{transform:rotate(-120deg)}}'+
'.t-wag .m-head{animation:tt .6s ease-in-out 4}'+
'.t-snooze .m-head{animation:tsz 2.8s ease-in-out 1}@keyframes tsz{20%,90%{transform:rotate(14deg) translateY(6px)}}'+
'.t-snooze .m-zz{display:inline;animation:m-zz 1s ease-in-out infinite}'+
'@media(prefers-reduced-motion:reduce){.mascot *{animation:none!important;transition:none!important}}';

  function inject(){if(document.getElementById('mascot-css'))return;
    var st=document.createElement('style');st.id='mascot-css';st.textContent=CSS;document.head.appendChild(st);}
  function pick(a,last){var x;do{x=a[Math.floor(Math.random()*a.length)];}while(a.length>1&&x===last);return x;}

  function mount(el){
    inject();var id=++uid;el.classList.add('mascot');el.innerHTML=svg(id);
    var root=el.querySelector('.m-svg'),look=el.querySelector('.m-look'),pup=el.querySelector('.m-pupils');
    var act=null,actT=null,lastD=null,lastT=null,base='open';
    root.setAttribute('data-face',base);
    function face(f){root.setAttribute('data-face',f||base);}
    function lookAt(x,y){x=Math.max(-1,Math.min(1,x||0));y=Math.max(-1,Math.min(1,y||0));
      pup.style.transform='translate('+(x*6.5).toFixed(1)+'px,'+(y*4).toFixed(1)+'px)';
      look.style.transform='rotate('+(x*9).toFixed(1)+'deg) translateX('+(x*4).toFixed(1)+'px)';}
    function play(cls,f,ms){clearTimeout(actT);if(act)root.classList.remove(act);
      void root.getBoundingClientRect();act=cls;root.classList.add(cls);face(f);
      actT=setTimeout(function(){root.classList.remove(cls);act=null;face(base);},ms||2900);}
    return {
      el:el,look:lookAt,face:function(f){base=f||'open';face(base);},
      dance:function(){lastD=pick(DANCES,lastD);play('d-'+lastD,DANCE_FACE[lastD],3000);return lastD;},
      tease:function(){lastT=pick(TEASES,lastT);play('t-'+lastT,TEASE_FACE[lastT],3000);return lastT;},
      DANCES:DANCES,TEASES:TEASES
    };
  }
  g.Mascot={mount:mount,DANCES:DANCES,TEASES:TEASES};
})(window);
