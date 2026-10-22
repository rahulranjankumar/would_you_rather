/* =====================================================================
   1) JELLY — one seamless SDF-merged gel body (body+arms+legs), trapped bubbles,
      soft-skinned limbs (CPU deform) so they can animate without seams
   ===================================================================== */
function makeJelly(){
  const root=new T.Group(), body=new T.Group(); root.add(body);
  const S=SDF;
  const limbsDef = {
    armL:{a:[-0.47,0.86,0.04], b:[-0.64,0.64,0.10], c:[-0.69,0.44,0.15], r:[0.13,0.11,0.10]},
    armR:{a:[ 0.47,0.84,0.04], b:[ 0.61,0.62,0.10], c:[ 0.64,0.45,0.15], r:[0.12,0.105,0.095]},
    legL:{a:[-0.22,0.42,0.02], b:[-0.36,0.25,0.07], c:[-0.45,0.17,0.12], r:[0.15,0.13,0.12]},
    legR:{a:[ 0.20,0.42,0.02], b:[ 0.22,0.22,0.03], c:[ 0.23,0.10,0.05], r:[0.15,0.135,0.13]},
  };
  const f=(x,y,z)=>{
    // slight lean
    const lx = x + (y-0.5)*0.05;
    let d = S.smin(S.ell(lx,y,z, 0,1.1,0, 0.47,0.5,0.42), S.ell(lx,y,z, 0,0.76,0.02, 0.56,0.45,0.46), 0.3);
    d += 0.006*Math.sin(x*14+y*9)*Math.cos(z*11+y*5);
    for (const k in limbsDef){ const L=limbsDef[k];
      const dl = Math.min(S.cap(x,y,z,L.a,L.b,L.r[0],L.r[1]), S.cap(x,y,z,L.b,L.c,L.r[1],L.r[2]));
      d = S.smin(d, dl, 0.12); }
    // flared feet
    d = S.smin(d, S.ell(x,y,z, -0.48,0.115,0.16, 0.12,0.065,0.16), 0.07);
    d = S.smin(d, S.ell(x,y,z,  0.24,0.06,0.09, 0.15,0.06,0.18), 0.07);
    // hand blobs
    d = S.smin(d, S.ell(x,y,z, -0.71,0.4,0.16, 0.1,0.11,0.09), 0.05);
    d = S.smin(d, S.ell(x,y,z,  0.66,0.41,0.15, 0.095,0.105,0.085), 0.05);
    return Math.max(d, -y);           // flat on floor
  };
  const geo = surfaceNets(f, [-0.95,-0.03,-0.62], [0.95,1.65,0.68], 0.026);

  const look = { uTint:{value:new T.Color(0.08,0.55,0.78)}, uRimTint:{value:new T.Color(0.4,0.92,1.0)}, uInTint:{value:new T.Color(0.02,0.3,0.45)}, uSoot:{value:0}, uSpike:{value:0}, uWet:{value:0}, uFrizz:{value:0} };
  const spikeV = s=>{ Object.assign(s.uniforms,{uSpike:look.uSpike}); s.vertexShader='uniform float uSpike;\n'+s.vertexShader.replace('#include <begin_vertex>',
    `vec3 transformed = position + normal * uSpike * 0.055 * max(0.0, sin(position.x*41.0)*sin(position.y*37.0)*sin(position.z*43.0)*1.6+0.2);`); };
  const gel = phys({color:0x1fc8ff, roughness:0.03, transparent:true, depthWrite:false, clearcoat:1, clearcoatRoughness:0.02, envMapIntensity:2.6});
  gel.onBeforeCompile=s=>{ spikeV(s); Object.assign(s.uniforms,{uTint:look.uTint,uRimTint:look.uRimTint,uSoot:look.uSoot}); s.fragmentShader='uniform vec3 uTint, uRimTint;\nuniform float uSoot;\n'+s.fragmentShader.replace('#include <dithering_fragment>',
    `#include <dithering_fragment>
     float fz=abs(dot(normalize(vNormal),vec3(0.0,0.0,1.0)));
     float fr=pow(1.0-fz,1.8);
     gl_FragColor.rgb = gl_FragColor.rgb*0.85 + uRimTint*fr*1.0 + uTint*0.55;
     gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.16,0.17,0.18)*(0.6+0.4*fr), uSoot*0.85);
     gl_FragColor.a = mix(0.32,0.97,fr);`); };
  const gelIn = phys({color:0x007aa8, roughness:0.2, transparent:true, depthWrite:false, side:T.BackSide, envMapIntensity:0.6});
  gelIn.onBeforeCompile=s=>{ spikeV(s); Object.assign(s.uniforms,{uInTint:look.uInTint,uSoot:look.uSoot}); s.fragmentShader='uniform vec3 uInTint;\nuniform float uSoot;\n'+s.fragmentShader.replace('#include <dithering_fragment>',
    `#include <dithering_fragment>
     gl_FragColor.rgb = mix(gl_FragColor.rgb*0.5 + uInTint, vec3(0.12), uSoot*0.8);
     gl_FragColor.a = 0.42;`); };
  const front=new T.Mesh(geo,gel); front.renderOrder=40;
  const back=new T.Mesh(geo,gelIn); back.renderOrder=20;
  const bm=new T.Group(); bm.add(back,front); body.add(bm);

  // bubbles inside the volume, faint rim highlight
  const bub = phys({color:0xe9fdff, roughness:0.02, clearcoat:1, transparent:true, depthWrite:false, envMapIntensity:3});
  bub.onBeforeCompile=s=>{ s.fragmentShader=s.fragmentShader.replace('#include <dithering_fragment>',
    `#include <dithering_fragment>
     float fr=pow(1.0-abs(dot(normalize(vNormal),vec3(0.0,0.0,1.0))),2.0);
     gl_FragColor.rgb += vec3(0.6,0.95,1.0)*fr*0.6;
     gl_FragColor.a = mix(0.08,0.85,fr);`); };
  let placed=0, tries=0;
  while (placed<40 && tries<4000){ tries++;
    const r=Math.pow(Math.random(),2.4)*0.05+0.008;
    const x=rnd(-0.5,0.5), y=rnd(0.45,1.45), z=rnd(-0.35,0.42);
    if (f(x,y,z) < -(r+0.035)){ const b=sph(r,bub,18); b.position.set(x,y,z); b.renderOrder=30; bm.add(b); placed++; }
  }

  // face sits on the front surface
  const zs=(x,y)=>{ let lo=0, hi=0.8; for(let i=0;i<30;i++){ const m=(lo+hi)/2; if (f(x,y,m)<0) lo=m; else hi=m; } return lo; };
  const face=new T.Group(); face.position.set(0,1.16,0); body.add(face);
  const eyes=[];
  for (const s of [-1,1]){ const e=realEye(0.046); e.position.set(0.125*s, 0.0, zs(0.125*s,1.16)-0.012); face.add(e); eyes.push(e); }
  const mz=zs(0,1.07);
  const mouthM=stdMat(0x06222e,0.3);
  const mouth=tubeArc([[-0.075,-0.075,mz-0.004],[0,-0.112,mz+0.006],[0.075,-0.075,mz-0.004]],0.009,mouthM); face.add(mouth);
  const mouthWide=tubeArc([[-0.1,-0.06,mz-0.01],[0,-0.135,mz+0.008],[0.1,-0.06,mz-0.01]],0.011,mouthM); mouthWide.visible=false; face.add(mouthWide);
  const mouthO=new T.Mesh(new T.TorusGeometry(0.03,0.008,10,24),mouthM); mouthO.position.set(0,-0.09,mz); mouthO.visible=false; face.add(mouthO);

  // soft-skin deformer: each limb = virtual joint that bends its region of the merged mesh
  const pA=geo.attributes.position, nA=geo.attributes.normal, P0=pA.array.slice(), N0=nA.array.slice(), nv=pA.count;
  const rig={};
  for (const k in limbsDef){ const L=limbsDef[k];
    const piv=new T.Vector3(...L.a), end=new T.Vector3(...L.c), dir=end.clone().sub(piv), len=dir.length(); dir.normalize();
    const w=new Float32Array(nv), v=new T.Vector3();
    for (let i=0;i<nv;i++){ v.set(P0[i*3],P0[i*3+1],P0[i*3+2]);
      const proj=v.clone().sub(piv).dot(dir)/len;
      const dist=v.clone().sub(piv).sub(dir.clone().multiplyScalar(Math.max(0,Math.min(1,proj))*len)).length();
      w[i]=sstep(-0.1,0.35,proj)*(1-sstep(L.r[0]+0.05,L.r[0]+0.16,dist)); }
    const j={root:new T.Object3D(), mid:new T.Object3D(), rest:{rz:0,rx:0,mz:0,mx:0,ry:0}, piv, w, dir:dir.clone(), len, tip:new T.Vector3(...L.c)};
    rig[k]=j;
  }
  const q=new T.Quaternion(), e=new T.Euler(), tv=new T.Vector3(), tn=new T.Vector3(), I=new T.Quaternion(), full=new T.Quaternion();
  const lastR=new Float32Array(8).fill(9);
  function deform(force){
    let k0=0, ch=0; for (const k in rig){ const r=rig[k].root.rotation; ch=Math.max(ch,Math.abs(r.x-lastR[k0]),Math.abs(r.z-lastR[k0+1])); lastR[k0]=r.x; lastR[k0+1]=r.z; k0+=2; }
    if (ch<1e-4 && !force) return false;
    const arr=pA.array, narr=nA.array; arr.set(P0); narr.set(N0);
    for (const k in rig){ const j=rig[k]; e.set(j.root.rotation.x, 0, j.root.rotation.z); if (Math.abs(e.x)+Math.abs(e.z)<1e-4) continue;
      full.setFromEuler(e);
      for (let i=0;i<nv;i++){ const w=j.w[i]; if (w<0.002) continue;
        q.copy(I).slerp(full,w);
        tv.set(arr[i*3]-j.piv.x, arr[i*3+1]-j.piv.y, arr[i*3+2]-j.piv.z).applyQuaternion(q).add(j.piv);
        arr[i*3]=tv.x; arr[i*3+1]=tv.y; arr[i*3+2]=tv.z;
        tn.set(narr[i*3],narr[i*3+1],narr[i*3+2]).applyQuaternion(q); narr[i*3]=tn.x; narr[i*3+1]=tn.y; narr[i*3+2]=tn.z; }
    }
    pA.needsUpdate=true; nA.needsUpdate=true; return true;
  }
  root.userData={kind:'jelly',head:face,body,bodyMesh:bm,rig,eyes,deform,face:{mouth,mouthWide,mouthO},gel,gelIn,look};
  makeSockets(root);
  return root;
}

/* =====================================================================
   2) ASTRONAUT — chunky premium toy: big helmet (≈38% height), amber glass visor with
      glowing inner smiley, panel plates + grooves + rivets, rubber bellows joints
   ===================================================================== */
function makeAstronaut(){
  const root=new T.Group(), body=new T.Group(); root.add(body);
  const suit=phys({color:0xf5f6f8, roughness:0.26, metalness:0.04, clearcoat:1, clearcoatRoughness:0.15});
  const plateM=phys({color:0xfbfbfc, roughness:0.2, metalness:0.03, clearcoat:1, clearcoatRoughness:0.08});
  const groove=stdMat(0x3a3f47,0.6,0.2);
  const rubber=stdMat(0x5b616b,0.72,0.05);
  const metal=phys({color:0xa3aab4, roughness:0.25, metalness:0.85, clearcoat:0.6});
  const S=g=>new T.Mesh(g,suit);
  const bellows=(par,r,n,y0,step=0.028)=>{ for(let i=0;i<n;i++){ const m=new T.Mesh(new T.TorusGeometry(r,0.017,12,36),rubber); m.rotation.x=Math.PI/2; m.position.y=y0-i*step; par.add(m);} };
  const rivet=(par,x,y,z)=>par.add(at(sph(0.011,metal,10),x,y,z));
  // rounded plate with groove outline (dark plate slightly larger behind)
  const rr=(w,h,r)=>{ const s=new T.Shape(), x=-w/2,y=-h/2; s.moveTo(x+r,y); s.lineTo(x+w-r,y); s.quadraticCurveTo(x+w,y,x+w,y+r); s.lineTo(x+w,y+h-r); s.quadraticCurveTo(x+w,y+h,x+w-r,y+h); s.lineTo(x+r,y+h); s.quadraticCurveTo(x,y+h,x,y+h-r); s.lineTo(x,y+r); s.quadraticCurveTo(x,y,x+r,y); return s; };
  const hex=(r)=>{ const s=new T.Shape(); for(let i=0;i<6;i++){ const a=i*Math.PI/3+Math.PI/6; i?s.lineTo(Math.cos(a)*r,Math.sin(a)*r):s.moveTo(Math.cos(a)*r,Math.sin(a)*r);} s.closePath(); return s; };
  const plate=(shape,shapeOut,depth=0.014)=>{ const g=new T.Group();
    const a=new T.Mesh(new T.ExtrudeGeometry(shape,{depth, bevelEnabled:true, bevelThickness:0.006, bevelSize:0.006, bevelSegments:3, curveSegments:10}),plateM);
    const b=new T.Mesh(new T.ExtrudeGeometry(shapeOut,{depth:depth*0.6, bevelEnabled:false, curveSegments:10}),groove); b.position.z=-0.004;
    g.add(b,a); return g; };

  // torso (rounded barrel) + pelvis
  const torso=S(seg(0.4,0.235,0.205,48)); torso.position.y=1.02; torso.scale.z=0.86; body.add(torso);
  const pelvis=sph(0.2,suit,40); pelvis.scale.set(1.08,0.62,0.9); pelvis.position.y=0.58; body.add(pelvis);
  const belt=new T.Mesh(new T.TorusGeometry(0.205,0.026,14,48),rubber); belt.rotation.x=Math.PI/2; belt.scale.y=0.86; belt.position.y=0.66; body.add(belt);
  // chest plate + control box with 3 dots
  const chest=plate(rr(0.26,0.16,0.035), rr(0.272,0.172,0.04)); chest.position.set(0,0.9,0.168); chest.rotation.x=-0.18; body.add(chest);
  const box=new T.Mesh(new T.ExtrudeGeometry(rr(0.13,0.07,0.015),{depth:0.025,bevelEnabled:true,bevelThickness:0.005,bevelSize:0.005,bevelSegments:2}),suit);
  box.position.set(0,0.905,0.192); box.rotation.x=-0.18; body.add(box);
  [0x2fd5ff,0xff4747,0xffcf2e].forEach((c,i)=>body.add(at(sph(0.012,new T.MeshBasicMaterial({color:c,toneMapped:false}),10),-0.035+i*0.035,0.912,0.222)));
  [[-0.11,0.95],[0.11,0.95],[-0.11,0.85],[0.11,0.85]].forEach(([x,y])=>rivet(body,x,y,0.198-Math.abs(y-0.9)*0.2));
  // belly hex panels
  [[0,0.765],[-0.062,0.73],[0.062,0.73],[0,0.695]].forEach(([x,y])=>{ const h=plate(hex(0.033),hex(0.039),0.008); h.position.set(x,y,0.175); h.rotation.set(-0.05, x*1.8, 0); body.add(h); });
  // backpack
  const pack=new T.Mesh(new T.ExtrudeGeometry(rr(0.34,0.38,0.06),{depth:0.14,bevelEnabled:true,bevelThickness:0.02,bevelSize:0.02,bevelSegments:4}),suit);
  pack.position.set(0,0.86,-0.36); body.add(pack);
  rivet(body,-0.13,1.0,-0.205); rivet(body,0.13,1.0,-0.205);

  // helmet ------------------------------------------------------------
  const head=new T.Group(); head.position.y=1.37; body.add(head);
  bellows(head,0.15,3,-0.27,0.026);
  const shell=sph(0.35,suit,72); shell.scale.set(1,0.95,0.96); head.add(shell);
  const rim=new T.Mesh(new T.TorusGeometry(0.235,0.045,24,72),suit); rim.scale.set(1.12,0.86,1); rim.position.set(0,-0.01,0.29); head.add(rim);
  const rimIn=new T.Mesh(new T.TorusGeometry(0.205,0.012,12,64),metal); rimIn.scale.set(1.12,0.86,1); rimIn.position.set(0,-0.01,0.315); head.add(rimIn);
  // inner glowing face screen
  const screenTex=radialTex([[0,'#ffbf4d'],[0.45,'#f08a14'],[0.85,'#8a3a03'],[1,'#3a1400']],256);
  const sg=new T.SphereGeometry(1,48,32); sg.rotateX(Math.PI/2);
  const screen=new T.Mesh(sg,new T.MeshBasicMaterial({map:screenTex})); screen.scale.set(0.235,0.18,0.08); screen.position.set(0,-0.01,0.27); head.add(screen);
  const faceM=new T.MeshBasicMaterial({color:0x6b2a00});
  const innerFace=new T.Group(); innerFace.position.set(0,-0.01,0.346); head.add(innerFace);
  const ie=[]; for (const s of [-1,1]){ const d=sph(0.021,faceM,16); d.scale.z=0.4; d.position.set(0.07*s,0.025,0); innerFace.add(d); ie.push(d); }
  const smile=tubeArc([[-0.04,-0.035,0],[0,-0.058,0.004],[0.04,-0.035,0]],0.007,faceM); innerFace.add(smile);
  const smileO=new T.Mesh(new T.TorusGeometry(0.018,0.006,8,20),faceM); smileO.position.set(0,-0.045,0); smileO.visible=false; innerFace.add(smileO);
  const carets=[]; for (const s of [-1,1]){ const c=tubeArc([[0.07*s-0.02,0.015,0],[0.07*s,0.04,0.002],[0.07*s+0.02,0.015,0]],0.006,faceM); c.visible=false; innerFace.add(c); carets.push(c); }
  // glass visor (amber, glossy)
  const visor=sph(1,phys({color:0xffa52e, metalness:0.15, roughness:0.02, clearcoat:1, clearcoatRoughness:0.0, transparent:true, opacity:0.42, envMapIntensity:3, depthWrite:false}),64);
  visor.scale.set(0.245,0.19,0.115); visor.position.set(0,-0.01,0.272); visor.renderOrder=50; head.add(visor);
  // ear pods with concentric rings
  for (const s of [-1,1]){ const pod=new T.Group(); pod.position.x=0.335*s; pod.rotation.z=Math.PI/2*s; head.add(pod);
    const disc=new T.Mesh(new T.CylinderGeometry(0.095,0.1,0.06,40),suit); pod.add(disc);
    [0.075,0.055,0.035].forEach((r,i)=>{ const t=new T.Mesh(new T.TorusGeometry(r,0.006,8,40),i%2?metal:groove); t.rotation.x=Math.PI/2; t.position.y=-0.031*s*-1; pod.add(t); });
    const cap=new T.Mesh(new T.CylinderGeometry(0.018,0.018,0.012,20),metal); cap.position.y=0.034; pod.add(cap);
  }
  rivet(head,-0.12,0.24,0.25); rivet(head,0.12,0.24,0.25); rivet(head,0,0.3,0.2);

  // arms ---------------------------------------------------------------
  const glove=e=>{ bellows(e,0.058,1,0.015); const g=sph(0.068,suit,28); g.scale.set(1,1.1,0.9); g.position.y=-0.06; e.add(g);
    const th=sph(0.028,suit,16); th.position.set(0,-0.035,0.06); e.add(th); };
  const mkArm=s=>{ const L=limb(body,[0.3*s,0.99,0],{l1:0.15,r1:[0.082,0.074],l2:0.14,r2:[0.074,0.068],mk:S,end:glove});
    const pad=sph(0.105,suit,32); pad.scale.set(1,0.9,1); L.root.add(pad); bellows(L.root,0.08,2,-0.06);
    bellows(L.mid,0.074,2,0.01);
    const ap=new T.Mesh(new T.CylinderGeometry(0.083,0.083,0.07,24,1,true,-0.7,1.4),plateM); ap.material.side=T.DoubleSide; ap.position.y=-0.075; L.mid.add(ap);
    return L; };
  const armL=pose(mkArm(-1),-0.16,0.05,-0.08,-0.15);
  const armR=pose(mkArm(1),0.95,-0.55,0.0,-0.55);
  // legs ---------------------------------------------------------------
  const boot=e=>{ const b=sph(0.112,suit,32); b.scale.set(1,0.62,1.45); b.position.set(0,-0.075,0.04); e.add(b);
    const so=new T.Mesh(new T.CylinderGeometry(0.106,0.11,0.035,32),groove); so.scale.z=1.45; so.position.set(0,-0.128,0.04); e.add(so);
    bellows(e,0.085,1,0.0); };
  const mkLeg=s=>{ const L=limb(body,[0.11*s,0.52,0],{l1:0.18,r1:[0.1,0.092],l2:0.18,r2:[0.09,0.095],mk:S,end:boot});
    bellows(L.root,0.098,2,-0.01); bellows(L.mid,0.09,2,0.01);
    const tp=new T.Mesh(new T.CylinderGeometry(0.104,0.1,0.1,24,1,true,-0.75,1.5),plateM); tp.material.side=T.DoubleSide; tp.position.y=-0.1; L.root.add(tp);
    const sp=new T.Mesh(new T.CylinderGeometry(0.1,0.106,0.1,24,1,true,-0.75,1.5),plateM); sp.material.side=T.DoubleSide; sp.position.y=-0.1; L.mid.add(sp);
    rivet(L.root,0.05,-0.06,0.09); rivet(L.mid,-0.05,-0.06,0.09);
    return L; };
  const legL=pose(mkLeg(-1),-0.03,0.04,0,-0.06);
  const legR=pose(mkLeg(1),0.03,-0.04,0,0.04);
  root.userData={kind:'astro',head,body,rig:{armL,armR,legL,legR},eyes:[],innerEyes:ie,innerFace,face:{smile,smileO,carets,faceM,screen,visor}};
  makeSockets(root);
  return root;
}

/* =====================================================================
   3) MUSE — chubby pear yeti, dense strand fur, big peach face in a hood opening
   ===================================================================== */
function makeMuse(){
  const root=new T.Group(), body=new T.Group(); root.add(body); const furU=furBegin();
  const cream=new T.Color(0xf6dcb0), root_=new T.Color(0xc48f58), tip=new T.Color(0xfff3de);
  const furCol=(v,n,c)=>{ c.copy(root_).lerp(cream,sstep(-0.8,0.4,n.y)*0.8+0.2).lerp(tip,Math.max(0,n.y)*0.35); c.offsetHSL(0,0,rnd(-0.02,0.02)); };
  const F={len:0.14,shells:32,density:[13,10],grav:0.05,curl:0.045,rim:0xfff0dc,rimK:0.55};

  // pear body
  const bg=ellipsoidGeo(0.5,1.0,1.0,0.86,96); { const p=bg.attributes.position;
    for (let i=0;i<p.count;i++){ const y=p.getY(i)/0.5, k=1+0.16*sstep(0.4,-0.9,y)-0.06*sstep(0.2,1,y); p.setX(i,p.getX(i)*k); p.setZ(i,p.getZ(i)*k); }
    bg.computeVertexNormals(); }
  const torso=furOf(furCol,F)(bg); torso.position.y=0.66; body.add(torso);

  // head with hood opening (fur length ramps to 0 inside face ellipse)
  const head=new T.Group(); head.position.set(0,1.24,0.02); body.add(head);
  const hg=ellipsoidGeo(0.44,1.04,0.98,0.92,96);
  { const p=hg.attributes.position; for(let i=0;i<p.count;i++){ const z=p.getZ(i); if (z>0) p.setZ(i,z*0.72); } hg.computeVertexNormals(); }
  const FW=0.235, FH=0.175, FY=-0.02;
  colorize(hg,furCol);
  { const p=hg.attributes.position, fl=new Float32Array(p.count);
    for (let i=0;i<p.count;i++){ const x=p.getX(i), y=p.getY(i), z=p.getZ(i);
      const e=Math.hypot(x/FW,(y-FY)/FH); fl[i]= z>0 ? sstep(0.92,1.3,e) : 1; }
    hg.setAttribute('flen', new T.BufferAttribute(fl,1)); }
  head.add(furMesh(hg,{...F,len:0.12}));
  // smooth peach face plate in the opening
  const faceZ=0.215;
  const face=new T.Mesh(ellipsoidGeo(1,FW*1.1,FH*1.1,0.09,48), phys({color:0xffd7b8, roughness:0.62, sheen:new T.Color(0x7a5a48), clearcoat:0.15}));
  face.position.set(0,FY,faceZ); head.add(face);
  const fz=(x,y)=>faceZ+0.09*Math.sqrt(Math.max(0,1-(x/FW)**2-((y-FY)/FH)**2));
  const eyes=[];
  for (const s of [-1,1]){ const e=realEye(0.036); e.position.set(0.1*s,0.008,fz(0.1,0.008)-0.016); head.add(e); eyes.push(e); }
  for (const s of [-1,1]){ const b=blush(0.058); b.position.set(0.155*s,-0.055,fz(0.155,-0.055)+0.004); b.rotation.y=0.55*s; head.add(b); }
  head.add(tubeArc([[-0.032,-0.052,fz(0.03,-0.05)],[0,-0.068,fz(0,-0.068)+0.004],[0.032,-0.052,fz(0.03,-0.05)]],0.0065,stdMat(0x3a2015,0.6)));

  // limbs
  const pawCol=(v,n,c)=>{ c.copy(cream).lerp(tip,0.25); c.offsetHSL(0,0,rnd(-0.02,0.02)); };
  const paw=(open)=>e=>{ const g=ellipsoidGeo(0.1,1.0,open?1.15:1.05,open?0.62:0.85,40); const p=furOf(pawCol,{len:0.045,shells:20,density:[7,7],grav:0.01,curl:0.02,rim:0xfff0dc,rimK:0.4})(g); p.position.y=-0.05; e.add(p); };
  const AF={len:0.065,shells:24,density:[8,10],grav:0.025,curl:0.022,rim:0xfff0dc,rimK:0.4};
  const mkArm=(s,open)=>limb(body,[0.47*s,1.0,0.04],{l1:0.14,r1:[0.12,0.11],l2:0.12,r2:[0.11,0.1],mk:furOf(furCol,AF),end:paw(open)});
  const armL=pose(mkArm(-1,false),-0.45,-0.25,-0.15,-0.2);
  const armR=pose(mkArm(1,true),2.15,0.15,0.3,0);
  const foot=e=>{ const g=ellipsoidGeo(0.13,1,0.58,1.3,40);
    const toes=[-1,0,1].map(i=>{ const t=ellipsoidGeo(0.042,1,0.85,1,16); t.translate(0.055*i,-0.01,0.155-Math.abs(i)*0.012); return t; });
    const m=mergeGeos([g,...toes]); const f=furOf(furCol,{len:0.035,shells:16,density:[7,6],rim:0xfff0dc,rimK:0.3})(m); f.position.set(0,-0.035,0.05); e.add(f); };
  const mkLeg=s=>limb(body,[0.21*s,0.32,0.04],{l1:0.12,r1:[0.15,0.14],l2:0.1,r2:[0.14,0.13],mk:furOf(furCol,{len:0.05,shells:18,density:[6,6],grav:0.02,curl:0.02,rim:0xfff0dc,rimK:0.3}),end:foot});
  const legL=pose(mkLeg(-1),0,0,0,0), legR=pose(mkLeg(1),0,0,0,0);
  const blushes=[]; head.traverse(o=>{ if (o.material && o.material.map===BLUSH) blushes.push(o); });
  root.userData={kind:'muse',head,body,rig:{armL,armR,legL,legR},eyes,furU,face:{blushes}};
  makeSockets(root);
  return root;
}

/* =====================================================================
   4) FOX — defined white snout & smile with tongue, big cream-lined ears,
      cheek tufts, deep→light orange gradient, huge white-tipped tail
   ===================================================================== */
function makeFox(){
  const root=new T.Group(), body=new T.Group(); root.add(body); const furU=furBegin();
  const deep=new T.Color(0xc2410c), mid=new T.Color(0xf05a14), light=new T.Color(0xff8c3a), white=new T.Color(0xfff6ec), dark=new T.Color(0x2e1206), cream=new T.Color(0xffe9cf);
  const orangeAt=(n)=>{ const c=deep.clone().lerp(mid,sstep(-0.9,0.0,n.z)); return c.lerp(light,sstep(0.4,0.95,Math.abs(n.x))*0.6*sstep(-0.3,0.4,n.z)); };
  // torso
  const tg=ellipsoidGeo(0.36,1.05,1.15,0.92,72);
  colorize(tg,(v,n,c)=>{ const belly=sstep(0.15,0.75,n.z)*(1-sstep(0.18,0.4,v.y))*(1-sstep(0.45,0.85,Math.abs(n.x)));
    c.copy(orangeAt(n)).lerp(white,belly); c.offsetHSL(0,0,rnd(-0.02,0.02)); });
  body.add(at(furMesh(tg,{len:0.06,shells:26,density:[12,10],grav:0.02,curl:0.016,rim:0xffb070,rimK:0.45}),0,0.55,0));

  // head + snout merged
  const head=new T.Group(); head.position.set(0,1.1,0.05); head.scale.setScalar(1.12); body.add(head);
  const hg=new T.SphereGeometry(0.34,80,60); { const hp=hg.attributes.position, v=new T.Vector3();
    for (let i=0;i<hp.count;i++){ v.fromBufferAttribute(hp,i);
      const cheek=Math.exp(-((v.y+0.08)**2)/0.012)*Math.max(0,Math.abs(v.x)/0.34)*0.06;
      const n=v.clone().normalize(); v.addScaledVector(n,cheek); v.x*=1.08; hp.setXYZ(i,v.x,v.y,v.z); }
    hg.computeVertexNormals(); }
  const sn=ellipsoidGeo(1,0.135,0.1,0.17,48); sn.translate(0,-0.1,0.27);
  colorize(hg,(v,n,c)=>{ const m=sstep(0.3,0.8,n.z)*sstep(0.0,0.14,-v.y);
    const ch=sstep(0.55,0.95,Math.abs(n.x))*sstep(-0.02,0.14,-v.y);
    c.copy(orangeAt(n)).lerp(white,Math.min(1,m+ch)); c.offsetHSL(0,0,rnd(-0.02,0.02)); });
  colorize(sn,(v,n,c)=>{ c.copy(white); c.offsetHSL(0,0,rnd(-0.015,0.015)); });
  head.add(furMesh(mergeGeos([hg,sn]),{len:0.04,shells:26,density:[14,11],grav:0.01,curl:0.012,rim:0xffb070,rimK:0.45}));
  // ears (+30%), cream fluffy inside, dark tips
  const ears=[];
  for (const s of [-1,1]){ const eg=new T.Group(); eg.position.set(0.2*s,0.3,-0.04); eg.rotation.z=-0.4*s; head.add(eg);
    const og=new T.ConeGeometry(0.17,0.4,40,14,false); og.scale(1,1,0.6); og.translate(0,0.16,0); og.computeVertexNormals();
    colorize(og,(v,n,c)=>{ c.copy(mid).lerp(dark,sstep(0.24,0.34,v.y)); });
    eg.add(furMesh(og,{len:0.02,shells:12,density:[8,8],rim:0xffb070}));
    const ig=new T.ConeGeometry(0.1,0.26,30,10,false); ig.scale(1,1,0.35); ig.translate(0,0.1,0.06); ig.computeVertexNormals();
    colorize(ig,(v,n,c)=>{ c.copy(cream); });
    eg.add(furMesh(ig,{len:0.045,shells:14,density:[6,9],grav:0.01,curl:0.02,rim:0xffffff}));
    ears.push(eg); }
  // cheek tufts
  for (const s of [-1,1]){ const cg=new T.ConeGeometry(0.075,0.18,24,6,false); cg.computeVertexNormals(); colorize(cg,(v,n,c)=>c.copy(white));
    const t=furMesh(cg,{len:0.025,shells:12,density:[5,6],rim:0xffffff}); t.position.set(0.37*s,-0.12,0.1); t.rotation.z=(Math.PI/2+0.5)*s; head.add(t); }
  // face: closed happy eyes, nose, upward smile + tongue
  const lineM=stdMat(0x1a0b05,0.4); const arcs=[], openEyes=[];
  for (const s of [-1,1]){ const a=tubeArc([[0.1*s-0.052,0.045,0.365],[0.1*s,0.08,0.382],[0.1*s+0.052,0.045,0.365]],0.011,lineM); head.add(a); arcs.push(a);
    const oe=realEye(0.042); oe.position.set(0.1*s,0.058,0.352); oe.visible=false; head.add(oe); openEyes.push(oe); }
  const nose=sph(0.036,phys({color:0x120806,roughness:0.12,clearcoat:1}),24); nose.scale.set(1.3,0.85,0.9); nose.position.set(0,-0.05,0.475); head.add(nose);
  head.add(tubeArc([[0,-0.075,0.47],[0,-0.1,0.465]],0.006,lineM));
  for (const s of [-1,1]) head.add(tubeArc([[0,-0.1,0.465],[0.03*s,-0.122,0.452],[0.062*s,-0.098,0.43]],0.0065,lineM));
  const tongue=sph(0.022,phys({color:0xff6f8a,roughness:0.35,clearcoat:0.6}),16); tongue.scale.set(1,0.6,0.5); tongue.position.set(-0.028,-0.13,0.448); head.add(tongue);
  for (const s of [-1,1]){ const b=blush(0.05); b.position.set(0.17*s,-0.035,0.335); b.rotation.y=0.55*s; head.add(b); }

  // tail — bigger, bushier, curving up behind
  const tailG=taperTube([[0.12,0.3,-0.22],[0.45,0.24,-0.34],[0.74,0.45,-0.3],[0.78,0.82,-0.2],[0.6,1.06,-0.12]],
    u=>0.07+0.2*Math.sin(Math.min(1,u*1.1)*Math.PI*0.88)*(1-0.45*u*u)+0.02, 36, 72);
  colorize(tailG,(v,n,c,i)=>{ const u=Math.floor(i/37)/72; c.copy(deep).lerp(mid,sstep(0,0.4,u)).lerp(white,sstep(0.72,0.84,u)); c.offsetHSL(0,0,rnd(-0.02,0.02)); });
  const tail=new T.Group(); tail.position.set(0.1,0.3,-0.2);
  const tf=furMesh(tailG,{len:0.08,shells:28,density:[6,16],grav:0.02,curl:0.03,rim:0xffb070,rimK:0.5}); tf.position.set(-0.1,-0.3,0.2); tail.add(tf); body.add(tail);

  // limbs — dark rounded paws
  const limbCol=(lenL)=>(v,n,c)=>{ c.copy(mid).lerp(deep,0.25).lerp(dark,sstep(lenL*0.45,lenL,-v.y)*0.9); c.offsetHSL(0,0,rnd(-0.02,0.02)); };
  const upCol=(v,n,c)=>{ c.copy(orangeAt(n)); c.offsetHSL(0,0,rnd(-0.02,0.02)); };
  const paw=e=>{ const g=ellipsoidGeo(0.078,1,1,0.92,32); colorize(g,(v,n,c)=>c.copy(dark)); const p=furMesh(g,{len:0.02,shells:12,density:[6,6],rim:0x8a4a2a}); p.position.y=-0.03; e.add(p); };
  const mkArm=s=>limb(body,[0.3*s,0.8,0.08],{l1:0.17,r1:[0.08,0.072],l2:0.16,r2:[0.072,0.066],
    mk:(g,part)=>furOf(part==='lower'?limbCol(0.16):upCol,{len:0.03,shells:16,density:[5,9],rim:0xffb070})(g),end:paw});
  const armL=pose(mkArm(-1),-2.45,-0.35,-0.25,0);
  const armR=pose(mkArm(1),0.3,-0.25,0.15,-0.45);
  const foot=e=>{ const g=ellipsoidGeo(0.1,1,0.65,1.4,28); colorize(g,(v,n,c)=>c.copy(dark).lerp(deep,0.2)); const f=furMesh(g,{len:0.025,shells:12,density:[6,5],rim:0x8a4a2a}); f.position.set(0,-0.02,0.05); e.add(f); };
  const mkLeg=s=>limb(body,[0.17*s,0.33,0.06],{l1:0.13,r1:[0.11,0.1],l2:0.11,r2:[0.095,0.085],
    mk:(g,part)=>furOf(part==='lower'?limbCol(0.11):upCol,{len:0.035,shells:16,density:[5,6],rim:0xffb070})(g),end:foot});
  const legL=pose(mkLeg(-1),0,0,0,0), legR=pose(mkLeg(1),0,0,0,0);
  const blushes=[]; head.traverse(o=>{ if (o.material && o.material.map===BLUSH) blushes.push(o); });
  root.userData={kind:'fox',head,body,rig:{armL,armR,legL,legR},tail,ears,eyes:[],furU,face:{arcs,openEyes,tongue,blushes}};
  makeSockets(root);
  return root;
}

/* =====================================================================
   SOCKETS — named attach points (handles only, no visuals)
   headTop face back belly seat chest handL handR footL footR tailTip inside visor
   ===================================================================== */
const SOCK_DEF = {
  jelly:{ headTop:['body',0,1.66,0], face:['head',0,0,0.47], back:['body',0,0.85,-0.42], belly:['body',0,0.72,0.45], seat:['body',0,1.62,0],
          chest:['body',0,0.95,0.44], inside:['bodyMesh',0,0.85,0.02], handL:['bodyMesh',-0.71,0.40,0.16], handR:['bodyMesh',0.66,0.41,0.15],
          footL:['bodyMesh',-0.48,0.08,0.16], footR:['bodyMesh',0.24,0.04,0.09] },
  astro:{ headTop:['head',0,0.34,0], face:['head',0,-0.01,0.37], visor:['head',0,-0.01,0.38], back:['body',0,0.9,-0.33], belly:['body',0,0.66,0.24],
          seat:['head',0,0.34,0], chest:['body',0,0.88,0.25] },
  muse: { headTop:['head',0,0.44,0], face:['head',0,-0.02,0.34], back:['body',0,0.85,-0.44], belly:['body',0,0.62,0.48], seat:['head',0,0.42,0],
          chest:['body',0,0.95,0.42] },
  fox:  { headTop:['head',0,0.34,0], face:['head',0,-0.04,0.48], back:['body',0,0.62,-0.3], belly:['body',0,0.5,0.34], seat:['head',0,0.34,0],
          chest:['body',0,0.72,0.3], tailTip:['tail',0.5,0.76,0.08] },
};
function makeSockets(root){
  const u=root.userData, def=SOCK_DEF[u.kind]; u.sock={};
  for (const n in def){ const [par,x,y,z]=def[n]; const o=new T.Object3D(); o.name='sock_'+n; o.position.set(x,y,z); u[par].add(o); u.sock[n]=o; }
  if (u.kind!=='jelly'){ for (const [n,l] of [['handL','armL'],['handR','armR'],['footL','legL'],['footR','legR']]){ const o=new T.Object3D(); o.name='sock_'+n; o.position.set(0,l.startsWith('arm')?-0.06:-0.03,0); u.rig[l].end.add(o); u.sock[n]=o; } }
  u.sockRest={}; for (const n in u.sock) u.sockRest[n]=u.sock[n].position.clone();
}

