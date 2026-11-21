(function(){
var cvs=document.getElementById('station3d');
if(!cvs)return;
var ctx=cvs.getContext('2d');
var W=0,H=0,DPR=1,CX=0,CY=0,SCALE=1;
var TAU=Math.PI*2,CAMZ=6.0,TILT=-0.34;

function resize(){
  DPR=Math.min(2,window.devicePixelRatio||1);
  var r=cvs.getBoundingClientRect();
  W=r.width||1;H=r.height||1;
  cvs.width=Math.round(W*DPR);cvs.height=Math.round(H*DPR);
  ctx.setTransform(DPR,0,0,DPR,0,0);
  CX=W*0.5;CY=H*0.52;
  SCALE=Math.min(W,H)*0.92;
}
window.addEventListener('resize',resize);

function rotY(p,a){var c=Math.cos(a),s=Math.sin(a);return [p[0]*c+p[2]*s,p[1],-p[0]*s+p[2]*c];}
function rotX(p,a){var c=Math.cos(a),s=Math.sin(a);return [p[0],p[1]*c-p[2]*s,p[1]*s+p[2]*c];}
function nrm(a,b,c){
  var u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],v=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
  var n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  var l=Math.sqrt(n[0]*n[0]+n[1]*n[1]+n[2]*n[2])||1;
  return [n[0]/l,n[1]/l,n[2]/l];
}

var faces=[],hotspots=[],panels=[];
function push(pts,col,o){
  o=o||{};
  faces.push({p:pts,c:col,a:o.a==null?1:o.a,em:o.em||0,bl:o.bl||0});
}

var HULL=[198,210,226], HULL2=[158,172,194], HULL3=[96,110,136];

function torusPt(u,v,R,r){
  var cx=R*Math.cos(u),cz=R*Math.sin(u),nx=Math.cos(u),nz=Math.sin(u),cv=Math.cos(v),sv=Math.sin(v);
  return [cx+nx*r*cv,r*sv,cz+nz*r*cv];
}
function buildTorus(R,r,N,M,c1,c2){
  for(var i=0;i<N;i++){
    var u0=i/N*TAU,u1=(i+1)/N*TAU;
    for(var j=0;j<M;j++){
      var v0=j/M*TAU,v1=(j+1)/M*TAU;
      var k=0.55+0.45*Math.cos(v0-0.5);
      var col=[c1[0]*k+c2[0]*(1-k),c1[1]*k+c2[1]*(1-k),c1[2]*k+c2[2]*(1-k)];
      push([torusPt(u0,v0,R,r),torusPt(u1,v0,R,r),torusPt(u1,v1,R,r),torusPt(u0,v1,R,r)],col,{});
    }
  }
}
function buildCyl(y0,y1,rad,K,c1,c2){
  for(var i=0;i<K;i++){
    var a0=i/K*TAU,a1=(i+1)/K*TAU;
    var sh=0.35+0.65*Math.max(0,Math.cos(a0-1.0));
    var col=[c1[0]*sh+c2[0]*(1-sh),c1[1]*sh+c2[1]*(1-sh),c1[2]*sh+c2[2]*(1-sh)];
    push([[rad*Math.cos(a0),y0,rad*Math.sin(a0)],[rad*Math.cos(a1),y0,rad*Math.sin(a1)],
          [rad*Math.cos(a1),y1,rad*Math.sin(a1)],[rad*Math.cos(a0),y1,rad*Math.sin(a0)]],col,{});
  }
  var top=[],bot=[];
  for(var k2=0;k2<K;k2++){
    var an=k2/K*TAU;
    top.push([rad*Math.cos(an),y1,rad*Math.sin(an)]);
    bot.push([rad*Math.cos(an),y0,rad*Math.sin(an)]);
  }
  push(top,c1,{});
  push(bot.slice().reverse(),c2,{});
}
function box(x0,x1,y0,y1,z0,z1,col){
  push([[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]],col,{});
  push([[x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0]],col,{});
  push([[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]],col,{});
  push([[x1,y1,z0],[x0,y1,z0],[x0,y1,z1],[x1,y1,z1]],col,{});
  push([[x0,y1,z0],[x0,y0,z0],[x0,y0,z1],[x0,y1,z1]],col,{});
  push([[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1]],col,{});
}
function spoke(ang){
  var r0=0.20,r1=0.92,hw=0.035,th=0.03;
  var dx=Math.cos(ang),dz=Math.sin(ang),px=-dz,pz=dx;
  var a0=[dx*r0+px*hw,0,dz*r0+pz*hw],b0=[dx*r1+px*hw*0.8,0,dz*r1+pz*hw*0.8];
  var c0=[dx*r1-px*hw*0.8,0,dz*r1-pz*hw*0.8],d0=[dx*r0-px*hw,0,dz*r0-pz*hw];
  var up=function(p){return [p[0],p[1]+th,p[2]];};
  push([up(a0),up(b0),up(c0),up(d0)],HULL2,{});
  var dn=function(p){return [p[0],p[1]-th,p[2]];};
  push([dn(d0),dn(c0),dn(b0),dn(a0)],HULL3,{});
}

function solarWing(sx){
  var inner=0.26*sx,armEnd=1.34*sx,pin=1.38*sx,pout=1.95*sx,ph=1.05;
  for(var i=0;i<4;i++){
    var t0=i/4,t1=(i+1)/4;
    var xa=inner+(armEnd-inner)*t0,xb=inner+(armEnd-inner)*t1;
    var w=0.055*(1-0.3*t0),w2=0.055*(1-0.3*t1);
    push([[xa,-w,0.05],[xb,-w2,0.05],[xb,w2,0.05],[xa,w,0.05]],HULL2,{});
    push([[xa,-w,-0.05],[xb,-w2,-0.05],[xb,w2,-0.05],[xa,w,-0.05]],HULL3,{});
  }
  var y0=-ph/2,y1=ph/2;
  panels.push({q:[[pin,y0,0],[pout,y0,0],[pout,y1,0],[pin,y1,0]]});
  box(pout-0.055,pout+0.055,y1-0.06,y1+0.06,0.05,0.13,HULL2);
  box(pout-0.055,pout+0.055,y0-0.06,y0+0.06,0.05,0.13,HULL2);
}
function dish(y,rad,dir){
  var K=18,pts=[],rim=[],core=[];
  for(var i=0;i<K;i++){
    var a=i/K*TAU;
    pts.push([rad*Math.cos(a),y,rad*Math.sin(a)*0.45]);
    rim.push([rad*0.72*Math.cos(a),y-dir*0.06,Math.sin(a)*0.34*0.72]);
    core.push([rad*0.42*Math.cos(a),y-dir*0.05,Math.sin(a)*0.2*0.42]);
  }
  push(pts.slice().reverse(),HULL,{});
  push(rim,HULL2,{});
  push(core,HULL3,{});
}
function band(y0,y1,rad,K,col,o){
  for(var i=0;i<K;i++){
    var a0=i/K*TAU,a1=(i+1)/K*TAU;
    push([[rad*Math.cos(a0),y0,rad*Math.sin(a0)],[rad*Math.cos(a1),y0,rad*Math.sin(a1)],
          [rad*Math.cos(a1),y1,rad*Math.sin(a1)],[rad*Math.cos(a0),y1,rad*Math.sin(a0)]],col,o||{});
  }
}

function build(){
  faces.length=0;hotspots.length=0;panels.length=0;
  buildTorus(1.02,0.20,32,10,HULL,HULL3);
  buildTorus(0.58,0.085,22,7,HULL2,HULL3);
  buildCyl(-1.06,1.06,0.125,18,HULL,HULL3);
  buildCyl(-0.38,0.38,0.195,20,HULL,HULL3);
  buildCyl(-0.66,-0.46,0.155,18,HULL2,HULL3);
  buildCyl(0.46,0.66,0.155,18,HULL2,HULL3);
  buildCyl(1.06,1.26,0.085,14,HULL2,HULL3);
  buildCyl(-1.26,-1.06,0.085,14,HULL2,HULL3);
  buildCyl(-0.13,0.13,0.075,14,[150,225,255],[40,150,200]);
  band(0.11,0.145,0.201,20,[40,170,225],{em:0.7});
  band(-0.145,-0.11,0.201,20,[40,170,225],{em:0.7});
  for(var a=0;a<6;a++){spoke(a/6*TAU+0.18);}
  for(var s=-1;s<=1;s+=2){solarWing(s);}
  dish(1.34,0.26,-1);
  dish(-1.34,0.20,1);
  for(var i2=0;i2<6;i2++){
    var an=i2/6*TAU+0.18;
    hotspots.push({p:[Math.cos(an)*1.02,0,Math.sin(an)*1.02],r:0.055});
  }
  hotspots.push({p:[0,0,0],r:0.09});
}

var LIGHT=(function(){var v=[0.42,0.74,0.50];var l=Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]);return [v[0]/l,v[1]/l,v[2]/l];})();
function shade(n,col){
  var d=n[0]*LIGHT[0]+n[1]*LIGHT[1]+n[2]*LIGHT[2];
  if(d<0)d=-d;
  var I=0.36+0.72*d;
  if(n[2]<-0.15)I*=0.88;
  var hv=[LIGHT[0],LIGHT[1],LIGHT[2]+1];
  var hl=Math.sqrt(hv[0]*hv[0]+hv[1]*hv[1]+hv[2]*hv[2])||1;
  var sp=Math.pow(Math.max(0,(n[0]*hv[0]+n[1]*hv[1]+n[2]*hv[2])/hl),18)*0.45;
  var rim=Math.pow(1-Math.min(1,Math.abs(n[2])),4)*0.26;
  return [Math.min(255,col[0]*I+230*sp+26*rim),Math.min(255,col[1]*I+240*sp+70*rim),Math.min(255,col[2]*I+250*sp+140*rim)];
}
function project(p){
  var z=p[2]+CAMZ;
  if(z<0.15)z=0.15;
  var f=SCALE/z;
  return [CX+p[0]*f,CY-p[1]*f,z];
}
function bl(a,b,c,d,u,v){
  return [(a[0]*(1-u)+b[0]*u)*(1-v)+(d[0]*(1-u)+c[0]*u)*v,
          (a[1]*(1-u)+b[1]*u)*(1-v)+(d[1]*(1-u)+c[1]*u)*v,
          (a[2]*(1-u)+b[2]*u)*(1-v)+(d[2]*(1-u)+c[2]*u)*v];
}

function drawPanel(it,frameOnly){
  var A=it.q[0],B=it.q[1],C=it.q[2],D=it.q[3];
  var n=nrm(A,B,D);
  if(n[0]<0){n=[-n[0],-n[1],-n[2]];}
  var lit=shade(n,[26,56,112]);
  var pa=project(A),pb=project(B),pc=project(C),pd=project(D);
  if(frameOnly){
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    var gs=ctx.createLinearGradient(pa[0],pa[1],pc[0],pc[1]);
    gs.addColorStop(0,'rgba(150,205,255,0.22)');
    gs.addColorStop(0.4,'rgba(70,140,235,0.07)');
    gs.addColorStop(1,'rgba(4,12,40,0)');
    ctx.fillStyle=gs;
    ctx.beginPath();
    ctx.moveTo(pa[0],pa[1]);ctx.lineTo(pb[0],pb[1]);ctx.lineTo(pc[0],pc[1]);ctx.lineTo(pd[0],pd[1]);
    ctx.closePath();ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle='rgb('+Math.round(lit[0])+','+Math.round(lit[1])+','+Math.round(lit[2])+')';
  ctx.beginPath();
  ctx.moveTo(pa[0],pa[1]);ctx.lineTo(pb[0],pb[1]);ctx.lineTo(pc[0],pc[1]);ctx.lineTo(pd[0],pd[1]);
  ctx.closePath();ctx.fill();
}

function draw(t){
  ctx.clearRect(0,0,W,H);
  var spin=t*0.00028;
  var list=[];
  for(var i=0;i<faces.length;i++){
    var f=faces[i],wp=[],zs=0;
    for(var k=0;k<f.p.length;k++){
      var p=rotX(rotY(f.p[k],spin),TILT);
      wp.push(p);zs+=p[2];
    }
    var n=nrm(wp[0],wp[1],wp[2]);
    list.push({pts:wp,n:n,base:f.c,a:f.a,em:f.em,z:zs/f.p.length});
  }
  for(var pi=0;pi<panels.length;pi++){
    var pd=panels[pi],pq=[],zn=1e9;
    for(var c4=0;c4<4;c4++){
      var wp4=rotX(rotY(pd.q[c4],spin),TILT);
      pq.push(wp4);if(wp4[2]<zn)zn=wp4[2];
    }
    var A0=pq[0],B0=pq[1],C0=pq[2],D0=pq[3],SN=3;
    for(var si=0;si<SN;si++){
      var u0=si/SN,u1=(si+1)/SN;
      var sa=bl(A0,B0,C0,D0,u0,0),sb=bl(A0,B0,C0,D0,u1,0);
      var sc=bl(A0,B0,C0,D0,u1,1),sd=bl(A0,B0,C0,D0,u0,1);
      list.push({kind:'panel',q:[sa,sb,sc,sd],z:(sa[2]+sb[2]+sc[2]+sd[2])/4});
    }
    list.push({kind:'frame',q:pq,z:zn});
  }
  list.sort(function(a,b){return b.z-a.z;});

  for(var q=0;q<list.length;q++){
    var it=list[q];
    if(it.kind==='panel'){drawPanel(it,0);continue;}
    if(it.kind==='frame'){drawPanel(it,1);continue;}
    var sp=[];
    for(var k2=0;k2<it.pts.length;k2++)sp.push(project(it.pts[k2]));
    var col=shade(it.n,it.base);
    ctx.fillStyle='rgba('+Math.round(col[0])+','+Math.round(col[1])+','+Math.round(col[2])+','+it.a+')';
    ctx.beginPath();
    for(var k3=0;k3<sp.length;k3++){
      if(k3===0)ctx.moveTo(sp[k3][0],sp[k3][1]);else ctx.lineTo(sp[k3][0],sp[k3][1]);
    }
    ctx.closePath();
    ctx.fill();
  }

  ctx.globalCompositeOperation='lighter';
  for(var gi=0;gi<hotspots.length;gi++){
    var gp=rotX(rotY(hotspots[gi].p,spin),TILT);
    var pp=project(gp);
    var rr=Math.max(4,SCALE/(gp[2]+CAMZ)*0.30);
    var gg=ctx.createRadialGradient(pp[0],pp[1],0,pp[0],pp[1],rr);
    gg.addColorStop(0,'rgba(0,215,255,0.35)');
    gg.addColorStop(1,'rgba(0,180,255,0)');
    ctx.fillStyle=gg;ctx.beginPath();ctx.arc(pp[0],pp[1],rr,0,TAU);ctx.fill();
  }
  ctx.globalCompositeOperation='source-over';
}

var start=0,lastT=0,vis=true;
document.addEventListener('visibilitychange',function(){vis=!document.hidden;});
function loop(now){
  requestAnimationFrame(loop);
  if(!vis)return;
  if(!start)start=now;
  if(now-lastT<32)return;
  lastT=now;
  draw(now-start);
}
resize();
build();
requestAnimationFrame(loop);
})();
