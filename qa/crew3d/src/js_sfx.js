/* ==================================================================
   FUN FRIDAY ARENA v27 — SFX (Web Audio, synthesised, zero files)
   Every hit / whoosh / pop is a tiny synth patch (< 0.3 s, quiet mix).
   Character "voices" are formant-shifted blips — never recorded voices.
   Mute is respected everywhere; the game is fully playable with sound off.
   ================================================================== */
(function (g) {
  'use strict';
  var ac = null, master = null, muted = false, KEY = 'ffa-mute';
  try { muted = localStorage.getItem(KEY) === '1'; } catch (e) {}
  function ctx() {
    if (ac) return ac;
    var C = g.AudioContext || g.webkitAudioContext; if (!C) return null;
    ac = new C(); master = ac.createGain(); master.gain.value = muted ? 0 : .32;
    var comp = ac.createDynamicsCompressor(); master.connect(comp); comp.connect(ac.destination);
    return ac;
  }
  ['pointerdown', 'keydown'].forEach(function (ev) {
    g.addEventListener(ev, function () { var c = ctx(); if (c && c.state === 'suspended') c.resume(); }, { passive: true });
  });
  function tone(type, f0, f1, dur, vol, at, q) {
    var c = ctx(); if (!c || muted) return; var t = c.currentTime + (at || 0);
    var o = c.createOscillator(), gn = c.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(vol || .3, t + Math.min(.012, dur / 4));
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (q) { var f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = q; f.Q.value = 6; o.connect(f); f.connect(gn); } else o.connect(gn);
    gn.connect(master); o.start(t); o.stop(t + dur + .02);
  }
  var nb = null;
  function noise(dur, vol, type, freq, at) {
    var c = ctx(); if (!c || muted) return; var t = c.currentTime + (at || 0);
    if (!nb) { nb = c.createBuffer(1, c.sampleRate, c.sampleRate); var d = nb.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    var s = c.createBufferSource(), f = c.createBiquadFilter(), gn = c.createGain(); s.buffer = nb;
    f.type = type === 'sweep' || !type ? 'bandpass' : type; f.frequency.setValueAtTime(freq || 1200, t);
    if (type === 'sweep') { f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(3200, t + dur); }
    gn.gain.setValueAtTime(vol || .2, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(gn); gn.connect(master); s.start(t); s.stop(t + dur + .02);
  }
  /* formant "voice": a pitched pulse through two vowel filters */
  function voice(f0, f1, dur, vowel, at, vol) {
    var c = ctx(); if (!c || muted) return; var t = c.currentTime + (at || 0);
    var F = { a: [800, 1150], e: [400, 2000], i: [300, 2300], o: [450, 800], u: [325, 700], m: [280, 900] }[vowel || 'a'];
    var o = c.createOscillator(), gn = c.createGain(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(vol || .22, t + .02); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    F.forEach(function (fr) { var b = c.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = fr; b.Q.value = 8; o.connect(b); b.connect(gn); });
    gn.connect(master); o.start(t); o.stop(t + dur + .02);
  }
  var S = {
    click: function () { tone('triangle', 1400, 900, .05, .18); },
    tap: function () { tone('sine', 700, 1200, .07, .2); },
    pop: function () { tone('sine', 380, 1300, .08, .25); noise(.04, .08, 'highpass', 3000); },
    whoosh: function () { noise(.28, .16, 'sweep'); },
    bonk: function () { tone('sine', 260, 90, .18, .4); tone('square', 1800, 2400, .06, .05, .01); },
    squeak: function () { tone('sine', 1500, 2600, .09, .2); tone('sine', 2600, 1700, .08, .16, .08); },
    coin: function (i) { tone('square', 988, 0, .06, .08, (i || 0) * .04); tone('square', 1319, 0, .14, .08, (i || 0) * .04 + .06); },
    lock: function () { tone('sine', 220, 110, .18, .35); noise(.08, .14, 'lowpass', 900); tone('triangle', 1760, 0, .12, .07, .05); },
    tick: function (hi) { tone('sine', hi ? 1320 : 990, 0, .05, .16); },
    whistle: function () { tone('sine', 1200, 2200, .14, .16); tone('sine', 2200, 900, .22, .14, .14); },
    trombone: function () { [392, 370, 349, 330].forEach(function (f, i) { voice(f / 2, f / 2 * .98, i === 3 ? .7 : .28, 'u', i * .3, .2); }); },
    tada: function () { voice(523, 523, .12, 'a', 0, .18); voice(784, 790, .35, 'a', .13, .2); },
    hup: function () { voice(820, 1100, .1, 'u', 0, .18); },
    wheee: function () { voice(700, 1500, .32, 'i', 0, .16); },
    hmm: function () { voice(140, 120, .3, 'm', 0, .2); },
    slurp: function () { noise(.38, .1, 'bandpass', 900); tone('sine', 300, 600, .38, .05); },
    snort: function () { noise(.07, .2, 'lowpass', 500); noise(.07, .2, 'lowpass', 600, .11); },
    ahem: function () { voice(170, 150, .14, 'a', 0, .2); voice(200, 160, .2, 'e', .17, .2); },
    hmph: function () { voice(220, 140, .2, 'm', 0, .22); },
    gasp: function () { noise(.22, .12, 'highpass', 2500); voice(400, 600, .18, 'a', .02, .1); },
    giggle: function () { for (var i = 0; i < 4; i++) voice(600 + i * 40, 680 + i * 40, .07, 'i', i * .09, .14); },
    tear: function () { for (var i = 0; i < 7; i++) noise(.03, .14, 'highpass', 2200 + i * 200, i * .035); },
    drumroll: function (ms) { var n = Math.floor((ms || 2000) / 45); for (var i = 0; i < n; i++) noise(.05, .06 + i / n * .14, 'bandpass', 220, i * .045); tone('sine', 110, 60, .6, .4, (ms || 2000) / 1000); },
    bassdrop: function () { tone('sine', 120, 38, .7, .5); noise(.4, .1, 'lowpass', 300); },
    fart: function () { var c = ctx(); if (!c || muted) return; tone('sawtooth', 110, 70, .7, .14, 0, 260); },
    chime: function () { tone('sine', 1047, 0, .4, .1); tone('sine', 1568, 0, .5, .08, .08); },
    error: function () { tone('triangle', 330, 300, .15, .12); },
    splat: function () { noise(.16, .3, 'lowpass', 700); tone('sine', 180, 60, .14, .25); },
    boing: function () { var c = ctx(); if (!c || muted) return; tone('sine', 140, 520, .28, .25); tone('triangle', 520, 300, .2, .08, .05); },
    clang: function () { tone('square', 820, 0, .25, .08); tone('triangle', 1240, 0, .35, .1, .01); tone('sine', 2100, 0, .4, .05, .02); },
    fizz: function () { noise(.5, .1, 'highpass', 4000); },
    sneeze: function () { voice(500, 900, .14, 'a', 0, .16); noise(.3, .28, 'bandpass', 2600, .14); },
    zoom: function () { noise(.9, .2, 'sweep'); tone('sawtooth', 120, 600, .9, .05); },
    bell: function () { tone('sine', 1760, 0, .7, .12); tone('sine', 2637, 0, .5, .06, .01); }
  };
  S.muted = function () { return muted; };
  S.toggle = function (v) {
    muted = v == null ? !muted : !!v; try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch (e) {}
    if (master) master.gain.value = muted ? 0 : .32; document.documentElement.classList.toggle('is-muted', muted); return muted;
  };
  document.documentElement.classList.toggle('is-muted', muted);
  g.SFX = S;
})(window);

