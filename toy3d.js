/* ==================================================================
   FUN FRIDAY ARENA — Toy3D: a tiny WebGL engine built only for the trio
   (no three.js download: ~15 KB instead of ~600 KB on 400 phones)
   - Lathe / torus / box / disc generators, cached once, GPU buffers per context
   - "Soft vinyl toy" shading: wrapped key light, hemisphere fill, Blinn spec,
     lilac fresnel rim, soot darkening. Premultiplied alpha, MSAA on.
   - World units = CSS pixels, y up. Camera looks at the viewport like a
     window, so 3D characters line up with real DOM elements (cards, text).
   - Opaque pass then transparent pass. Optional scissor per draw group.
   ================================================================== */
(function (g) {
  'use strict';
  var PI = Math.PI;

  /* ---------------- geometry (CPU, shared by all contexts) ---------------- */
  var GEO = {};
  function finish(v, idx) { return { v: new Float32Array(v), i: new Uint16Array(idx) }; }
  /* profile: [[r,y],...] from bottom to top. Duplicate a point for a hard edge. */
  function lathe(prof, seg) {
    seg = seg || 24; var n = prof.length, v = [], idx = [], nr = [], i, j;
    for (i = 0; i < n; i++) {
      var a = prof[Math.max(0, i - 1)], b = prof[Math.min(n - 1, i + 1)];
      if (i > 0 && i < n - 1 && a[0] === prof[i][0] && a[1] === prof[i][1]) a = prof[i];
      if (i < n - 1 && b[0] === prof[i][0] && b[1] === prof[i][1]) b = prof[Math.min(n - 1, i + 2)];
      var tx = b[0] - a[0], ty = b[1] - a[1], l = Math.sqrt(tx * tx + ty * ty) || 1; nr.push([ty / l, -tx / l]);
    }
    for (j = 0; j <= seg; j++) {
      var th = j / seg * PI * 2, c = Math.cos(th), s = Math.sin(th);
      for (i = 0; i < n; i++) { var p = prof[i], q = nr[i]; v.push(p[0] * s, p[1], p[0] * c, q[0] * s, q[1], q[0] * c, 1); }
    }
    for (j = 0; j < seg; j++) for (i = 0; i < n - 1; i++) {
      var A = j * n + i, B = (j + 1) * n + i;
      idx.push(A, A + 1, B, B, A + 1, B + 1);
    }
    return finish(v, idx);
  }
  function arcPts(cx, cy, rx, ry, a0, a1, k) { var o = []; for (var i = 0; i <= k; i++) { var a = a0 + (a1 - a0) * i / k; o.push([Math.max(0, cx + Math.cos(a) * rx), cy + Math.sin(a) * ry]); } return o; }
  function sphereProf(k) { return arcPts(0, 0, 1, 1, -PI / 2, PI / 2, k || 14); }
  /* chubby toy body: rounded bottom, straight-ish side, dome top */
  function blobProf(r, h, belly) {
    var rb = r * (belly || .6), rt = r * 1.0, pts = arcPts(0, rb, r, rb, -PI / 2, 0, 9);
    var side = h - rb - rt; for (var i = 1; i <= 4; i++) { var t = i / 5; pts.push([r * (1 + .025 * Math.sin(t * PI)), rb + side * t]); }
    return pts.concat(arcPts(0, h - rt, r, rt, 0, PI / 2, 11).slice(0));
  }
  function capsuleDown(r, len) { // pivot at top (y=0), hangs down
    var p = arcPts(0, -len - r, r, r, -PI / 2, 0, 6).concat(arcPts(0, -r, r, r, 0, PI / 2, 6));
    return p;
  }
  function torus(R, r, arc, su, sv) {
    su = su || 28; sv = sv || 10; arc = arc || PI * 2; var v = [], idx = [], i, j;
    for (i = 0; i <= su; i++) { var u = i / su * arc, cu = Math.cos(u), snu = Math.sin(u);
      for (j = 0; j <= sv; j++) { var w = j / sv * PI * 2, cw = Math.cos(w), sw = Math.sin(w);
        v.push((R + r * cw) * cu, (R + r * cw) * snu, r * sw, cw * cu, cw * snu, sw, 1); } }
    for (i = 0; i < su; i++) for (j = 0; j < sv; j++) { var a = i * (sv + 1) + j, b = a + sv + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    return finish(v, idx);
  }
  function box() {
    var F = [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]], v = [], idx = [];
    F.forEach(function (n, f) {
      var u = n[0] ? [0, 1, 0] : [1, 0, 0], w = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (q) { v.push(.5 * (n[0] + q[0] * u[0] + q[1] * w[0]), .5 * (n[1] + q[0] * u[1] + q[1] * w[1]), .5 * (n[2] + q[0] * u[2] + q[1] * w[2]), n[0], n[1], n[2], 1); });
      var o = f * 4; idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
    });
    return finish(v, idx);
  }
  function disc(seg) { // radial alpha, XZ plane facing up
    seg = seg || 28; var v = [0, 0, 0, 0, 1, 0, 1], idx = [];
    for (var i = 0; i <= seg; i++) { var a = i / seg * PI * 2; v.push(Math.sin(a), 0, Math.cos(a), 0, 1, 0, 0); }
    for (i = 1; i <= seg; i++) idx.push(0, i, i + 1);
    return finish(v, idx);
  }
  var MAKERS = {
    sph: function () { return lathe(sphereProf(14), 24); },
    sphLo: function () { return lathe(sphereProf(7), 12); },
    hemi: function () { return lathe([[0, 0], [1, 0], [1, 0]].concat(arcPts(0, 0, 1, 1, 0, PI / 2, 8)), 24); },
    cyl: function () { return lathe([[0, 0], [1, 0], [1, 0], [1, 1], [1, 1], [0, 1]], 22); },
    cone: function () { return lathe([[0, 0], [1, 0], [1, 0], [0, 1]], 20); },
    box: box, disc: function () { return disc(28); },
    ring: function () { return torus(1, .22, PI * 2, 28, 10); },
    arc: function () { return torus(1, .2, PI, 14, 8); }
  };
  function geo(key, fn) { if (!GEO[key]) GEO[key] = fn ? fn() : MAKERS[key](); return GEO[key]; }

  /* ---------------- tiny matrix kit (column-major) ---------------- */
  function m4() { var m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; }
  function mul(o, a, b) {
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7], a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    for (var i = 0; i < 4; i++) { var b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
      o[i * 4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30; o[i * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
      o[i * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32; o[i * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33; }
    return o;
  }
  /* local = T * Ry * Rx * Rz * S */
  function compose(o, p, r, s) {
    var cx = Math.cos(r[0]), sx = Math.sin(r[0]), cy = Math.cos(r[1]), sy = Math.sin(r[1]), cz = Math.cos(r[2]), sz = Math.sin(r[2]);
    var m00 = cy * cz + sy * sx * sz, m01 = cx * sz, m02 = -sy * cz + cy * sx * sz;
    var m10 = -cy * sz + sy * sx * cz, m11 = cx * cz, m12 = sy * sz + cy * sx * cz;
    var m20 = sy * cx, m21 = -sx, m22 = cy * cx;
    o[0] = m00 * s[0]; o[1] = m01 * s[0]; o[2] = m02 * s[0]; o[3] = 0;
    o[4] = m10 * s[1]; o[5] = m11 * s[1]; o[6] = m12 * s[1]; o[7] = 0;
    o[8] = m20 * s[2]; o[9] = m21 * s[2]; o[10] = m22 * s[2]; o[11] = 0;
    o[12] = p[0]; o[13] = p[1]; o[14] = p[2]; o[15] = 1; return o;
  }
  function normalMat(o, m) { // inverse-transpose of upper 3x3
    var a = m[0], b = m[1], c = m[2], d = m[4], e = m[5], f = m[6], gg = m[8], h = m[9], k = m[10];
    var A = e * k - f * h, B = -(d * k - f * gg), C = d * h - e * gg, det = a * A + b * B + c * C || 1e-9, id = 1 / det;
    o[0] = A * id; o[1] = B * id; o[2] = C * id;
    o[3] = -(b * k - c * h) * id; o[4] = (a * k - c * gg) * id; o[5] = -(a * h - b * gg) * id;
    o[6] = (b * f - c * e) * id; o[7] = -(a * f - c * d) * id; o[8] = (a * e - b * d) * id; return o;
  }
  function hex(h) { h = h.replace('#', ''); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; var n = parseInt(h, 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }

  /* ---------------- scene graph ---------------- */
  function Node(mesh, color, o) {
    o = o || {}; this.mesh = mesh || null; this.c = color ? (typeof color === 'string' ? hex(color) : color) : [1, 1, 1];
    this.p = [0, 0, 0]; this.r = [0, 0, 0]; this.s = [1, 1, 1]; this.kids = []; this.vis = true; this.parent = null;
    this.e = o.e || 0; this.spec = o.spec != null ? o.spec : .35; this.shin = o.shin || 28; this.a = o.a != null ? o.a : 1; this.mode = o.mode || 0;
    this.L = m4(); this.W = m4(); this.dark = 0;
  }
  Node.prototype.add = function (n) { if (n.parent) n.parent.remove(n); n.parent = this; this.kids.push(n); return n; };
  Node.prototype.remove = function (n) { var i = this.kids.indexOf(n); if (i >= 0) this.kids.splice(i, 1); n.parent = null; return n; };
  Node.prototype.at = function (x, y, z) { this.p[0] = x; this.p[1] = y; this.p[2] = z || 0; return this; };
  Node.prototype.sc = function (x, y, z) { this.s[0] = x; this.s[1] = y == null ? x : y; this.s[2] = z == null ? x : z; return this; };
  Node.prototype.rot = function (x, y, z) { this.r[0] = x || 0; this.r[1] = y || 0; this.r[2] = z || 0; return this; };
  Node.prototype.col = function (c) { this.c = typeof c === 'string' ? hex(c) : c; return this; };

  /* ---------------- renderer (one per WebGL context) ---------------- */
  var VS = 'attribute vec3 aP;attribute vec3 aN;attribute float aA;uniform mat4 uVP,uM;uniform mat3 uNM;varying vec3 vN,vW;varying float vA;' +
    'void main(){vec4 w=uM*vec4(aP,1.);vW=w.xyz;vN=uNM*aN;vA=aA;gl_Position=uVP*w;}';
  var FS = 'precision mediump float;uniform vec3 uC,uEye;uniform float uE,uSp,uSh,uAl,uMode,uDk;varying vec3 vN,vW;varying float vA;' +
    'void main(){' +
    ' if(uMode>.5){float a=uAl*vA;gl_FragColor=vec4(uC*a,a);return;}' +
    ' vec3 n=normalize(vN);vec3 v=normalize(uEye-vW);if(dot(n,v)<0.)n=-n;' +
    ' vec3 L=normalize(vec3(-.42,.78,.62));float d=dot(n,L);float dif=smoothstep(-.35,.95,d);' +
    ' float d2=max(dot(n,normalize(vec3(.75,.1,.55))),0.);' +
    ' vec3 hemi=mix(vec3(.33,.24,.46),vec3(1.,.97,1.05),n.y*.5+.5);' +
    ' float sp=pow(max(dot(n,normalize(L+v)),0.),uSh)*uSp;' +
    ' float fr=pow(1.-max(dot(n,v),0.),2.4);' +
    ' vec3 base=uC*(1.-uDk*.85);' +
    ' vec3 col=base*(hemi*.46+dif*vec3(1.,.96,.92)*.72+d2*vec3(.45,.75,1.)*.16)+sp*(1.-uDk*.7)+fr*vec3(.66,.5,1.)*.38*(1.-uDk)+uC*uE;' +
    ' col=mix(vec3(dot(col,vec3(.299,.587,.114))),col,1.18);col=(col-.5)*1.05+.5;' +  /* saturated, punchy look (matches the intro grade) */
    ' gl_FragColor=vec4(col*uAl,uAl);}';

  function Renderer(canvas, opts) {
    opts = opts || {}; this.cv = canvas;
    var gl = this.gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: !!opts.preserve, powerPreference: 'high-performance' });
    if (!gl) return;
    function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; }
    var p = this.prog = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { this.gl = null; return; }
    gl.useProgram(p); var U = this.U = {};
    ['uVP', 'uM', 'uNM', 'uC', 'uEye', 'uE', 'uSp', 'uSh', 'uAl', 'uMode', 'uDk'].forEach(function (n) { U[n] = gl.getUniformLocation(p, n); });
    this.aP = gl.getAttribLocation(p, 'aP'); this.aN = gl.getAttribLocation(p, 'aN'); this.aA = gl.getAttribLocation(p, 'aA');
    gl.enableVertexAttribArray(this.aP); gl.enableVertexAttribArray(this.aN); gl.enableVertexAttribArray(this.aA);
    this.buf = {}; this.VP = m4(); this.nm = new Float32Array(9); this.tmp = m4(); this.list = []; this.tlist = [];
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }
  Renderer.prototype.ok = function () { return !!this.gl; };
  Renderer.prototype.bind = function (key) {
    var gl = this.gl, b = this.buf[key];
    if (!b) { var G = GEO[key] || geo(key); b = this.buf[key] = { v: gl.createBuffer(), i: gl.createBuffer(), n: G.i.length };
      gl.bindBuffer(gl.ARRAY_BUFFER, b.v); gl.bufferData(gl.ARRAY_BUFFER, G.v, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.i); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, G.i, gl.STATIC_DRAW); }
    if (this.cur !== key) { this.cur = key; gl.bindBuffer(gl.ARRAY_BUFFER, b.v); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.i);
      gl.vertexAttribPointer(this.aP, 3, gl.FLOAT, false, 28, 0); gl.vertexAttribPointer(this.aN, 3, gl.FLOAT, false, 28, 12); gl.vertexAttribPointer(this.aA, 1, gl.FLOAT, false, 28, 24); }
    return b;
  };
  /* camera: CSS-pixel world, y up, origin top-left of the viewport (or a custom view rect) */
  Renderer.prototype.begin = function (cssW, cssH, dpr) {
    var gl = this.gl, w = Math.round(cssW * dpr), h = Math.round(cssH * dpr);
    if (this.cv.width !== w || this.cv.height !== h) { this.cv.width = w; this.cv.height = h; }
    gl.viewport(0, 0, w, h); gl.disable(gl.SCISSOR_TEST); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    var fov = 28 * PI / 180, D = (cssH / 2) / Math.tan(fov / 2), near = Math.max(10, D - 2600), far = D + 2600, a = cssW / cssH, f = 1 / Math.tan(fov / 2), P = new Float32Array(16);
    P[0] = f / a; P[5] = f; P[10] = (far + near) / (near - far); P[11] = -1; P[14] = 2 * far * near / (near - far);
    var V = m4(); V[12] = -cssW / 2; V[13] = cssH / 2; V[14] = -D;
    mul(this.VP, P, V); this.eye = [cssW / 2, -cssH / 2, D]; this.cssW = cssW; this.cssH = cssH; this.dpr = dpr; this.cur = null;
    gl.uniformMatrix4fv(this.U.uVP, false, this.VP); gl.uniform3fv(this.U.uEye, this.eye);
  };
  Renderer.prototype.collect = function (n, parentW, dark) {
    if (!n.vis) return;
    compose(n.L, n.p, n.r, n.s); if (parentW) mul(n.W, parentW, n.L); else n.W.set(n.L);
    var dk = Math.max(dark || 0, n.dark || 0);
    if (n.mesh) (n.a < 1 || n.mode ? this.tlist : this.list).push([n, dk]);
    for (var i = 0; i < n.kids.length; i++) this.collect(n.kids[i], n.W, dk);
  };
  Renderer.prototype.draw = function (root, scissor) {
    var gl = this.gl, U = this.U; if (!gl) return;
    this.list.length = 0; this.tlist.length = 0; this.collect(root, null, 0);
    if (scissor) { gl.enable(gl.SCISSOR_TEST); var d = this.dpr; gl.scissor(Math.round(scissor[0] * d), Math.round((this.cssH - scissor[1] - scissor[3]) * d), Math.max(0, Math.round(scissor[2] * d)), Math.max(0, Math.round(scissor[3] * d))); }
    else gl.disable(gl.SCISSOR_TEST);
    var self = this;
    function one(it) { var n = it[0], b = self.bind(n.mesh);
      gl.uniformMatrix4fv(U.uM, false, n.W); gl.uniformMatrix3fv(U.uNM, false, normalMat(self.nm, n.W));
      gl.uniform3fv(U.uC, n.c); gl.uniform1f(U.uE, n.e); gl.uniform1f(U.uSp, n.spec); gl.uniform1f(U.uSh, n.shin); gl.uniform1f(U.uAl, n.a); gl.uniform1f(U.uMode, n.mode); gl.uniform1f(U.uDk, it[1]);
      gl.drawElements(gl.TRIANGLES, b.n, gl.UNSIGNED_SHORT, 0); }
    gl.disable(gl.BLEND); gl.depthMask(true); this.list.forEach(one);
    if (this.tlist.length) { gl.enable(gl.BLEND); gl.depthMask(false); this.tlist.forEach(one); gl.depthMask(true); gl.disable(gl.BLEND); }
  };

  g.Toy3D = { Node: Node, Renderer: Renderer, geo: geo, lathe: lathe, blobProf: blobProf, capsuleDown: capsuleDown, torus: torus, arcPts: arcPts, hex: hex, PI: PI };
})(window);
