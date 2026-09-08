// ============================================================
// Better Discovery – Sandbox: contenido de demostración
// Creaciones HTML de ejemplo (autónomas, sin dependencias).
// ============================================================
'use strict';

const esc = (s) => s; // placeholder (no usado)

module.exports = [
  {
    title: 'Snake clásico',
    description: 'La serpiente de siempre con canvas. Flechas o WASD para moverte. ¡Come y crece!',
    author: 'Ana',
    tag: 'game',
    likes: 34,
    hoursAgo: 5,
    html: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Snake</title>
<style>
  body{margin:0;background:#0f172a;color:#e2e8f0;font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:10px}
  canvas{background:#020617;border-radius:10px;box-shadow:0 10px 40px rgba(0,0,0,.6)}
  .score{font-size:1.1rem;font-weight:700}
  .btns{display:grid;grid-template-columns:repeat(3,52px);gap:6px}
  button{height:44px;border:none;border-radius:10px;background:#1e293b;color:#e2e8f0;font-size:18px;cursor:pointer}
  button:active{background:#334155}
</style>
</head>
<body>
  <div class="score">Puntos: <span id="s">0</span></div>
  <canvas id="c" width="300" height="300"></canvas>
  <div class="btns">
    <span></span><button onclick="steer(0,-1)">▲</button><span></span>
    <button onclick="steer(-1,0)">◀</button><button onclick="steer(0,1)">▼</button><button onclick="steer(1,0)">▶</button>
  </div>
  <script>
    const cv=document.getElementById('c'),ctx=cv.getContext('2d');
    const G=15,N=20,SZ=300/G;
    let snake,dir,food,score,dead,timer;
    function reset(){snake=[{x:8,y:10},{x:7,y:10},{x:6,y:10}];dir={x:1,y:0};score=0;dead=false;place();document.getElementById('s').textContent=0;clearInterval(timer);timer=setInterval(tick,110);}
    function place(){do{food={x:(Math.random()*N)|0,y:(Math.random()*N)|0}}while(snake.some(p=>p.x===food.x&&p.y===food.y));}
    function steer(x,y){if(!dead&&(x!==-dir.x||y!==-dir.y))dir={x,y};if(dead)reset();}
    function tick(){if(dead)return;const h={x:(snake[0].x+dir.x+N)%N,y:(snake[0].y+dir.y+N)%N};
      if(snake.some(p=>p.x===h.x&&p.y===h.y)){dead=true;ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(0,0,300,300);ctx.fillStyle='#f87171';ctx.font='bold 22px system-ui';ctx.textAlign='center';ctx.fillText('Game over',150,145);ctx.font='13px system-ui';ctx.fillStyle='#e2e8f0';ctx.fillText('Pulsa una flecha para reiniciar',150,170);return;}
      snake.unshift(h);
      if(h.x===food.x&&h.y===food.y){score+=10;document.getElementById('s').textContent=score;place();}else snake.pop();
      ctx.clearRect(0,0,300,300);
      ctx.fillStyle='#f59e0b';ctx.beginPath();ctx.arc(food.x*SZ+SZ/2,food.y*SZ+SZ/2,SZ/2-2,0,7);ctx.fill();
      snake.forEach((p,i)=>{ctx.fillStyle=i? '#22c55e':'#4ade80';ctx.fillRect(p.x*SZ+1,p.y*SZ+1,SZ-2,SZ-2);});
    }
    addEventListener('keydown',e=>{const k=e.key.toLowerCase();
      if(k==='arrowup'||k==='w'){steer(0,-1);e.preventDefault();}
      if(k==='arrowdown'||k==='s'){steer(0,1);e.preventDefault();}
      if(k==='arrowleft'||k==='a'){steer(-1,0);e.preventDefault();}
      if(k==='arrowright'||k==='d'){steer(1,0);e.preventDefault();}
    });
    reset();
  <\/script>
</body>
</html>`
  },
  {
    title: 'Nebulosa interactiva',
    description: 'Sistema de partículas que reacciona al ratón. Mueve el cursor y haz clic para lanzar una ráfaga.',
    author: 'Luis',
    tag: 'interactive',
    likes: 27,
    hoursAgo: 26,
    html: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Nebulosa</title>
<style>body{margin:0;background:#020617;overflow:hidden}canvas{display:block;cursor:crosshair}
.hint{position:fixed;top:12px;left:0;right:0;text-align:center;color:#94a3b8;font:13px system-ui;pointer-events:none}</style>
</head>
<body>
  <div class="hint">Mueve el ratón · clic para una ráfaga</div>
  <canvas id="c"></canvas>
  <script>
    const cv=document.getElementById('c'),ctx=cv.getContext('2d');
    function size(){cv.width=innerWidth;cv.height=innerHeight;}size();addEventListener('resize',size);
    let mx=innerWidth/2,my=innerHeight/2;
    addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY;});
    const P=[];
    function spawn(x,y,n){for(let i=0;i<n;i++){const a=Math.random()*7,v=Math.random()*4+.5;
      P.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:1,hue:200+Math.random()*120});}}
    addEventListener('click',e=>spawn(e.clientX,e.clientY,60));
    (function tick(){ctx.fillStyle='rgba(2,6,23,.25)';ctx.fillRect(0,0,cv.width,cv.height);
      if(Math.random()<.5)spawn(mx+(Math.random()-.5)*40,my+(Math.random()-.5)*40,1);
      for(let i=P.length-1;i>=0;i--){const p=P[i];p.x+=p.vx;p.y+=p.vy;p.vx*=.985;p.vy*=.985;p.life-=.008;
        if(p.life<=0){P.splice(i,1);continue;}
        ctx.fillStyle='hsla('+p.hue+',90%,65%,'+p.life+')';
        ctx.beginPath();ctx.arc(p.x,p.y,p.life*3+1,0,7);ctx.fill();}
      requestAnimationFrame(tick);})();
  <\/script>
</body>
</html>`
  },
  {
    title: 'Pizarras de dibujo',
    description: 'Dibuja libremente: cambia color, grosor y borra. Todo en tiempo real con canvas.',
    author: 'Marta',
    tag: 'tool',
    likes: 19,
    hoursAgo: 50,
    html: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Dibujo</title>
<style>
  body{margin:0;background:#111827;color:#e5e7eb;font-family:system-ui;display:flex;flex-direction:column;align-items:center;gap:10px;padding:14px}
  .bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:center}
  .bar button{padding:7px 14px;border-radius:8px;border:1px solid #374151;background:#1f2937;color:#e5e7eb;cursor:pointer;font:inherit}
  .bar button.on{border-color:#6366f1;background:#312e81}
  .sw{width:30px;height:30px;border-radius:50%;border:2px solid transparent;cursor:pointer}
  .sw.on{border-color:#fff}
  canvas{background:#0b1220;border-radius:12px;touch-action:none;max-width:100%}
</style>
</head>
<body>
  <div class="bar">
    <span class="sw on" style="background:#f8fafc" data-c="#f8fafc"></span>
    <span class="sw" style="background:#ef4444" data-c="#ef4444"></span>
    <span class="sw" style="background:#f59e0b" data-c="#f59e0b"></span>
    <span class="sw" style="background:#22c55e" data-c="#22c55e"></span>
    <span class="sw" style="background:#3b82f6" data-c="#3b82f6"></span>
    <span class="sw" style="background:#a855f7" data-c="#a855f7"></span>
    <input id="sz" type="range" min="2" max="40" value="6" title="Grosor">
    <button id="clr">🧹 Limpiar</button>
  </div>
  <canvas id="c" width="640" height="380"></canvas>
  <script>
    const cv=document.getElementById('c'),ctx=cv.getContext('2d');
    let color='#f8fafc',size=6,down=false,lx=0,ly=0;
    document.querySelectorAll('.sw').forEach(s=>s.onclick=()=>{
      color=s.dataset.c;size=+document.getElementById('sz').value;
      document.querySelectorAll('.sw').forEach(x=>x.classList.remove('on'));s.classList.add('on');});
    document.getElementById('sz').oninput=e=>size=+e.target.value;
    document.getElementById('clr').onclick=()=>ctx.clearRect(0,0,cv.width,cv.height);
    function pos(e){const r=cv.getBoundingClientRect(),t=e.touches?e.touches[0]:e;
      return{x:(t.clientX-r.left)*cv.width/r.width,y:(t.clientY-r.top)*cv.height/r.height};}
    function start(e){down=true;const p=pos(e);lx=p.x;ly=p.y;draw(p);}
    function draw(p){ctx.strokeStyle=color;ctx.lineWidth=size;ctx.lineCap='round';
      ctx.beginPath();ctx.moveTo(lx,ly);ctx.lineTo(p.x,p.y);ctx.stroke();lx=p.x;ly=p.y;}
    function end(){down=false;}
    cv.addEventListener('mousedown',start);cv.addEventListener('mousemove',e=>down&&draw(pos(e)));
    addEventListener('mouseup',end);
    cv.addEventListener('touchstart',e=>{e.preventDefault();start(e);},{passive:false});
    cv.addEventListener('touchmove',e=>{e.preventDefault();draw(pos(e));},{passive:false});
    cv.addEventListener('touchend',end);
  <\/script>
</body>
</html>`
  },
  {
    title: 'Generador de paletas',
    description: 'Crea paletas de color aleatorias con un clic. Pulsa un color para copiar su código hex.',
    author: 'Carlos',
    tag: 'tool',
    likes: 23,
    hoursAgo: 74,
    html: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Paletas</title>
<style>
  body{margin:0;background:#0b0f19;color:#e5e7eb;font-family:system-ui;display:flex;flex-direction:column;align-items:center;gap:18px;padding:24px}
  .row{display:flex;width:100%;max-width:640px;height:200px;border-radius:16px;overflow:hidden;box-shadow:0 14px 50px rgba(0,0,0,.5)}
  .cell{flex:1;display:flex;align-items:flex-end;justify-content:center;padding:12px;font-weight:600;cursor:pointer;user-select:none;transition:flex .25s}
  .cell:hover{flex:1.4}
  button{padding:10px 22px;border:none;border-radius:10px;background:#6366f1;color:#fff;font:600 14px system-ui;cursor:pointer}
  #msg{height:18px;font-size:13px;color:#a5b4fc}
</style>
</head>
<body>
  <h1 style="margin:0">🎨 Paletas</h1>
  <div class="row" id="row"></div>
  <div style="display:flex;gap:10px;align-items:center">
    <button onclick="gen()">🎲 Nueva paleta</button>
    <span id="msg"></span>
  </div>
  <script>
    const row=document.getElementById('row'),msg=document.getElementById('msg');
    function hex(h){return h.toUpperCase();}
    function gen(){row.innerHTML='';
      for(let i=0;i<5;i++){
        const h='#'+Math.floor(Math.random()*0xffffff).toString(16).padStart(6,'0');
        const l=parseInt(h.slice(3),16)/255;
        const d=document.createElement('div');d.className='cell';d.style.background=h;
        d.style.color=l>.6?'#111':'#fff';d.textContent=hex(h);
        d.onclick=()=>{const t=h.toUpperCase();
          if(navigator.clipboard)navigator.clipboard.writeText(t).catch(()=>{});
          msg.textContent='Copiado: '+t;setTimeout(()=>msg.textContent='',1500);};
        row.appendChild(d);}}
    gen();
  <\/script>
</body>
</html>`
  },
  {
    title: 'Cronómetro de vueltas',
    description: 'Cronómetro con registro de vueltas. Ideal para medir tiempos de estudio o ejercicio.',
    author: 'Ana',
    tag: 'tool',
    likes: 12,
    hoursAgo: 98,
    html: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Cronómetro</title>
<style>
  body{margin:0;background:#0f172a;color:#e2e8f0;font-family:system-ui;display:flex;flex-direction:column;align-items:center;gap:16px;padding:24px}
  .time{font-size:4rem;font-variant-numeric:tabular-nums;font-weight:700}
  .row{display:flex;gap:10px}
  button{padding:10px 20px;border:none;border-radius:10px;font:600 14px system-ui;cursor:pointer}
  .go{background:#22c55e;color:#052e16}.lap{background:#334155;color:#e2e8f0}.rst{background:#7f1d1d;color:#fecaca}
  ul{list-style:none;padding:0;margin:0;min-width:220px;font-variant-numeric:tabular-nums}
  li{display:flex;justify-content:space-between;padding:5px 14px;border-bottom:1px solid #1e293b;font-size:14px}
</style>
</head>
<body>
  <div class="time" id="t">00:00.0</div>
  <div class="row">
    <button class="go" id="b" onclick="toggle()">▶ Iniciar</button>
    <button class="lap" onclick="lap()">Vuelta</button>
    <button class="rst" onclick="reset()">Reiniciar</button>
  </div>
  <ul id="laps"></ul>
  <script>
    const t=document.getElementById('t'),b=document.getElementById('b'),L=document.getElementById('laps');
    let start=0,acc=0,on=false,n=0,iv=null;
    function fmt(ms){const m=String(Math.floor(ms/60000)).padStart(2,'0');
      const s=String(Math.floor(ms/1000)%60).padStart(2,'0');
      const d=Math.floor(ms/100)%10;return m+':'+s+'.'+d;}
    function tick(){t.textContent=fmt(acc+Date.now()-start);}
    function toggle(){on=!on;
      if(on){start=Date.now();iv=setInterval(tick,60);b.textContent='⏸ Pausar';}
      else{acc+=Date.now()-start;clearInterval(iv);b.textContent='▶ Continuar';}}
    function lap(){if(!on&&!acc)return;n++;const li=document.createElement('li');
      li.innerHTML='<span>Vuelta '+n+'</span><span>'+fmt(on?acc+Date.now()-start:acc)+'</span>';
      L.prepend(li);}
    function reset(){on=false;clearInterval(iv);acc=0;n=0;t.textContent='00:00.0';L.innerHTML='';b.textContent='▶ Iniciar';}
  <\/script>
</body>
</html>`
  },
  {
    title: 'Pong minimalista',
    description: 'Juega contra la IA con el ratón o el dedo. Primero a 5 puntos. ¿Cuántos racha llevas?',
    author: 'Luis',
    tag: 'game',
    likes: 21,
    hoursAgo: 122,
    html: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Pong</title>
<style>body{margin:0;background:#020617;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:10px;font-family:system-ui;color:#e2e8f0}
canvas{background:#0f172a;border-radius:10px;max-width:96vw;box-shadow:0 10px 40px rgba(0,0,0,.6)}
.s{font-size:1.4rem;font-weight:700;letter-spacing:.2em}</style>
</head>
<body>
  <div class="s"><span id="me">0</span> : <span id="ai">0</span></div>
  <canvas id="c" width="480" height="300"></canvas>
  <script>
    const cv=document.getElementById('c'),ctx=cv.getContext('2d');
    let py=130,ay=130,ball={x:240,y:150,vx:3.4,vy:1.8},me=0,ai=0;
    function aim(e){const r=cv.getBoundingClientRect();
      const y=((e.touches?e.touches[0].clientY:e.clientY)-r.top)*cv.height/r.height;
      py=Math.max(0,Math.min(cv.height-64,y-32));}
    cv.addEventListener('mousemove',aim);cv.addEventListener('touchmove',e=>{e.preventDefault();aim(e);},{passive:false});
    (function tick(){
      ay+= (ball.y-ay-10)*.08; ay=Math.max(0,Math.min(cv.height-64,ay));
      ball.x+=ball.vx;ball.y+=ball.vy;
      if(ball.y<8||ball.y>cv.height-8)ball.vy*=-1;
      if(ball.x<40&&ball.vx<0&&ball.y>py&&ball.y<py+64){ball.vx=Math.abs(ball.vx)*1.04;ball.vy+=((ball.y-(py+32))/32)*2;}
      if(ball.x>cv.width-40&&ball.vx>0&&ball.y>ay&&ball.y<ay+64){ball.vx=-Math.abs(ball.vx)*1.04;ball.vy+=((ball.y-(ay+32))/32)*2;}
      if(ball.x<-10){ai++;document.getElementById('ai').textContent=ai;resetBall(1);}
      if(ball.x>cv.width+10){me++;document.getElementById('me').textContent=me;resetBall(-1);}
      ctx.clearRect(0,0,cv.width,cv.height);
      ctx.strokeStyle='#1e293b';ctx.setLineDash([6,8]);ctx.beginPath();ctx.moveTo(240,0);ctx.lineTo(240,cv.height);ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle='#6366f1';ctx.fillRect(28,py,10,64);
      ctx.fillStyle='#f43f5e';ctx.fillRect(cv.width-38,ay,10,64);
      ctx.fillStyle='#f8fafc';ctx.beginPath();ctx.arc(ball.x,ball.y,7,0,7);ctx.fill();
      requestAnimationFrame(tick);})();
    function resetBall(d){ball={x:240,y:150,vx:3.4*d,vy:(Math.random()*2-1)*2};}
  <\/script>
</body>
</html>`
  },
  {
    title: 'Reloj analógico',
    description: 'Un reloj de agujeras dibujado con canvas. Las manecillas se mueven en tiempo real.',
    author: 'Marta',
    tag: 'demo',
    likes: 9,
    hoursAgo: 146,
    html: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Reloj</title>
<style>body{margin:0;background:radial-gradient(circle at 50% 30%,#1e293b,#020617);display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui}
canvas{filter:drop-shadow(0 20px 40px rgba(0,0,0,.6))}</style>
</head>
<body>
  <canvas id="c" width="320" height="320"></canvas>
  <script>
    const cv=document.getElementById('c'),ctx=cv.getContext('2d');
    (function tick(){
      const n=new Date(),cx=160,cy=160;
      ctx.clearRect(0,0,320,320);
      ctx.beginPath();ctx.arc(cx,cy,150,0,7);ctx.fillStyle='#0f172a';ctx.fill();
      ctx.lineWidth=6;ctx.strokeStyle='#334155';ctx.stroke();
      for(let i=0;i<60;i++){const a=i*Math.PI/30,r1=i%5?138:130;
        ctx.beginPath();ctx.moveTo(cx+Math.sin(a)*r1,cy-Math.cos(a)*r1);
        ctx.lineTo(cx+Math.sin(a)*145,cy-Math.cos(a)*145);
        ctx.lineWidth=i%5?1:3;ctx.strokeStyle=i%5?'#475569':'#94a3b8';ctx.stroke();}
      function hand(len,w,color,ang){ctx.beginPath();ctx.moveTo(cx,cy);
        ctx.lineTo(cx+Math.sin(ang)*len,cy-Math.cos(ang)*len);
        ctx.lineWidth=w;ctx.lineCap='round';ctx.strokeStyle=color;ctx.stroke();}
      hand(70,8,'#e2e8f0',(n.getHours()%12+n.getMinutes()/60)*Math.PI/6);
      hand(100,5,'#e2e8f0',(n.getMinutes()+n.getSeconds()/60)*Math.PI/30);
      hand(115,2,'#f59e0b',n.getSeconds()*Math.PI/30);
      ctx.beginPath();ctx.arc(cx,cy,7,0,7);ctx.fillStyle='#f59e0b';ctx.fill();
      requestAnimationFrame(tick);})();
  <\/script>
</body>
</html>`
  },
  {
    title: 'Frases motivadoras',
    description: 'Un generador de frases para empezar el día. Pulsa el botón y toma una nueva cita.',
    author: 'Carlos',
    tag: 'demo',
    likes: 7,
    hoursAgo: 170,
    html: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Frases</title>
<style>
  body{margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;
       background:linear-gradient(135deg,#1e1b4b,#0f172a);color:#e2e8f0;font-family:Georgia,serif;padding:24px}
  blockquote{font-size:clamp(1.4rem,4vw,2.2rem);line-height:1.4;text-align:center;max-width:640px;min-height:120px;
       display:flex;align-items:center;justify-content:center;transition:opacity .3s}
  cite{opacity:.6;font-size:1rem;font-family:system-ui}
  button{padding:12px 28px;border:none;border-radius:999px;background:#6366f1;color:#fff;font:600 15px system-ui;cursor:pointer}
  button:hover{background:#4f46e5}
</style>
</head>
<body>
  <blockquote id="q">“Pulsa el botón para empezar.”</blockquote>
  <button onclick="next()">💡 Nueva frase</button>
  <script>
    const F=[["El mejor momento para plantar un árbol fue hace 20 años. El segundo mejor es ahora.","proverbio chino"],
      ["No cuentes los días, haz que los días cuenten.","Muhammad Ali"],
      ["La simplicidad es la máxima sofisticación.","Leonardo da Vinci"],
      ["Un viaje de mil millas comienza con un primer paso.","Lao Tsé"],
      ["Haz lo que amas y no trabajarás un solo día.","confuciano"],
      ["El éxito es la suma de pequeños esfuerzos repetidos día tras día.","Robert Collier"],
      ["Primero formamos nuestros hábitos, luego ellos nos forman a nosotros.","John Dryden"]];
    const q=document.getElementById('q');let i=-1;
    function next(){i=(i+1)%F.length;q.style.opacity=0;
      setTimeout(()=>{q.innerHTML='“'+F[i][0]+'” <cite>— '+F[i][1]+'</cite>';q.style.opacity=1;},250);}
  <\/script>
</body>
</html>`
  },
  {
    title: 'Memoria de emojis',
    description: 'Juego de parejas: encuentra todos los pares en el menor número de intentos.',
    author: 'Luis',
    tag: 'game',
    likes: 16,
    hoursAgo: 194,
    html: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Memoria</title>
<style>
  body{margin:0;background:#0f172a;color:#e2e8f0;font-family:system-ui;display:flex;flex-direction:column;align-items:center;gap:14px;padding:18px}
  .grid{display:grid;grid-template-columns:repeat(4,64px);gap:8px}
  .card{width:64px;height:64px;border-radius:12px;background:#1e293b;display:flex;align-items:center;justify-content:center;
        font-size:30px;cursor:pointer;user-select:none;transition:transform .15s}
  .card:hover{transform:translateY(-2px)}
  .card.flip{background:#312e81}
  .card.ok{background:#14532d;cursor:default}
  button{padding:9px 18px;border:none;border-radius:9px;background:#6366f1;color:#fff;font:600 13px system-ui;cursor:pointer}
  .win{font-size:1.3rem;font-weight:700;color:#4ade80;min-height:1.4em}
</style>
</head>
<body>
  <h1 style="margin:0">🧠 Memoria</h1>
  <div>Intentos: <b id="n">0</b></div>
  <div class="grid" id="g"></div>
  <div class="win" id="w"></div>
  <button onclick="init()">🔄 Reiniciar</button>
  <script>
    const E=['🚀','🍕','🐙','⚽','🎁','🌈','🎮','🍩'];
    let deck,open,lock,won;
    function init(){open=[];lock=false;won=0;document.getElementById('n').textContent=0;document.getElementById('w').textContent='';
      deck=[...E,...E].sort(()=>Math.random()-.5);
      const g=document.getElementById('g');g.innerHTML='';
      deck.forEach((e)=>{const d=document.createElement('div');d.className='card';d.dataset.e=e;d.textContent='';
        d.onclick=()=>flip(d);g.appendChild(d);});}
    function flip(d){if(lock||d.classList.contains('flip')||d.classList.contains('ok'))return;
      d.classList.add('flip');d.textContent=d.dataset.e;open.push(d);
      if(open.length===2){
        document.getElementById('n').textContent=+document.getElementById('n').textContent+1;
        lock=true;const[a,b]=open;
        if(a.dataset.e===b.dataset.e){a.classList.add('ok');b.classList.add('ok');won+=2;
          open=[];lock=false;
          if(won===deck.length)document.getElementById('w').textContent='🎉 ¡Ganaste!';}
        else setTimeout(()=>{a.classList.remove('flip');b.classList.remove('flip');a.textContent='';b.textContent='';open=[];lock=false;},650);}}
    init();
  <\/script>
</body>
</html>`
  },
  {
    title: 'Laboratorio de gradientes',
    description: 'Combina dos colores y el ángulo para crear un degradado CSS, y copia el código con un clic.',
    author: 'Marta',
    tag: 'tool',
    likes: 14,
    hoursAgo: 218,
    html: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Gradientes</title>
<style>
  body{margin:0;background:#0b0f19;color:#e5e7eb;font-family:system-ui;display:flex;flex-direction:column;align-items:center;gap:16px;padding:20px}
  .prev{width:100%;max-width:520px;height:220px;border-radius:16px;box-shadow:0 14px 50px rgba(0,0,0,.5)}
  .ctl{display:flex;gap:14px;align-items:center;flex-wrap:wrap;justify-content:center}
  .code{background:#0f172a;border:1px solid #1e293b;padding:12px 16px;border-radius:10px;font:13px monospace;width:100%;max-width:520px;text-align:center;cursor:pointer}
  input[type=color]{width:46px;height:46px;border:none;border-radius:10px;background:none;cursor:pointer}
  input[type=range]{width:160px}
  #msg{font-size:12px;color:#818cf8;height:14px}
</style>
</head>
<body>
  <h1 style="margin:0">🌈 Gradientes</h1>
  <div class="prev" id="p"></div>
  <div class="ctl">
    <input type="color" id="a" value="#7c3aed"><input type="color" id="b" value="#06b6d4">
    <input type="range" id="ang" min="0" max="360" value="135">
    <span id="deg">135°</span>
  </div>
  <div class="code" id="c" title="Clic para copiar"></div>
  <div id="msg"></div>
  <script>
    const p=document.getElementById('p'),c=document.getElementById('c'),
          a=document.getElementById('a'),b=document.getElementById('b'),
          ang=document.getElementById('ang'),deg=document.getElementById('deg');
    function up(){const v='linear-gradient('+ang.value+'deg,'+a.value+','+b.value+')';
      p.style.background=v;deg.textContent=ang.value+'°';c.textContent=v;
      c.onclick=()=>{if(navigator.clipboard)navigator.clipboard.writeText(v).catch(()=>{});
        document.getElementById('msg').textContent='¡Copiado!';setTimeout(()=>document.getElementById('msg').textContent='',1400);};}
    [a,b,ang].forEach(el=>el.addEventListener('input',up));up();
  <\/script>
</body>
</html>`
  },
  {
    title: 'Prueba de reflejos',
    description: 'Espera a que el cuadrado se ponga verde y haz clic lo más rápido posible. ¿Bajas de 250 ms?',
    author: 'Carlos',
    tag: 'game',
    likes: 11,
    hoursAgo: 242,
    html: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Reflejos</title>
<style>
  body{margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;font-family:system-ui;color:#e2e8f0;background:#020617}
  .box{width:min(80vw,420px);height:240px;border-radius:18px;display:flex;align-items:center;justify-content:center;
       font-size:1.2rem;font-weight:600;cursor:pointer;user-select:none;background:#1e293b;transition:background .1s}
  .go{background:#16a34a}
  #best{color:#94a3b8;font-size:14px}
</style>
</head>
<body>
  <h1>⚡ Reflejos</h1>
  <div class="box" id="b">Haz clic para empezar</div>
  <div id="best"></div>
  <script>
    const B=document.getElementById('b'),best=document.getElementById('best');
    let state='idle',t0=0,tm=null,record=null;
    function set(txt,cls){B.textContent=txt;B.className='box'+(cls?' '+cls:'');}
    B.addEventListener('click',()=>{
      if(state==='idle'){state='wait';set('Espera el verde…');
        tm=setTimeout(()=>{state='go';t0=performance.now();set('¡AHORA!','go');},800+Math.random()*2600);}
      else if(state==='wait'){clearTimeout(tm);state='idle';set('¡Demasiado pronto! Vuelve a intentarlo');}
      else if(state==='go'){const ms=Math.round(performance.now()-t0);state='done';
        set(ms+' ms'+(record!==null&&ms<record?' · ¡Récord!':''));
        if(record===null||ms<record){record=ms;best.textContent='Mejor marca: '+record+' ms';}}
    });
  <\/script>
</body>
</html>`
  },
  {
    title: 'Lista de tareas',
    description: 'Un mini to-do list que vive y muere dentro del iframe. Añade, completa y elimina tareas.',
    author: 'Ana',
    tag: 'interactive',
    likes: 18,
    hoursAgo: 266,
    html: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Tareas</title>
<style>
  body{margin:0;background:#0f172a;color:#e2e8f0;font-family:system-ui;display:flex;flex-direction:column;align-items:center;padding:26px 16px;gap:16px}
  .wrap{width:100%;max-width:420px}
  .add{display:flex;gap:8px}
  input{flex:1;padding:12px 14px;border-radius:10px;border:1px solid #334155;background:#1e293b;color:#e2e8f0;font:inherit;outline:none}
  input:focus{border-color:#6366f1}
  button.addb{padding:0 18px;border:none;border-radius:10px;background:#6366f1;color:#fff;font-size:20px;cursor:pointer}
  ul{list-style:none;padding:0;margin:14px 0 0;display:flex;flex-direction:column;gap:8px}
  li{display:flex;align-items:center;gap:10px;background:#1e293b;border-radius:10px;padding:11px 14px}
  li.done span{text-decoration:line-through;opacity:.5}
  li span{flex:1}
  li button{border:none;background:none;color:#64748b;cursor:pointer;font-size:16px}
  li button:hover{color:#f87171}
  .empty{color:#64748b;text-align:center;padding:18px;font-size:14px}
</style>
</head>
<body>
  <div class="wrap">
    <h1 style="margin:0">✅ Tareas</h1>
    <div class="add">
      <input id="i" placeholder="Nueva tarea…" maxlength="80">
      <button class="addb" onclick="add()">+</button>
    </div>
    <ul id="l"></ul>
    <div class="empty" id="e">Sin tareas. ¡Añade la primera!</div>
  </div>
  <script>
    const L=document.getElementById('l'),I=document.getElementById('i'),E=document.getElementById('e');
    let items=[{t:'Probar este sandbox',d:true},{t:'Subir mi propia creación',d:false}];
    function render(){L.innerHTML='';E.style.display=items.length?'none':'';
      items.forEach((it,i)=>{const li=document.createElement('li');if(it.d)li.className='done';
        const c=document.createElement('input');c.type='checkbox';c.checked=it.d;
        c.onchange=()=>{items[i].d=c.checked;render();};
        const s=document.createElement('span');s.textContent=it.t;
        const x=document.createElement('button');x.textContent='✕';x.onclick=()=>{items.splice(i,1);render();};
        li.append(c,s,x);L.appendChild(li);});}
    function add(){const t=I.value.trim();if(!t)return;items.push({t,d:false});I.value='';render();}
    I.addEventListener('keydown',e=>{if(e.key==='Enter')add();});
    render();
  <\/script>
</body>
</html>`
  },
  {
    title: 'Atracón de arkanoides',
    description: 'Caja y bloques. Muéve la caja con el ratón o el dedo y rompe todas las columnas.',
    author: 'Ana',
    tag: 'game',
    likes: 25,
    hoursAgo: 290,
    html: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Arkanoides</title>
<style>body{margin:0;background:#020617;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:10px;font-family:system-ui;color:#e2e8f0}
canvas{background:#0f172a;border-radius:10px;box-shadow:0 10px 40px rgba(0,0,0,.6);max-width:96vw}
.msg{min-height:1.3em;font-weight:700}</style>
</head>
<body>
  <div class="msg" id="m"></div>
  <canvas id="c" width="420" height="300"></canvas>
  <script>
    const cv=document.getElementById('c'),ctx=cv.getContext('2d'),M=document.getElementById('m');
    let px=170,ball,blocks,lives;
    function init(){lives=3;px=170;ball={x:210,y:260,vx:2.6,vy:-3};
      blocks=[];const cols=['#f43f5e','#f59e0b','#22c55e','#3b82f6','#a855f7'];
      for(let r=0;r<5;r++)for(let bcol=0;bcol<8;bcol++)
        blocks.push({x:bcol*50+8,y:r*20+28,w:44,h:14,c:cols[r],alive:true});
      M.textContent='Vidas: '+(lives)+' · Bloques: '+blocks.length;}
    function aim(e){const r=cv.getBoundingClientRect();
      const x=((e.touches?e.touches[0].clientX:e.clientX)-r.left)*cv.width/r.width;
      px=Math.max(0,Math.min(cv.width-80,x-40));}
    cv.addEventListener('mousemove',aim);
    cv.addEventListener('touchmove',e=>{e.preventDefault();aim(e);},{passive:false});
    (function tick(){
      ball.x+=ball.vx;ball.y+=ball.vy;
      if(ball.x<7||ball.x>cv.width-7)ball.vx*=-1;
      if(ball.y<7)ball.vy*=-1;
      if(ball.y>268&&ball.y<284&&ball.x>px-7&&ball.x<px+87){
        ball.vy=-Math.abs(ball.vy);ball.vx+=((ball.x-(px+40))/40)*1.4;}
      if(ball.y>cv.height+10){lives--;if(lives<=0){M.textContent='🏁 Fin del juego · clic para reiniciar';
            init();return;}
        M.textContent='Vidas: '+lives;ball={x:210,y:260,vx:2.6,vy:-3};}
      for(const bl of blocks){if(!bl.alive)continue;
        if(ball.x>bl.x-7&&ball.x<bl.x+bl.w+7&&ball.y>bl.y-7&&ball.y<bl.y+bl.h+7){
          bl.alive=false;ball.vy*=-1;break;}}
      ctx.clearRect(0,0,cv.width,cv.height);
      for(const bl of blocks)if(bl.alive){ctx.fillStyle=bl.c;ctx.fillRect(bl.x,bl.y,bl.w,bl.h);}
      ctx.fillStyle='#e2e8f0';ctx.fillRect(px,270,80,10);
      ctx.beginPath();ctx.arc(ball.x,ball.y,7,0,7);ctx.fillStyle='#fbbf24';ctx.fill();
      if(blocks.every(b=>!b.alive))M.textContent=' ¡Ganaste! · clic para jugar otra vez';
      requestAnimationFrame(tick);})();
    cv.addEventListener('click',init);
    init();
  <\/script>
</body>
</html>`
  },
  {
    title: 'Prueba de velocidad de escritura',
    description: 'Escribe la frase lo más rápido posible y mide tus palabras por minuto.',
    author: 'Marta',
    tag: 'demo',
    likes: 8,
    hoursAgo: 314,
    html: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Escribe</title>
<style>
  body{margin:0;background:#0f172a;color:#e2e8f0;font-family:system-ui;display:flex;flex-direction:column;align-items:center;gap:18px;padding:26px}
  .phrase{font-size:1.25rem;max-width:560px;text-align:center;line-height:1.7;font-family:monospace}
  .phrase .hit{color:#4ade80}.phrase .miss{color:#f87171}
  textarea{width:100%;max-width:560px;min-height:90px;padding:14px;border-radius:12px;border:1px solid #334155;
           background:#1e293b;color:#e2e8f0;font:16px system-ui;outline:none}
  textarea:focus{border-color:#6366f1}
  .res{font-size:1.4rem;font-weight:700;color:#818cf8;min-height:1.4em}
  button{padding:10px 22px;border:none;border-radius:10px;background:#6366f1;color:#fff;font:600 14px system-ui;cursor:pointer}
</style>
</head>
<body>
  <h1 style="margin:0">⌨️ Velocidad</h1>
  <div class="phrase" id="p"></div>
  <textarea id="t" placeholder="Empieza a escribir aquí…" autofocus></textarea>
  <div class="res" id="r"></div>
  <button onclick="reset()">🔄 Nueva frase</button>
  <script>
    const FR=['La programación es el arte de contarle a la computadora qué hacer',
      'Los buenos desarrolladores escriben código que las personas puedan entender',
      'Primero resuelve el problema, luego escribe el código',
      'La simplicidad es la máxima sofisticación',
      'Haz que funcione, luego haz que funcione bien'];
    const P=document.getElementById('p'),T=document.getElementById('t'),R=document.getElementById('r');
    let phrase,start=null;
    function show(){P.innerHTML=phrase.split('').map(c=>'<span>'+c+'</span>').join('');}
    function reset(){phrase=FR[Math.random()*FR.length|0];T.value='';R.textContent='';start=null;show();T.focus();}
    T.addEventListener('input',()=>{
      if(!start&&T.value.trim())start=Date.now();
      const chars=P.querySelectorAll('span');
      chars.forEach((s,i)=>{s.className='';
        if(T.value[i]===phrase[i])s.classList.add('hit');
        else if(T.value[i]!==undefined)s.classList.add('miss');});
      if(start){const secs=(Date.now()-start)/1000,words=T.value.trim().split(/\\s+/).filter(Boolean).length;
        const wpm=secs>0?Math.round(words/(secs/60)):0;
        R.textContent=wpm+' palabras/min';}});
    reset();
  <\/script>
</body>
</html>`
  }
];
