/*! SIWEPE · © 2026 Joel Reyes. Todos los derechos reservados. · Prohibida su reproduccion o distribucion sin autorizacion. */
/*
  tienda/main.js — Portal cliente v3: bienvenida, registro, chat por pedido
*/

const $t = s => document.querySelector(s);
const $$t = s => document.querySelectorAll(s);
const escT = t => String(t??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));

function imgFbT(img){
  const p=img.parentNode; if(!p) return;
  const l=img.getAttribute('data-l')||'?';
  const ph=img.getAttribute('data-ph');
  const bg=img.getAttribute('data-bg')||'';
  img.remove();
  if(ph==='tpc') p.insertAdjacentHTML('beforeend',`<div class="tpc-placeholder" style="background:${bg}"><span style="color:var(--rose)">${l}</span></div>`);
  else if(ph==='tpd'){ if(bg) p.style.background=bg; p.insertAdjacentHTML('beforeend',`<div class="tpd-placeholder"><span style="color:var(--rose)">${l}</span></div>`); }
  else if(ph==='cart') p.insertAdjacentHTML('beforeend',`<div class="t-cart-thumb-ph">${l}</div>`);
}
window.imgFbT=imgFbT;

let clienteActivo = null;
let carrito = [];
let favs = new Set(JSON.parse(localStorage.getItem('bs_favs')||'[]'));
let detalleProdId = null;
let chatPedidoId = null;
let _chatPoll = null;
let comprobanteData = null;

/* ── Comprimir imagen del comprobante (convierte HEIC de iPhone) ── */
async function comprimirImagenT(file, maxDim=1100, calidad=0.72){
  let fuente=file;
  const esHeic = /image\/hei(c|f)/i.test(file.type||'') || /\.(heic|heif)$/i.test(file.name||'');
  if(esHeic){
    if(typeof heic2any==='function'){
      try{ const conv=await heic2any({blob:file,toType:'image/jpeg',quality:0.9}); fuente=Array.isArray(conv)?conv[0]:conv; }
      catch(e){ throw {tipo:'heic'}; }
    } else { throw {tipo:'heic'}; }
  }
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onload=()=>{
      const img=new Image();
      img.onload=()=>{
        let w=img.naturalWidth||img.width, h=img.naturalHeight||img.height;
        if(w>=h && w>maxDim){ h=Math.round(h*maxDim/w); w=maxDim; }
        else if(h>w && h>maxDim){ w=Math.round(w*maxDim/h); h=maxDim; }
        try{
          const c=document.createElement('canvas'); c.width=w; c.height=h;
          c.getContext('2d').drawImage(img,0,0,w,h);
          resolve(c.toDataURL('image/jpeg',calidad));
        }catch(err){ resolve(r.result); }
      };
      img.onerror=()=>reject({tipo:'decode'});
      img.src=r.result;
    };
    r.onerror=()=>reject({tipo:'read'});
    r.readAsDataURL(fuente);
  });
}

/* ── Visor de imagen (lightbox) ── */
function verImagenT(src){
  if(!src) return;
  const ov=document.createElement('div');
  ov.className='t-lightbox';
  ov.innerHTML=`<img src="${src}" alt="">`;
  ov.addEventListener('click',()=>ov.remove());
  document.body.appendChild(ov);
}
window.verImagenT=verImagenT;

/* ── TOASTS ── */
function toastT(msg, tipo='ok'){
  const el=document.createElement('div');
  el.className=`t-toast ${tipo==='ok'?'':tipo}`;
  const icon=tipo==='ok'?'check':'alerta';
  el.innerHTML=`<span class="t-toast-dot"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><use href="#icon-${icon}"/></svg></span><span>${escT(msg)}</span>`;
  $t('#t-toasts').appendChild(el);
  setTimeout(()=>{ el.classList.add('out'); setTimeout(()=>el.remove(),280); },3200);
}

/* ── TABS + AUTH ── */
function swTab(name){
  document.querySelectorAll('.sw-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.sw-panel').forEach(p=>p.classList.remove('active'));
  const tab=document.getElementById('tab-'+name);
  const panel=document.getElementById('panel-'+name);
  if(tab) tab.classList.add('active');
  if(panel) panel.classList.add('active');
  // clear errors
  ['sw-admin-error','t-reg-error','t-login-error'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.textContent='';
  });
}

function swTogglePass(inputId, btn){
  const inp=document.getElementById(inputId); if(!inp) return;
  const isPass=inp.type==='password';
  inp.type=isPass?'text':'password';
  btn.innerHTML=isPass
    ?'<svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
    :'<svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
}

let intentoCheckout=false;

/* Marca de la tienda (logo + nombre) en el header */
function aplicarMarcaTienda(){
  const logoEl=document.getElementById('t-logo-mark');
  if(logoEl) logoEl.innerHTML=DB.config.logo?`<img src="${DB.config.logo}" alt="">`:(DB.config.nombre||'S')[0].toUpperCase();
  const n=document.getElementById('t-tienda-nombre'); if(n) n.textContent=DB.config.nombre;
  document.title=`${DB.config.nombre} · Tienda`;
}

/* Alterna el header entre invitado ("Iniciar sesión") y con sesión (pill + salir) */
function actualizarHeaderSesion(){
  const logged=!!clienteActivo;
  const pill=document.getElementById('t-sesion-usuario');
  const loginBtn=document.getElementById('t-btn-login-header');
  if(pill) pill.style.display=logged?'flex':'none';
  if(loginBtn) loginBtn.style.display=logged?'none':'inline-flex';
  if(logged){
    const un=document.getElementById('t-user-nombre'); if(un) un.textContent=clienteActivo.nombre.split(' ')[0];
    const av=document.getElementById('t-user-av'); if(av) av.textContent=clienteActivo.nombre[0].toUpperCase();
  }
}

/* Entrar a la tienda como INVITADO (sin cuenta) — puede ver todo y armar carrito */
function mostrarBienvenida(){
  clienteActivo=null;
  const ap=document.getElementById('t-auth-page'); if(ap) ap.style.display='none';
  const app=document.getElementById('t-app'); if(app) app.style.display='block';
  aplicarMarcaTienda();
  actualizarHeaderSesion();
  ocultarChatFab();
  if(_chatPoll){ clearInterval(_chatPoll); _chatPoll=null; }
  updateBadge();
  actualizarFavBadge();
  goToT('inicio');
}

/* Abrir / cerrar el panel de acceso (modal) */
function abrirLogin(tab){
  const ap=document.getElementById('t-auth-page'); if(ap) ap.style.display='flex';
  swTab(tab||'cliente');
}
function cerrarLogin(){
  const ap=document.getElementById('t-auth-page'); if(ap) ap.style.display='none';
  intentoCheckout=false;
}
window.abrirLogin=abrirLogin; window.cerrarLogin=cerrarLogin;

/* ── ADMIN LOGIN ── */
const ADMIN_CREDENTIALS={ email:'admin@siwepe.com', password:'admin1234' };

async function swLoginAdmin(){
  const email=(document.getElementById('sw-admin-email')?.value||'').trim().toLowerCase();
  const pass=(document.getElementById('sw-admin-pass')?.value||'').trim();
  const errEl=document.getElementById('sw-admin-error');
  if(!email||!pass){ errEl.textContent='Completa ambos campos.'; return; }
  try{
    const {token,user}=await apiPost('/api/auth/login',{email,password:pass});
    guardarSesionToken(token, user.role, user.nombre);
    sessionStorage.setItem('sw_admin_auth','1');
    window.location.href='admin.html';
  }catch(e){ errEl.textContent=e.message||'Correo o contraseña incorrectos.'; }
}

/* ── REGISTRO ── */
async function submitRegistro(){
  const nombre=(document.getElementById('t-reg-nombre')?.value||'').trim();
  const tel=(document.getElementById('t-reg-tel')?.value||'').trim();
  const correo=(document.getElementById('t-reg-correo')?.value||'').trim();
  const dir=(document.getElementById('t-reg-dir')?.value||'').trim();
  const pin=(document.getElementById('t-reg-pin')?.value||'').trim();
  const pin2=(document.getElementById('t-reg-pin2')?.value||'').trim();
  const errEl=document.getElementById('t-reg-error');
  if(!nombre){ errEl.textContent='El nombre es obligatorio.'; return; }
  if(!pin||pin.length<4){ errEl.textContent='El PIN debe tener al menos 4 dígitos.'; return; }
  if(pin!==pin2){ errEl.textContent='Los PINs no coinciden.'; return; }
  if(!/^\d+$/.test(pin)){ errEl.textContent='El PIN solo puede tener números.'; return; }
  try{
    const {token,cliente}=await apiPost('/api/auth/register',{nombre,pin,telefono:tel,correo,direccion:dir,empresa:bsEmpresa()});
    guardarSesionToken(token,'cliente',cliente.nombre);
    errEl.textContent='';
    await bootstrapDB();               // recargar estado con el cliente nuevo
    toastT('¡Cuenta creada!');
    entrarComoCliente(cliente);
  }catch(e){ errEl.textContent=e.message||'No se pudo crear la cuenta.'; }
}

/* ── LOGIN CLIENTE ── */
async function submitLoginT(){
  const nombre=(document.getElementById('t-login-nombre')?.value||'').trim();
  const pin=(document.getElementById('t-login-pin')?.value||'').trim();
  const errEl=document.getElementById('t-login-error');
  try{
    const {token,cliente}=await apiPost('/api/auth/cliente-login',{nombre,pin,empresa:bsEmpresa()});
    guardarSesionToken(token,'cliente',cliente.nombre);
    await bootstrapDB();               // recargar estado completo con sesión
    entrarComoCliente(cliente);
  }catch(e){ if(errEl) errEl.textContent=e.message||'Nombre o PIN incorrecto.'; }
}

function entrarComoCliente(cli){
  clienteActivo=cli;
  try{ localStorage.setItem('bs_sesion_cli', cli.id); }catch(e){}
  const ap=document.getElementById('t-auth-page'); if(ap) ap.style.display='none';
  const app=document.getElementById('t-app'); if(app) app.style.display='block';
  aplicarMarcaTienda();
  actualizarHeaderSesion();
  mostrarChatFab();
  iniciarPollChat();
  updateBadge();
  actualizarFavBadge();
  /* Si venía intentando pagar como invitado, reabrir el carrito para completar */
  if(intentoCheckout && carrito.length){
    intentoCheckout=false;
    goToT('inicio');
    setTimeout(()=>abrirCarrito(),350);
  } else {
    goToT('inicio');
  }
}

function salirTienda(){
  try{ localStorage.removeItem('bs_sesion_cli'); }catch(e){}
  limpiarSesionToken();
  carrito=[]; comprobanteData=null; clienteActivo=null;
  if(_chatPoll){ clearInterval(_chatPoll); _chatPoll=null; }
  cerrarChat(); ocultarChatFab();
  mostrarBienvenida();
}

/* ── NAV ── */
function goToT(page){
  $$t('.t-page').forEach(p=>p.classList.remove('active'));
  $$t('.t-nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  const el=$t('#tp-'+page); if(el) el.classList.add('active');
  if(page==='inicio')    renderInicio();
  if(page==='catalogo')  renderCatalogo();
  if(page==='pedidos')   renderMisPedidos();
  window.scrollTo({top:0});
}

/* ── HERO (imagen/carrusel del admin) ── */
let _heroTimer=null;
function renderHero(){
  const bg=$t('#t-hero-bg'), dots=$t('#t-hero-dots');
  if(!bg) return;
  const imgs=(DB.config.banners||[]).filter(Boolean);
  if(_heroTimer){ clearInterval(_heroTimer); _heroTimer=null; }
  if(!imgs.length){
    bg.innerHTML=''; bg.classList.add('t-hero-empty');
    if(dots) dots.innerHTML='';
    return;
  }
  bg.classList.remove('t-hero-empty');
  bg.innerHTML=imgs.map((src,i)=>`<div class="t-hero-slide${i===0?' active':''}" style="background-image:url('${String(src).replace(/'/g,"%27")}')"></div>`).join('');
  if(dots) dots.innerHTML = imgs.length>1 ? imgs.map((_,i)=>`<span class="t-hero-dot${i===0?' active':''}"></span>`).join('') : '';
  if(imgs.length>1){
    const slides=bg.querySelectorAll('.t-hero-slide');
    const dotEls=dots?dots.querySelectorAll('.t-hero-dot'):[];
    let idx=0;
    _heroTimer=setInterval(()=>{
      slides[idx].classList.remove('active'); if(dotEls[idx]) dotEls[idx].classList.remove('active');
      idx=(idx+1)%slides.length;
      slides[idx].classList.add('active'); if(dotEls[idx]) dotEls[idx].classList.add('active');
    },5000);
  }
}

/* ── FILTROS (barra lateral) ── */
const TIPOS_PIEL_T=['Grasa','Seca','Mixta','Sensible','Normal'];
let filtros={cat:'',tipos:new Set(),marcas:new Set(),pmin:0,pmax:null,favOnly:false};

function _activosT(){ return DB.productos.filter(p=>p.estado==='activo'); }
function _marcasT(){ return [...new Set(_activosT().map(p=>(p.marca||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b)); }
function _tiposT(){ const s=new Set(); _activosT().forEach(p=>(p.tipoPiel||[]).forEach(t=>s.add(t))); return TIPOS_PIEL_T.filter(t=>s.has(t)); }
function _maxPrecioT(){ const ps=_activosT().map(p=>p.precio_venta||0); const m=ps.length?Math.max(...ps):1000; return Math.max(100,Math.ceil(m/100)*100); }

function renderFiltros(){
  const page=$t('.t-page.active'); if(!page) return;
  const host=page.querySelector('.t-filtros-sidebar');
  $$t('.t-filtros-sidebar').forEach(s=>{ if(s!==host) s.innerHTML=''; });
  if(!host) return;
  const cats=DB.categorias.filter(c=>c.estado==='activo');
  const marcas=_marcasT(), tipos=_tiposT(), maxP=_maxPrecioT();
  if(filtros.pmax==null) filtros.pmax=maxP;

  const catRows=`<button class="t-fcat ${filtros.cat===''?'active':''}" onclick="setCatFiltro('')">Todas las categorías</button>`+
    cats.map(c=>`<button class="t-fcat ${filtros.cat===String(c.id)?'active':''}" onclick="setCatFiltro('${c.id}')">${escT(c.nombre)}</button>`).join('');

  const tiposBox = tipos.length?`
    <div class="t-fgroup">
      <div class="t-fgroup-t">Tipo de piel</div>
      ${tipos.map(t=>`<label class="t-fcheck"><input type="checkbox" ${filtros.tipos.has(t)?'checked':''} onchange="toggleTipoFiltro('${t}')"> ${t}</label>`).join('')}
    </div>`:'';

  const marcasBox = marcas.length?`
    <div class="t-fgroup">
      <div class="t-fgroup-t">Marca</div>
      ${marcas.map(m=>`<label class="t-fcheck"><input type="checkbox" ${filtros.marcas.has(m)?'checked':''} onchange="toggleMarcaFiltro('${escT(m).replace(/'/g,"\\'")}')"> ${escT(m)}</label>`).join('')}
    </div>`:'';

  host.innerHTML=`
    <div class="t-filtros-head"><h3>Filtros</h3><button class="t-filtros-clear" onclick="limpiarFiltros()">Limpiar todo</button></div>
    <div class="t-fgroup">
      <div class="t-fgroup-t">Categoría</div>
      <div class="t-fcats">${catRows}</div>
    </div>
    ${tiposBox}
    <div class="t-fgroup">
      <div class="t-fgroup-t">Rango de precio</div>
      <input type="range" class="t-frange" id="t-precio-max" min="0" max="${maxP}" step="10" value="${filtros.pmax}" oninput="setPrecioFiltro(this.value)">
      <div class="t-frange-lbl"><span>${DB.config.moneda} 0</span><span id="t-precio-lbl">${DB.config.moneda} ${filtros.pmax>=maxP?maxP+'+':filtros.pmax}</span></div>
    </div>
    ${marcasBox}`;
}

function setCatFiltro(id){ filtros.cat=String(id); filtros.favOnly=false; onFiltroChange(true); }
function toggleTipoFiltro(t){ filtros.tipos.has(t)?filtros.tipos.delete(t):filtros.tipos.add(t); onFiltroChange(true); }
function toggleMarcaFiltro(m){ filtros.marcas.has(m)?filtros.marcas.delete(m):filtros.marcas.add(m); onFiltroChange(true); }
function setPrecioFiltro(v){
  filtros.pmax=+v;
  const maxP=_maxPrecioT(), lbl=$t('#t-precio-lbl');
  if(lbl) lbl.textContent=`${DB.config.moneda} ${filtros.pmax>=maxP?maxP+'+':filtros.pmax}`;
  onFiltroChange(false);
}
function limpiarFiltros(){
  filtros={cat:'',tipos:new Set(),marcas:new Set(),pmin:0,pmax:_maxPrecioT(),favOnly:false};
  const s=$t('#t-search-inp'); if(s) s.value='';
  onFiltroChange(true);
}
window.setCatFiltro=setCatFiltro; window.toggleTipoFiltro=toggleTipoFiltro;
window.toggleMarcaFiltro=toggleMarcaFiltro; window.setPrecioFiltro=setPrecioFiltro;
window.limpiarFiltros=limpiarFiltros;

function onFiltroChange(reSidebar){
  if($t('#tp-catalogo')?.classList.contains('active')){
    if(reSidebar) renderFiltros();
    renderGridCatalogo();
  } else {
    goToT('catalogo');
  }
}

function verFavoritos(){ filtros.favOnly=true; goToT('catalogo'); }
window.verFavoritos=verFavoritos;

/* ── INICIO ── */
function renderInicio(){
  renderFiltros();
  renderHero();
  const dest=_activosT().filter(p=>p.destacado).slice(0,8);
  const gridEl=$t('#inicio-destacados');
  if(gridEl) gridEl.innerHTML=dest.map(p=>prodCardHtml(p)).join('')||'<p style="color:var(--text-soft);grid-column:1/-1">Aún no hay productos destacados.</p>';
  const cats=DB.categorias.filter(c=>c.estado==='activo');
  const catsEl=$t('#inicio-cats');
  if(catsEl) catsEl.innerHTML=cats.map(c=>{
    const n=DB.productos.filter(p=>p.categoria_id===c.id&&p.estado==='activo').length;
    return `<div class="t-col-card" onclick="setCatFiltro('${c.id}')"><div class="t-col-ic">${escT(c.nombre[0]||'·').toUpperCase()}</div><h4>${escT(c.nombre)}</h4><span>${n} producto${n!==1?'s':''}</span></div>`;
  }).join('');
}

/* ── CATÁLOGO ── */
function renderCatalogo(){
  renderFiltros();
  renderGridCatalogo();
}

function _filtrarProductos(){
  const q=($t('#t-search-inp')?.value||'').trim().toLowerCase();
  const orden=$t('#t-filtro-orden')?.value||'';
  let prods=_activosT();
  if(filtros.favOnly) prods=prods.filter(p=>favs.has(p.id));
  if(filtros.cat) prods=prods.filter(p=>p.categoria_id===+filtros.cat);
  if(filtros.tipos.size) prods=prods.filter(p=>(p.tipoPiel||[]).some(t=>filtros.tipos.has(t)));
  if(filtros.marcas.size) prods=prods.filter(p=>filtros.marcas.has((p.marca||'').trim()));
  const pmax=filtros.pmax==null?Infinity:filtros.pmax;
  prods=prods.filter(p=>p.precio_venta>=(filtros.pmin||0)&&p.precio_venta<=pmax);
  if(q) prods=prods.filter(p=>p.nombre.toLowerCase().includes(q)||(p.descripcion||'').toLowerCase().includes(q)||(p.marca||'').toLowerCase().includes(q));
  if(orden==='precio-asc') prods.sort((a,b)=>a.precio_venta-b.precio_venta);
  else if(orden==='precio-desc') prods.sort((a,b)=>b.precio_venta-a.precio_venta);
  else if(orden==='nombre') prods.sort((a,b)=>a.nombre.localeCompare(b.nombre));
  return prods;
}

function renderGridCatalogo(){
  const prods=_filtrarProductos();
  const countEl=$t('#t-catalogo-count');
  if(countEl) countEl.textContent=`${prods.length} producto${prods.length!==1?'s':''}`;

  const activeEl=$t('#t-catalogo-active');
  if(activeEl){
    const chips=[];
    if(filtros.favOnly) chips.push(`<button class="t-active-chip" onclick="filtros.favOnly=false;renderCatalogo()">Favoritos ×</button>`);
    if(filtros.cat){ const c=catPor(+filtros.cat); if(c) chips.push(`<button class="t-active-chip" onclick="setCatFiltro('')">${escT(c.nombre)} ×</button>`); }
    filtros.tipos.forEach(t=>chips.push(`<button class="t-active-chip" onclick="toggleTipoFiltro('${t}')">${t} ×</button>`));
    filtros.marcas.forEach(m=>chips.push(`<button class="t-active-chip" onclick="toggleMarcaFiltro('${escT(m).replace(/'/g,"\\'")}')">${escT(m)} ×</button>`));
    activeEl.innerHTML=chips.length?`<div class="t-active-chips">${chips.join('')}</div>`:'';
  }

  const gridEl=$t('#t-catalogo-grid');
  if(!gridEl) return;
  if(!prods.length){ gridEl.innerHTML=`<div class="t-empty" style="grid-column:1/-1"><h3>Sin resultados</h3><p>Prueba quitando algunos filtros.</p></div>`; return; }
  gridEl.innerHTML=prods.map(p=>prodCardHtml(p)).join('');
}

function prodCardHtml(p){
  const cat=catPor(p.categoria_id);
  const agotado=p.stock<=0;
  const enCar=carrito.find(i=>i.producto_id===p.id);
  const isFav=favs.has(p.id);
  const GRADS=['linear-gradient(135deg,#F3F4F6,#E5E7EB)','linear-gradient(135deg,#EEF0F2,#DDE1E6)','linear-gradient(135deg,#F4F4F5,#E4E4E7)','linear-gradient(135deg,#F1F3F5,#E2E6EA)','linear-gradient(135deg,#F5F5F4,#E7E5E4)','linear-gradient(135deg,#EDEFF2,#DCE0E5)'];
  let h=0; for(let i=0;i<p.nombre.length;i++) h=(h*31+p.nombre.charCodeAt(i))&0xFFFFFF;
  const g=GRADS[h%GRADS.length];
  const sub=(p.marca||'').trim()||(cat?cat.nombre:'');
  const addBtn=agotado
    ?`<button class="tpc-add-btn sold" disabled>Agotado</button>`
    :enCar
      ?`<div class="tpc-qty-ctrl"><button onclick="event.stopPropagation();cambiarCantT(${p.id},-1)">−</button><span>${enCar.cantidad}</span><button onclick="event.stopPropagation();cambiarCantT(${p.id},1)">+</button></div>`
      :`<button class="tpc-add-btn" onclick="event.stopPropagation();agregarT(${p.id})"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><use href="#icon-bolsa"/></svg> Agregar al carrito</button>`;
  return `
  <div class="t-prod-card ${agotado?'soldout':''}" onclick="abrirDetalle(${p.id})">
    <div class="tpc-img">
      ${p.imagen?`<img src="${p.imagen}" alt="${escT(p.nombre)}" data-ph="tpc" data-l="${p.nombre[0].toUpperCase()}" data-bg="${g}" onerror="imgFbT(this)">`:`<div class="tpc-placeholder" style="background:${g}"><span style="color:var(--rose)">${p.nombre[0].toUpperCase()}</span></div>`}
      ${agotado?`<div class="tpc-soldout-veil">Agotado</div>`:''}
      <button class="tpc-fav ${isFav?'faved':''}" onclick="event.stopPropagation();toggleFav(${p.id})" title="Favorito">
        <svg width="16" height="16" fill="${isFav?'var(--rose)':'none'}" stroke="var(--rose)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><use href="#icon-corazon"/></svg>
      </button>
    </div>
    <div class="tpc-body">
      <h4 class="tpc-name">${escT(p.nombre)}</h4>
      ${sub?`<div class="tpc-brand">${escT(sub)}</div>`:''}
      <div class="tpc-price">${dinero(p.precio_venta)}</div>
      ${addBtn}
    </div>
  </div>`;
}

/* ── DETALLE ── */
function abrirDetalle(id){
  detalleProdId=id;
  const p=prodPor(id); if(!p) return;
  const cat=catPor(p.categoria_id);
  const agotado=p.stock<=0;
  const GRADS=['linear-gradient(135deg,#F3F4F6,#E5E7EB)','linear-gradient(135deg,#EEF0F2,#DDE1E6)','linear-gradient(135deg,#F4F4F5,#E4E4E7)','linear-gradient(135deg,#F1F3F5,#E2E6EA)'];
  let h=0; for(let i=0;i<p.nombre.length;i++) h=(h*31+p.nombre.charCodeAt(i))&0xFFFFFF;
  const g=GRADS[h%GRADS.length];
  const el=$t('#t-detail');
  el.innerHTML=`
    <div class="tpd-img" style="${!p.imagen?'background:'+g:''}">
      ${p.imagen?`<img src="${p.imagen}" alt="${escT(p.nombre)}" data-ph="tpd" data-l="${p.nombre[0].toUpperCase()}" data-bg="${g}" onerror="imgFbT(this)">`:`<div class="tpd-placeholder"><span style="color:var(--rose)">${p.nombre[0].toUpperCase()}</span></div>`}
      <button class="tpd-close" onclick="cerrarDetalle()"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
    </div>
    <div class="tpd-body">
      <div class="tpd-cat">${escT(cat?cat.nombre:'')}</div>
      <h2 class="tpd-name">${escT(p.nombre)}</h2>
      <p class="tpd-desc">${escT(p.descripcion||'Sin descripción disponible.')}</p>
      <div class="tpd-price">${dinero(p.precio_venta)}</div>
      <p class="tpd-stock">${agotado?'<span style="color:var(--error)">Agotado</span>':`${p.stock} unidades disponibles`}</p>
      <button class="tpd-add-btn" ${agotado?'disabled style="opacity:.5;cursor:not-allowed"':''} onclick="agregarT(${p.id});cerrarDetalle()">
        ${agotado?'Sin stock':'+ Agregar al carrito'}
      </button>
    </div>`;
  $t('#t-detail-overlay').classList.add('open');
}
function cerrarDetalle(){ $t('#t-detail-overlay').classList.remove('open'); }

/* ── FAVORITOS ── */
function toggleFav(id){
  if(favs.has(id)) favs.delete(id); else favs.add(id);
  localStorage.setItem('bs_favs',JSON.stringify([...favs]));
  refrescarVista(); actualizarFavBadge();
}
function actualizarFavBadge(){
  const n=[...favs].filter(id=>{ const p=prodPor(id); return p&&p.estado==='activo'; }).length;
  const b=$t('#t-fav-badge'); if(b){ b.textContent=n||''; b.style.display=n?'flex':'none'; }
}
window.actualizarFavBadge=actualizarFavBadge;

/* Re-render solo de las cuadrículas visibles (sin reconstruir el hero) */
function refrescarVista(){
  if($t('#tp-catalogo')?.classList.contains('active')) renderGridCatalogo();
  if($t('#tp-inicio')?.classList.contains('active')){
    const dgrid=$t('#inicio-destacados');
    if(dgrid){
      const dest=_activosT().filter(p=>p.destacado).slice(0,8);
      dgrid.innerHTML=dest.map(p=>prodCardHtml(p)).join('')||'<p style="color:var(--text-soft);grid-column:1/-1">Aún no hay productos destacados.</p>';
    }
  }
}

/* ── CARRITO ── */
function agregarT(prodId){
  const p=prodPor(prodId); if(!p||p.stock<=0) return;
  const exist=carrito.find(i=>i.producto_id===prodId);
  if(exist){ if(exist.cantidad>=p.stock){ toastT('No hay más stock','warn'); return; } exist.cantidad++; }
  else carrito.push({producto_id:prodId,nombre:p.nombre,precio:p.precio_venta,cantidad:1,imagen:p.imagen});
  updateBadge(); refrescarVista();
  toastT(`${p.nombre} agregado al carrito`);
}

function cambiarCantT(prodId,delta){
  const idx=carrito.findIndex(i=>i.producto_id===prodId);
  if(idx===-1) return;
  carrito[idx].cantidad+=delta;
  if(carrito[idx].cantidad<=0) carrito.splice(idx,1);
  else{ const p=prodPor(prodId); if(p&&carrito[idx].cantidad>p.stock){ carrito[idx].cantidad=p.stock; toastT('Máximo disponible','warn'); } }
  updateBadge();
  const panelOpen=$t('#t-cart-overlay')?.classList.contains('open');
  if(panelOpen) renderCartPanel();
  refrescarVista();
}

function updateBadge(){
  const total=carrito.reduce((s,i)=>s+i.cantidad,0);
  const b=$t('#t-cart-badge'); if(b){ b.textContent=total||''; b.style.display=total?'flex':'none'; }
}

function abrirCarrito(){ $t('#t-cart-overlay').classList.add('open'); renderCartPanel(); }
function cerrarCarrito(){ $t('#t-cart-overlay').classList.remove('open'); }

/* Buscar pedido pendiente del cliente activo */
function pedidoPendienteCliente(){
  if(!clienteActivo) return null;
  return DB.pedidos.find(p=>p.cliente_id===clienteActivo.id&&p.estado==='pendiente')||null;
}

function renderCartPanel(){
  const cont=$t('#t-cart-items');
  const footer=$t('#t-cart-footer');
  const bannerEl=$t('#t-cart-pedido-banner');
  if(!cont) return;

  // Banner pedido pendiente
  const pedPend=pedidoPendienteCliente();
  if(bannerEl){
    if(pedPend&&carrito.length>0){
      bannerEl.innerHTML=`<div class="t-pedido-pendiente-banner">
        <p>Tienes el pedido <strong>#${pedPend.id}</strong> pendiente. ¿Sumar estos productos a ese pedido?</p>
        <button onclick="agregarAPedidoPendiente()">Sumar al pedido #${pedPend.id}</button>
      </div>`;
    } else { bannerEl.innerHTML=''; }
  }

  if(!carrito.length){
    cont.innerHTML=`<div class="t-cart-empty"><svg width="60" height="60" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" opacity=".25"><use href="#icon-bolsa"/></svg><p>Tu carrito está vacío</p><button class="t-btn t-btn-primary" onclick="cerrarCarrito();goToT('catalogo')">Ver catálogo</button></div>`;
    if(footer) footer.style.display='none';
    return;
  }

  const subtotal=carrito.reduce((s,i)=>s+i.precio*i.cantidad,0);
  cont.innerHTML=carrito.map(it=>`
    <div class="t-cart-item">
      <div class="t-cart-thumb">${it.imagen?`<img src="${it.imagen}" alt="" data-ph="cart" data-l="${(it.nombre[0]||'?').toUpperCase()}" onerror="imgFbT(this)">`:`<div class="t-cart-thumb-ph">${(it.nombre[0]||'?').toUpperCase()}</div>`}</div>
      <div class="t-cart-info"><strong>${escT(it.nombre)}</strong><span>${dinero(it.precio)} c/u</span></div>
      <div class="t-cart-item-qty">
        <button onclick="cambiarCantT(${it.producto_id},-1)">−</button>
        <span>${it.cantidad}</span>
        <button onclick="cambiarCantT(${it.producto_id},1)">+</button>
      </div>
      <span class="t-cart-item-sub">${dinero(it.precio*it.cantidad)}</span>
      <button class="t-cart-del" onclick="cambiarCantT(${it.producto_id},-999)"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><use href="#icon-basura"/></svg></button>
    </div>`).join('');
  const tv=$t('#t-cart-total'); if(tv) tv.textContent=dinero(subtotal);
  if(footer) footer.style.display='block';
  renderPagoTransferencia();
}

/* ── Datos bancarios + comprobante ── */
function renderPagoTransferencia(){
  const datosEl=$t('#t-pago-datos');
  if(datosEl){
    const pago=(DB.config&&DB.config.pago)||{};
    const filas=[];
    if(pago.banco)   filas.push(['Banco',pago.banco,false]);
    if(pago.cuenta)  filas.push(['Cuenta',pago.cuenta,true]);
    if(pago.titular) filas.push(['Titular',pago.titular,false]);
    if(pago.tipo)    filas.push(['Tipo',pago.tipo,false]);
    if(!filas.length){
      datosEl.innerHTML=`<p class="t-pago-vacio">Solicita los datos de la cuenta a la tienda por el chat del pedido y sube tu comprobante aquí.</p>`;
    } else {
      const copyBtn=v=>`<button class="t-pago-copy" title="Copiar" onclick="copiarTextoT('${String(v).replace(/'/g,"\\'")}',this)"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>`;
      datosEl.innerHTML=filas.map(([k,v,copiable])=>`<div class="t-pago-row"><span class="t-pago-k">${escT(k)}</span><span class="t-pago-v">${escT(v)}${copiable?copyBtn(v):''}</span></div>`).join('')
        +(pago.nota?`<div class="t-pago-nota">${escT(pago.nota)}</div>`:'');
    }
  }
  renderComprobanteZona();
}

function renderComprobanteZona(){
  const zona=$t('#t-comprobante-zona'); if(!zona) return;
  if(comprobanteData){
    zona.innerHTML=`<div class="t-comprobante-prev">
      <button class="t-comprobante-del" title="Quitar" onclick="quitarComprobante()"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
      <img src="${comprobanteData}" alt="Comprobante" onclick="verImagenT('${comprobanteData}')">
      <div class="t-comprobante-ok"><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><use href="#icon-check"/></svg> Comprobante listo</div>
    </div>`;
  } else {
    zona.innerHTML=`<label class="t-comprobante-btn" for="t-comprobante-inp">
      <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      Subir foto del comprobante
    </label>`;
  }
}

function quitarComprobante(){
  comprobanteData=null;
  renderComprobanteZona();
}
window.quitarComprobante=quitarComprobante;

function copiarTextoT(txt,btn){
  const ok=()=>{ if(btn){ const o=btn.innerHTML; btn.innerHTML='<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><use href="#icon-check"/></svg>'; setTimeout(()=>btn.innerHTML=o,1200); } toastT('Copiado'); };
  if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(txt).then(ok).catch(()=>ok()); }
  else { try{ const ta=document.createElement('textarea'); ta.value=txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }catch(e){} ok(); }
}
window.copiarTextoT=copiarTextoT;

function onComprobanteSeleccion(e){
  const f=e.target.files[0]; if(!f) return;
  e.target.value='';
  if(!f.type.startsWith('image/')&&!/\.(heic|heif)$/i.test(f.name||'')){ toastT('Selecciona una imagen','warn'); return; }
  toastT('Procesando imagen…');
  comprimirImagenT(f,1100,0.72).then(dataUrl=>{
    comprobanteData=dataUrl;
    renderComprobanteZona();
    toastT('Comprobante cargado');
  }).catch(err=>{
    const m=err&&err.tipo==='heic'?'No se pudo convertir la foto HEIC. Intenta con otra.':'No se pudo leer la imagen.';
    toastT(m,'error');
  });
}

/* ── SUMAR AL PEDIDO PENDIENTE ── */
function agregarAPedidoPendiente(){
  const ped=pedidoPendienteCliente();
  if(!ped||!carrito.length) return;
  for(const it of carrito){
    const exist=ped.items.find(i=>i.producto_id===it.producto_id);
    if(exist){ exist.cantidad+=it.cantidad; exist.subtotal=+(exist.precio*exist.cantidad).toFixed(2); }
    else ped.items.push({producto_id:it.producto_id,cantidad:it.cantidad,precio:it.precio,subtotal:+(it.precio*it.cantidad).toFixed(2)});
  }
  ped.total=ped.items.reduce((s,i)=>s+i.subtotal,0);
  dbGuardar();
  carrito=[];
  updateBadge();
  cerrarCarrito();
  toastT(`Productos sumados al pedido #${ped.id}`);
  setTimeout(()=>goToT('pedidos'),700);
}

/* ── CONFIRMAR PEDIDO NUEVO ── */
function confirmarPedidoT(){
  if(!carrito.length){ toastT('Tu carrito está vacío','warn'); return; }
  if(!clienteActivo){
    intentoCheckout=true;
    cerrarCarrito();
    abrirLogin('cliente');
    toastT('Inicia sesión o crea tu cuenta para completar tu pedido','warn');
    return;
  }
  if(!comprobanteData){ toastT('Sube la foto del comprobante de tu transferencia','warn'); return; }
  const nota=($t('#t-pedido-nota')?.value||'').trim();
  const items=carrito.map(it=>({producto_id:it.producto_id,cantidad:it.cantidad,precio:it.precio,subtotal:+(it.precio*it.cantidad).toFixed(2)}));
  const total=items.reduce((s,i)=>s+i.subtotal,0);
  const pedId=nuevoId('pedido');
  DB.pedidos.push({id:pedId,cliente_id:clienteActivo.id,items,total,nota,fecha:hoy(),estado:'pendiente',metodoPago:'transferencia',comprobante:comprobanteData});
  if(!dbGuardar()) return;
  carrito=[]; comprobanteData=null; updateBadge(); cerrarCarrito();
  const notaEl=$t('#t-pedido-nota'); if(notaEl) notaEl.value='';
  toastT('¡Pedido enviado! Verificaremos tu pago pronto');
  setTimeout(()=>{ goToT('pedidos'); }, 800);
}

/* ── MIS PEDIDOS ── */
const ESTADO_LABELS={'pendiente':'Pendiente','aprobado':'Confirmado','entregado':'Entregado','cancelado':'Cancelado'};

function pedidoStepHtml(ped){
  if(ped.estado==='cancelado') return `<div style="text-align:center;padding:12px;background:var(--error-bg);border-radius:var(--r-sm);color:var(--error);font-size:13px;font-weight:600">Pedido cancelado</div>`;
  const steps=['pendiente','aprobado','entregado'];
  const stepLabels=['Enviado','Confirmado','Entregado'];
  const stepIcons=['1','2','3'];
  const idx=steps.indexOf(ped.estado);
  return `<div class="t-ped-status-bar">${steps.map((s,i)=>{
    const done=i<=idx,current=i===idx;
    return `<div class="t-ped-step ${done?'done':''} ${current?'current':''}"><div class="t-ped-step-dot">${done?stepIcons[i]:'○'}</div><div class="t-ped-step-label">${stepLabels[i]}</div></div>`;
  }).join('')}</div>`;
}

function renderMisPedidos(){
  const el=$t('#t-mis-pedidos');
  if(!el) return;
  if(!clienteActivo){
    el.innerHTML=`<div class="t-empty"><h3>Inicia sesión para ver tus pedidos</h3><p>Entra con tu nombre y PIN, o crea tu cuenta, para ver el seguimiento de tus compras.</p><button class="t-btn t-btn-primary" onclick="abrirLogin('cliente')">Iniciar sesión</button></div>`;
    return;
  }
  dbCargar();
  const mios=[...DB.pedidos].filter(p=>p.cliente_id===clienteActivo.id).sort((a,b)=>b.id-a.id);
  if(!mios.length){ el.innerHTML=`<div class="t-empty"><h3>Sin pedidos aún</h3><p>Cuando hagas tu primer pedido aparecerá aquí.</p><button class="t-btn t-btn-primary" onclick="goToT('catalogo')">Explorar productos</button></div>`; return; }
  if(!mios.length){ el.innerHTML=`<div class="t-empty"><h3>Sin pedidos aún</h3><p>Cuando hagas tu primer pedido aparecerá aquí.</p><button class="t-btn t-btn-primary" onclick="goToT('catalogo')">Explorar productos</button></div>`; return; }

  el.innerHTML=mios.map(p=>{
    const bc=p.estado==='pendiente'?'tb-warn':p.estado==='aprobado'?'tb-rose':p.estado==='entregado'?'tb-ok':'tb-muted';
    const itemRows=p.items.map(it=>{ const prod=prodPor(it.producto_id); return `<div class="t-ped-item-row"><span class="t-ped-item-nombre">${escT(prod?prod.nombre:'Producto eliminado')}</span><span class="t-ped-item-cant">×${it.cantidad}</span><span class="t-ped-item-sub">${dinero(it.subtotal)}</span></div>`; }).join('');
    const noLeidos=mensajesNoLeidos(p.id,'cliente');
    const chatActivo=p.estado!=='cancelado';
    const chatBtnHtml=chatActivo?`<button class="t-ped-chat-btn" onclick="abrirChatPedido(${p.id})">
      <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><use href="#icon-chat"/></svg>
      Chat del pedido ${noLeidos?`<span class="badge-unread">${noLeidos}</span>`:''}
    </button>`:'';
    const cancelBtnHtml=p.estado==='pendiente'?`<button class="t-ped-cancel-btn" onclick="cancelarPedidoCliente(${p.id})">Cancelar pedido</button>`:'';
    return `
    <div class="t-ped-card">
      <div class="t-ped-top">
        <div><div class="t-ped-num">Pedido #${p.id}</div><div class="t-ped-fecha">${fechaCorta(p.fecha)}</div></div>
        <div style="text-align:right"><span class="t-badge ${bc}">${ESTADO_LABELS[p.estado]||p.estado}</span><div class="t-ped-total">${dinero(p.total)}</div></div>
      </div>
      <div class="t-ped-items-list">${itemRows}</div>
      ${p.comprobante?`<div class="t-ped-comprobante" onclick="verImagenT('${p.comprobante}')"><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><use href="#icon-check"/></svg> Comprobante de transferencia enviado · ver</div>`:''}
      ${p.nota?`<div class="t-ped-nota"><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><use href="#icon-chat"/></svg> ${escT(p.nota)}</div>`:''}
      ${pedidoStepHtml(p)}
      <div class="t-ped-actions">${chatBtnHtml}${cancelBtnHtml}</div>
    </div>`;
  }).join('');
}

function cancelarPedidoCliente(pedId){
  const ped=pedPor(pedId);
  if(!ped||ped.estado!=='pendiente'){ toastT('Este pedido ya no se puede cancelar','warn'); return; }
  if(!confirm(`¿Seguro que quieres cancelar el pedido #${pedId}?`)) return;
  ped.estado='cancelado';
  dbGuardar();
  toastT(`Pedido #${pedId} cancelado`);
  renderMisPedidos();
}
window.cancelarPedidoCliente=cancelarPedidoCliente;

/* ── CHAT ── */
function mostrarChatFab(){
  const fab=$t('#t-chat-fab'); if(fab) fab.style.display='block';
}
function ocultarChatFab(){
  const fab=$t('#t-chat-fab'); if(fab) fab.style.display='none';
}

function actualizarBadgeFab(){
  if(!clienteActivo) return;
  dbCargar();
  const misPeds=DB.pedidos.filter(p=>p.cliente_id===clienteActivo.id&&p.estado!=='cancelado');
  const total=misPeds.reduce((s,p)=>s+mensajesNoLeidos(p.id,'cliente'),0);
  const badge=$t('#t-chat-fab-badge');
  if(badge){ badge.textContent=total||''; badge.style.display=total?'flex':'none'; }
}

function iniciarPollChat(){
  if(_chatPoll) clearInterval(_chatPoll);
  _chatPoll=setInterval(async ()=>{
    if(!clienteActivo) return;
    await refrescarEstado();               // trae pedidos/mensajes nuevos del backend
    actualizarBadgeFab();
    if($t('#t-chat-overlay')?.classList.contains('open')&&chatPedidoId){
      renderChatMsgs(chatPedidoId);
    }
    // Si el cliente está viendo "Mis pedidos", refrescar el estado de sus pedidos en vivo
    if($t('#tp-pedidos')?.classList.contains('active')) renderMisPedidos();
  },3000);
}

function abrirChatPedido(pedId){
  chatPedidoId=pedId;
  const overlay=$t('#t-chat-overlay'); if(!overlay) return;
  // Cargar selector de pedidos
  poblarSelectorPedidos(pedId);
  renderChatMsgs(pedId);
  marcarLeidosMensajes(pedId,'cliente');
  actualizarBadgeFab();
  overlay.classList.add('open');
}

function abrirChat(){
  // Abrir con el pedido más reciente no entregado
  if(!clienteActivo) return;
  dbCargar();
  const miosPeds=DB.pedidos.filter(p=>p.cliente_id===clienteActivo.id&&p.estado!=='cancelado').sort((a,b)=>b.id-a.id);
  if(!miosPeds.length){
    toastT('No tienes pedidos activos con chat disponible','warn');
    return;
  }
  abrirChatPedido(miosPeds[0].id);
}

function cerrarChat(){
  $t('#t-chat-overlay')?.classList.remove('open');
  chatPedidoId=null;
}

function poblarSelectorPedidos(selectedId){
  const sel=$t('#t-chat-pedido-select'); if(!sel) return;
  const mios=DB.pedidos.filter(p=>p.cliente_id===clienteActivo.id&&p.estado!=='cancelado').sort((a,b)=>b.id-a.id);
  sel.innerHTML=mios.map(p=>`<option value="${p.id}" ${p.id===selectedId?'selected':''}>#${p.id} · ${ESTADO_LABELS[p.estado]||p.estado} · ${dinero(p.total)}</option>`).join('');
  sel.onchange=()=>{ chatPedidoId=+sel.value; renderChatMsgs(chatPedidoId); marcarLeidosMensajes(chatPedidoId,'cliente'); actualizarBadgeFab(); };
  // Nombre tienda en header chat
  const hnom=$t('#t-chat-nombre-tienda'); if(hnom) hnom.textContent=DB.config.nombre;
  const hav=$t('#t-chat-av'); if(hav) hav.textContent=(DB.config.nombre||'S')[0].toUpperCase();
}

function renderChatMsgs(pedId){
  const cont=$t('#t-chat-msgs'); if(!cont) return;
  const ped=pedPor(pedId); if(!ped) return;
  const cerrado=ped.estado==='cancelado';
  const msgs=msgsDePedido(pedId);

  const wrap=$t('#t-chat-input-wrap');
  const closedMsg=$t('#t-chat-closed-msg');
  if(cerrado){
    if(wrap) wrap.style.display='none';
    if(closedMsg) closedMsg.style.display='block';
  } else {
    if(wrap) wrap.style.display='block';
    if(closedMsg) closedMsg.style.display='none';
  }

  if(!msgs.length){
    cont.innerHTML=`<div class="t-chat-empty"><svg width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><use href="#icon-chat"/></svg><p>Sin mensajes aún.<br>¡Escribe algo!</p></div>`;
    return;
  }

  cont.innerHTML=msgs.map(m=>{
    const isMine=m.autor==='cliente';
    const t=new Date(m.fecha).toLocaleTimeString('es-HN',{hour:'2-digit',minute:'2-digit'});
    return `<div class="t-chat-msg ${isMine?'mine':'theirs'}">
      <div class="t-chat-msg-bubble">${escT(m.texto)}</div>
      <span class="t-chat-msg-time">${t}</span>
    </div>`;
  }).join('');
  cont.scrollTop=cont.scrollHeight;
}

function enviarMensajeCliente(){
  const inp=$t('#t-chat-input'); if(!inp||!chatPedidoId) return;
  const texto=inp.value.trim(); if(!texto) return;
  const ped=pedPor(chatPedidoId); if(!ped||ped.estado==='cancelado') return;
  enviarMensaje(chatPedidoId,'cliente',texto);
  inp.value='';
  renderChatMsgs(chatPedidoId);
  marcarLeidosMensajes(chatPedidoId,'cliente');
  actualizarBadgeFab();
}

/* ── INICIALIZAR ── */
document.addEventListener('DOMContentLoaded', async ()=>{
  await bootstrapDB();
  /* Configurar marca */
  const nombre=DB.config.nombre||'Siwepe';
  const logo=DB.config.logo;
  const swLogo=document.getElementById('sw-logo');
  if(swLogo) swLogo.innerHTML=logo?`<img src="${logo}" alt="">`:(nombre||'S')[0].toUpperCase();
  const swNombre=document.getElementById('sw-nombre-marca');
  if(swNombre) swNombre.textContent=nombre;
  document.title=`${nombre} · Tienda`;

  /* Enter en campos de login */
  document.getElementById('sw-admin-pass')?.addEventListener('keydown',e=>{ if(e.key==='Enter') swLoginAdmin(); });
  document.getElementById('t-login-pin')?.addEventListener('keydown',e=>{ if(e.key==='Enter') submitLoginT(); });
  document.getElementById('t-reg-pin2')?.addEventListener('keydown',e=>{ if(e.key==='Enter') submitRegistro(); });

  /* Nav tienda */
  $$t('.t-nav-btn').forEach(b=>b.addEventListener('click',()=>goToT(b.dataset.page)));
  $t('#t-cart-btn')?.addEventListener('click',abrirCarrito);
  $t('#t-cart-close')?.addEventListener('click',cerrarCarrito);
  $t('#t-cart-overlay')?.addEventListener('click',e=>{ if(e.target.id==='t-cart-overlay') cerrarCarrito(); });
  $t('#t-detail-overlay')?.addEventListener('click',e=>{ if(e.target.id==='t-detail-overlay') cerrarDetalle(); });
  $t('#btn-confirmar-ped')?.addEventListener('click',confirmarPedidoT);
  $t('#t-comprobante-inp')?.addEventListener('change',onComprobanteSeleccion);

  /* Búsqueda */
  $t('#t-search-inp')?.addEventListener('input',()=>{
    if($t('#tp-catalogo')?.classList.contains('active')) renderGridCatalogo();
    else goToT('catalogo');
  });
  $t('#t-filtro-orden')?.addEventListener('change',renderGridCatalogo);

  /* Chat FAB */
  $t('#btn-chat-fab')?.addEventListener('click',abrirChat);
  $t('#t-chat-overlay')?.addEventListener('click',e=>{ if(e.target.id==='t-chat-overlay') cerrarChat(); });
  $t('#btn-chat-close')?.addEventListener('click',cerrarChat);
  $t('#btn-chat-send')?.addEventListener('click',enviarMensajeCliente);
  $t('#t-chat-input')?.addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); enviarMensajeCliente(); } });

  document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ cerrarCarrito(); cerrarDetalle(); cerrarChat(); } });

  iniciarFondoAnimado();

  /* Restaurar sesión del cliente si refrescó la página */
  let _idGuardado=null;
  try{ _idGuardado=+localStorage.getItem('bs_sesion_cli')||null; }catch(e){}
  const _cliGuardado=_idGuardado?DB.clientes.find(c=>c.id===_idGuardado):null;
  if(_cliGuardado) entrarComoCliente(_cliGuardado);
  else mostrarBienvenida();
});

/* ── FONDO ANIMADO ── */
function iniciarFondoAnimado(){
  const cont=$t('#t-bg-anim'); if(!cont) return;
  if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cs=getComputedStyle(document.documentElement);
  const v=k=>cs.getPropertyValue(k).trim();
  const COLORES=[v('--accent-light'),v('--accent-mid'),v('--cream-dark'),v('--accent-light'),v('--surface-2')].filter(Boolean);
  if(!COLORES.length) COLORES.push('#EFEFEF');
  const N=6; let html='';
  const r=(a,b)=>a+Math.random()*(b-a);
  for(let i=0;i<N;i++){
    const size=Math.round(r(220,440)), top=Math.round(r(-12,80)), left=Math.round(r(-12,82));
    const dur=Math.round(r(28,52)), delay=-Math.round(r(0,dur)), op=r(0.30,0.50).toFixed(2);
    const dx1=Math.round(r(-130,130)),dy1=Math.round(r(-110,110)),dx2=Math.round(r(-130,130)),dy2=Math.round(r(-110,110));
    const color=COLORES[i%COLORES.length];
    html+=`<span class="t-orb" style="top:${top}%;left:${left}%;width:${size}px;height:${size}px;background:${color};--op:${op};--dur:${dur}s;--delay:${delay}s;--dx1:${dx1}px;--dy1:${dy1}px;--dx2:${dx2}px;--dy2:${dy2}px"></span>`;
  }
  cont.innerHTML=html;
}
