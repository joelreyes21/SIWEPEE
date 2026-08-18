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
/* Anti-bot: momento en que cargó la página. Un registro que llega en menos
   de 2s desde que se abrió el sitio es prácticamente imposible que lo haya
   llenado una persona (nadie lee+escribe nombre+correo+contraseña tan
   rápido) — casi siempre es un bot con el formulario ya rellenado por script. */
const _cargaTs = Date.now();
/* Favoritos: la clave es "empresaId:productoId", nunca solo el id del
   producto — los ids de producto solo son únicos DENTRO de una tienda
   (clave compuesta empresa_id+id en el esquema), así que dos tiendas
   distintas pueden tener cada una un producto con id=1. Guardar solo el
   id numérico hacía que favoritar algo en una tienda marcara como
   favorito (con el corazón lleno, y aparecía bajo "Favoritos") a
   cualquier producto con el mismo id en OTRA tienda. */
let favs = new Set(JSON.parse(localStorage.getItem('bs_favs')||'[]'));
function favKey(id){ return `${DB.empresa_id}:${id}`; }
let detalleProdId = null;
let chatPedidoId = null;
let chatEmpresaId = null;
let _chatPoll = null;


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
  ['t-reg-error','t-login-error'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.textContent='';
  });
  setTimeout(()=>document.getElementById(name==='registro'?'t-reg-nombre':'t-login-nombre')?.focus(),60);
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
let authSolicitudEnCurso=false;

function setAuthLoading(btnId, cargando, textoEspera, textoNormal){
  const btn=document.getElementById(btnId);
  if(!btn) return;
  btn.disabled=Boolean(cargando);
  btn.setAttribute('aria-busy', cargando?'true':'false');
  btn.textContent=cargando?textoEspera:textoNormal;
}

function mensajeErrorAuth(error, accion){
  if(error?.status===409) return 'Este correo ya tiene una cuenta SIWEPE. Usa la opción Ingresar.';
  if(error?.status===401) return 'El correo o la contraseña no son correctos.';
  if(error?.status===429) return 'Has realizado varios intentos. Espera un momento y vuelve a probar.';
  if(error?.message==='Failed to fetch') return 'No pudimos conectar con SIWEPE. Revisa tu conexión e inténtalo nuevamente.';
  return error?.message||`No se pudo ${accion}. Inténtalo nuevamente.`;
}

/* Footer propio de cada empresa. Solo usa datos que el administrador decidió
   publicar; el correo de acceso nunca forma parte del catálogo público. */
function renderFooterEmpresa(){
  const footer=$t('#t-company-footer');
  if(!footer||!DB) return;
  const empresa=DB.empresa||{};
  const nombre=empresa.nombre||DB.config.nombre||'Tienda SIWEPE';
  const logo=empresa.logo||DB.config.logo||'';
  const rubro=empresa.rubro||((empresa.tiposNegocio||[]).join(' · '))||'Emprendimiento local';
  const descripcion=empresa.descripcion||'Comprá directamente a este emprendimiento desde SIWEPE.';
  const telefono=String(empresa.telefono||'').trim();
  const contacto=String(empresa.contactoPublico||'').trim();
  const correo=String(empresa.correoPublico||'').trim();
  const ubicacion=[empresa.ciudad,empresa.pais].filter(Boolean).join(', ');
  const telHref=telefono.replace(/[^\d+]/g,'');
  const dato=(icon,titulo,valor,href='')=>valor?`<div class="t-company-contact-row"><span>${icon}</span><div><small>${escT(titulo)}</small>${href?`<a href="${href}">${escT(valor)}</a>`:`<strong>${escT(valor)}</strong>`}</div></div>`:'';
  const iconPhone='<svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.4 2.1L8.1 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c1 .4 1.9.6 2.9.7a2 2 0 0 1 1.6 1.9Z"/></svg>';
  const iconMail='<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>';
  const iconPin='<svg viewBox="0 0 24 24"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>';
  const iconUser='<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>';
  footer.innerHTML=`
    <div class="t-company-footer-main">
      <div class="t-company-brand">
        <div class="t-company-logo">${logo?`<img src="${escT(logo)}" alt="">`:`<span>${escT(nombre.charAt(0).toUpperCase())}</span>`}</div>
        <div><span class="t-company-kicker">${escT(rubro)}</span><h2>${escT(nombre)}</h2><p>${escT(descripcion)}</p></div>
      </div>
      <div class="t-company-contact">
        <span class="t-company-footer-title">Contacto del negocio</span>
        ${dato(iconUser,'Atención',contacto)}
        ${dato(iconPhone,'Teléfono / WhatsApp',telefono,telHref?`tel:${telHref}`:'')}
        ${dato(iconMail,'Correo',correo,correo?`mailto:${encodeURIComponent(correo)}`:'')}
        ${dato(iconPin,'Ubicación',ubicacion)}
        ${(!contacto&&!telefono&&!correo&&!ubicacion)?'<p class="t-company-empty">Este negocio aún no ha publicado datos de contacto.</p>':''}
      </div>
      <nav class="t-company-links" aria-label="Enlaces de la tienda">
        <span class="t-company-footer-title">Explorá</span>
        <button type="button" data-footer-page="inicio">Inicio <span>→</span></button>
        <button type="button" data-footer-page="catalogo">Catálogo <span>→</span></button>
        <button type="button" data-footer-page="galeria">Galería <span>→</span></button>
        <button type="button" data-footer-page="cuenta">Mi cuenta <span>→</span></button>
      </nav>
    </div>
    <div class="t-company-footer-bottom">
      <span>© ${new Date().getFullYear()} ${escT(nombre)} · Información proporcionada por el negocio.</span>
      <div><a href="terminos.html">Términos y privacidad</a><a href="index.html" class="t-company-powered"><img src="../assets/img/siwepe-mark.png" alt="">Impulsado por <strong>SIWEPE</strong></a></div>
    </div>`;
  footer.querySelectorAll('[data-footer-page]').forEach(btn=>btn.addEventListener('click',()=>{
    goToT(btn.dataset.footerPage);
    window.scrollTo({top:0,behavior:'smooth'});
  }));
}

/* Marca de la tienda (logo + nombre) en el header */
function aplicarMarcaTienda(){
  const logoEl=document.getElementById('t-logo-mark');
  if(logoEl) logoEl.innerHTML=DB.config.logo?`<img src="${DB.config.logo}" alt="">`:(DB.config.nombre||'S')[0].toUpperCase();
  const n=document.getElementById('t-tienda-nombre'); if(n) n.textContent=DB.config.nombre;
  const gn=document.getElementById('t-galeria-empresa'); if(gn) gn.textContent=DB.config.nombre;
  document.title=`${DB.config.nombre} · Tienda`;
  renderFooterEmpresa();
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
  const contexto=document.getElementById('sw-tienda-contexto');
  if(contexto) contexto.textContent=DB.config.nombre||'una tienda SIWEPE';
  swTab(tab||'cliente');
}
function cerrarLogin(){
  const ap=document.getElementById('t-auth-page'); if(ap) ap.style.display='none';
  intentoCheckout=false;
}
window.abrirLogin=abrirLogin; window.cerrarLogin=cerrarLogin;

/* ── REGISTRO ── */
async function submitRegistro(){
  if(authSolicitudEnCurso) return;
  const nombre=(document.getElementById('t-reg-nombre')?.value||'').trim();
  const tel=(document.getElementById('t-reg-tel')?.value||'').trim();
  const correo=(document.getElementById('t-reg-correo')?.value||'').trim().toLowerCase();
  const dir=(document.getElementById('t-reg-dir')?.value||'').trim();
  const pin=document.getElementById('t-reg-pin')?.value||'';
  const pin2=document.getElementById('t-reg-pin2')?.value||'';
  const web=(document.getElementById('t-reg-web')?.value||'').trim();
  const errEl=document.getElementById('t-reg-error');
  if(!nombre){ errEl.textContent='El nombre es obligatorio.'; return; }
  if(!/^\S+@\S+\.\S+$/.test(correo)){ errEl.textContent='Escribe un correo electrónico válido.'; return; }
  if(!pin||pin.length<8){ errEl.textContent='La contraseña debe tener al menos 8 caracteres.'; return; }
  if(pin!==pin2){ errEl.textContent='Las contraseñas no coinciden.'; return; }
  authSolicitudEnCurso=true;
  setAuthLoading('btn-registrar',true,'Creando tu cuenta…','Crear mi cuenta');
  try{
    const {token,user}=await apiPost('/api/auth/register',{nombre,correo,password:pin,telefono:tel,direccion:dir,web,ts:_cargaTs});
    guardarSesionToken(token,'cliente',user.nombre);
    errEl.textContent='';
    await bootstrapDB();               // recargar estado con el cliente nuevo
    toastT('¡Cuenta creada!');
    entrarComoCliente(DB.clientes.find(c=>Number(c.id)===Number(user.id))||user);
  }catch(e){ errEl.textContent=mensajeErrorAuth(e,'crear la cuenta'); }
  finally{
    authSolicitudEnCurso=false;
    setAuthLoading('btn-registrar',false,'Creando tu cuenta…','Crear mi cuenta');
  }
}

/* ── LOGIN CLIENTE ── */
async function submitLoginT(){
  if(authSolicitudEnCurso) return;
  const correo=(document.getElementById('t-login-nombre')?.value||'').trim().toLowerCase();
  const pin=document.getElementById('t-login-pin')?.value||'';
  const errEl=document.getElementById('t-login-error');
  if(!/^\S+@\S+\.\S+$/.test(correo)){ errEl.textContent='Escribe un correo electrónico válido.'; return; }
  if(!pin){ errEl.textContent='Escribe tu contraseña.'; return; }
  authSolicitudEnCurso=true;
  setAuthLoading('btn-login-t',true,'Ingresando…','Ingresar a SIWEPE');
  try{
    const {token,user}=await apiPost('/api/auth/login',{email:correo,password:pin,portal:'compras'});
    if(!['cliente','admin'].includes(user.role)){
      const errorCredenciales=new Error('El correo o la contraseña no son correctos.');
      errorCredenciales.status=401;
      throw errorCredenciales;
    }
    guardarSesionToken(token,user.role,user.nombre);
    await bootstrapDB({asBuyer:true}); // catálogo + compras, nunca el panel de otra tienda
    if(errEl) errEl.textContent='';
    entrarComoCliente(DB.clientes.find(c=>Number(c.id)===Number(user.id))||user);
  }catch(e){ if(errEl) errEl.textContent=mensajeErrorAuth(e,'iniciar sesión'); }
  finally{
    authSolicitudEnCurso=false;
    setAuthLoading('btn-login-t',false,'Ingresando…','Ingresar a SIWEPE');
  }
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
  const siguiente=(()=>{ try{return sessionStorage.getItem('siwepe_after_login')||'';}catch(e){return '';} })();
  if(siguiente){
    try{ sessionStorage.removeItem('siwepe_after_login'); }catch(e){}
    location.href=siguiente;
    return;
  }
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
  clienteActivo=null;
  if(_chatPoll){ clearInterval(_chatPoll); _chatPoll=null; }
  cerrarChat(); ocultarChatFab();
  mostrarBienvenida();
}

/* ── NAV ── */
function goToT(page){
  if(page==='pedidos') page='cuenta';
  if(page==='cuenta'){
    const ref=bsEmpresa()||DB?.empresa_id||'';
    location.href=`perfil.html${ref?`?e=${encodeURIComponent(ref)}`:''}`;
    return;
  }
  $$t('.t-page').forEach(p=>p.classList.remove('active'));
  $$t('.t-nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  const el=$t('#tp-'+page); if(el) el.classList.add('active');
  if(page==='inicio')    renderInicio();
  if(page==='catalogo')  renderCatalogo();
  if(page==='galeria')   renderGaleriaTienda();
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
  /* Cada slide trae dos capas con la MISMA foto: un fondo borroso a pantalla
     completa (para que nunca quede un hueco vacío ni un corte duro cuando la
     foto no llena el hero) y la foto nítida encima en tamaño "contain" (para
     que nunca se recorte). Así se ve como una composición con diseño, no
     como una imagen pegada tal cual. */
  bg.innerHTML=imgs.map((raw,i)=>{
    const src=String(raw).replace(/'/g,"%27");
    return `<div class="t-hero-slide${i===0?' active':''}">
      <div class="t-hero-slide-blur" style="background-image:url('${src}')"></div>
      <div class="t-hero-slide-img" style="background-image:url('${src}')"></div>
    </div>`;
  }).join('');
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

/* Catálogo visible al público: activo Y con existencia. Un producto agotado
   no debe aparecer en grillas/destacados/filtros — no tiene sentido mostrarlo
   deshabilitado si no se puede comprar, simplemente no está. */
function _activosT(){ return DB.productos.filter(p=>p.estado==='activo'&&p.stock>0); }
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
/* ── CALIFICACIÓN DE LA TIENDA (estrellas) ── */
let _miEstrellas=0;
function _tiendaRef(){ return encodeURIComponent((DB.empresa&&DB.empresa.slug)||DB.empresa_id||''); }
function _estrellasProm(rating){
  const r=Math.round(rating||0); let s='';
  for(let i=1;i<=5;i++) s+=`<svg class="t-star-av ${i<=r?'on':''}" viewBox="0 0 24 24"><path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17.8 6.8 19.2l1-5.8L3.5 9.2l5.9-.9L12 3Z"/></svg>`;
  return s;
}
function renderCalificacion(){
  const cont=$t('#t-rating'); if(!cont) return;
  const emp=DB.empresa||{};
  const prom=emp.rating, total=emp.ratingCount||0;
  const logueado=bsToken()&&['cliente','admin'].includes(bsRole());
  const promTxt=prom!=null?Number(prom).toFixed(1):'—';
  let widget;
  if(logueado){
    let btns='';
    for(let i=1;i<=5;i++) btns+=`<button type="button" class="t-star-btn ${i<=_miEstrellas?'on':''}" data-star="${i}" aria-label="${i} estrella${i>1?'s':''}"><svg viewBox="0 0 24 24"><path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17.8 6.8 19.2l1-5.8L3.5 9.2l5.9-.9L12 3Z"/></svg></button>`;
    widget=`<div class="t-rating-vote"><span>${_miEstrellas?'Tu calificación · tocá para cambiarla':'¿Cómo calificás esta tienda?'}</span><div class="t-star-row" id="t-star-row">${btns}</div></div>`;
  }else{
    widget=`<div class="t-rating-vote"><span>Iniciá sesión como cliente para calificar esta tienda</span><button type="button" class="t-btn t-btn-primary" onclick="abrirLogin()">Iniciar sesión</button></div>`;
  }
  cont.innerHTML=`<div class="t-rating-card">
    <div class="t-rating-avg">
      <strong>${promTxt}</strong>
      <div class="t-stars-avg">${_estrellasProm(prom)}</div>
      <small>${total} calificación${total===1?'':'es'}</small>
    </div>
    ${widget}
  </div>`;
  const row=$t('#t-star-row');
  if(row) row.querySelectorAll('.t-star-btn').forEach(b=>{
    b.addEventListener('click',()=>calificarTienda(+b.dataset.star));
    b.addEventListener('mouseenter',()=>{ const n=+b.dataset.star; row.querySelectorAll('.t-star-btn').forEach((x,i)=>x.classList.toggle('hover',i<n)); });
  });
  if(row) row.addEventListener('mouseleave',()=>row.querySelectorAll('.t-star-btn').forEach(x=>x.classList.remove('hover')));
}
async function calificarTienda(n){
  try{
    const r=await apiPostAuth(`/api/tiendas/${_tiendaRef()}/calificar`,{estrellas:n});
    _miEstrellas=r.miEstrellas||n;
    if(DB.empresa){ DB.empresa.rating=r.promedio; DB.empresa.ratingCount=r.total; }
    renderCalificacion();
    toastT('¡Gracias por tu calificación!','ok');
  }catch(e){ toastT(e.message||'No se pudo calificar','error'); }
}
async function cargarMiCalificacion(){
  if(!(bsToken()&&['cliente','admin'].includes(bsRole()))) return;
  try{
    const r=await apiGet(`/api/tiendas/${_tiendaRef()}/mi-calificacion`);
    _miEstrellas=r.miEstrellas||0;
    if(DB.empresa){ if(r.promedio!=null) DB.empresa.rating=r.promedio; DB.empresa.ratingCount=r.total; }
    renderCalificacion();
  }catch(e){}
}
window.calificarTienda=calificarTienda;

function renderInicio(){
  renderFiltros();
  renderHero();
  renderCalificacion();
  cargarMiCalificacion();
  const dest=_activosT().filter(p=>p.destacado).slice(0,8);
  const gridEl=$t('#inicio-destacados');
  if(gridEl) gridEl.innerHTML=dest.map(p=>prodCardHtml(p)).join('')||'<p style="color:var(--text-soft);grid-column:1/-1">Aún no hay productos destacados.</p>';
  const cats=DB.categorias.filter(c=>c.estado==='activo');
  const catsEl=$t('#inicio-cats');
  if(catsEl) catsEl.innerHTML=cats.map(c=>{
    const n=_activosT().filter(p=>p.categoria_id===c.id).length;
    return `<div class="t-col-card" onclick="setCatFiltro('${c.id}')"><div class="t-col-ic">${escT(c.nombre[0]||'·').toUpperCase()}</div><h4>${escT(c.nombre)}</h4><span>${n} producto${n!==1?'s':''}</span></div>`;
  }).join('');
  renderGaleriaTienda();
}

function renderGaleriaTienda(){
  const sec=$t('#t-galeria-sec'), grid=$t('#t-galeria-grid'), pageGrid=$t('#t-galeria-page-grid');
  const gal=(DB.config.galeria||[]).filter(g=>g&&(typeof g==='string'?g:g.imagen));
  if(sec) sec.style.display=gal.length?'block':'none';
  if(!gal.length){
    if(grid) grid.innerHTML='';
    if(pageGrid) pageGrid.innerHTML=`<div class="t-gallery-public-empty"><span><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/></svg></span><h2>Muy pronto habrá nuevas historias</h2><p>Este emprendimiento todavía está preparando las fotografías de su galería.</p><button type="button" onclick="goToT('catalogo')">Explorar el catálogo</button></div>`;
    return;
  }
  const html=gal.map((raw,i)=>{ const g=typeof raw==='string'?{imagen:raw}:raw; return `<article class="t-gallery-item ${i===0?'t-gallery-featured':''}" onclick="verImagenT('${g.imagen}')"><img src="${g.imagen}" alt="${escT(g.titulo||`Galería ${i+1}`)}" loading="lazy"><div class="t-gallery-copy">${g.titulo?`<strong>${escT(g.titulo)}</strong>`:''}${g.descripcion?`<span>${escT(g.descripcion)}</span>`:''}</div></article>`; }).join('');
  if(grid) grid.innerHTML=html;
  if(pageGrid) pageGrid.innerHTML=html;
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
  if(filtros.favOnly) prods=prods.filter(p=>favs.has(favKey(p.id)));
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
  // Solo se llama con productos de _activosT() (activos y con stock>0) — un
  // producto agotado nunca llega aquí, desaparece de raíz en vez de mostrarse
  // deshabilitado/borroso.
  const cat=catPor(p.categoria_id);
  const enCar=carrito.find(i=>i.producto_id===p.id);
  const isFav=favs.has(favKey(p.id));
  const GRADS=['linear-gradient(135deg,#F3F4F6,#E5E7EB)','linear-gradient(135deg,#EEF0F2,#DDE1E6)','linear-gradient(135deg,#F4F4F5,#E4E4E7)','linear-gradient(135deg,#F1F3F5,#E2E6EA)','linear-gradient(135deg,#F5F5F4,#E7E5E4)','linear-gradient(135deg,#EDEFF2,#DCE0E5)'];
  let h=0; for(let i=0;i<p.nombre.length;i++) h=(h*31+p.nombre.charCodeAt(i))&0xFFFFFF;
  const g=GRADS[h%GRADS.length];
  const sub=(p.marca||'').trim()||(cat?cat.nombre:'');
  const addBtn=enCar
    ?`<div class="tpc-qty-ctrl"><button onclick="event.stopPropagation();cambiarCantT(${p.id},-1)">−</button><span>${enCar.cantidad}</span><button onclick="event.stopPropagation();cambiarCantT(${p.id},1)">+</button></div>`
    :`<button class="tpc-add-btn" onclick="event.stopPropagation();agregarT(${p.id})"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><use href="#icon-bolsa"/></svg> Agregar al carrito</button>`;
  const fotos=imagenesProducto(p);
  const portada=fotos[0]||'';
  return `
  <div class="t-prod-card" onclick="abrirDetalle(${p.id})">
    <div class="tpc-img">
      ${portada?`<img src="${portada}" alt="${escT(p.nombre)}" data-ph="tpc" data-l="${p.nombre[0].toUpperCase()}" data-bg="${g}" onerror="imgFbT(this)">`:`<div class="tpc-placeholder" style="background:${g}"><span style="color:var(--rose)">${p.nombre[0].toUpperCase()}</span></div>`}
      ${fotos.length>1?`<span class="tpc-photo-count">${fotos.length} fotos</span>`:''}
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
function imagenesProducto(p){ const imgs=Array.isArray(p&&p.imagenes)?p.imagenes.filter(Boolean):[]; if(p&&p.imagen&&!imgs.includes(p.imagen)) imgs.unshift(p.imagen); return imgs; }
function abrirDetalle(id){
  detalleProdId=id;
  const p=prodPor(id); if(!p) return;
  const cat=catPor(p.categoria_id);
  const agotado=p.stock<=0;
  const GRADS=['linear-gradient(135deg,#F3F4F6,#E5E7EB)','linear-gradient(135deg,#EEF0F2,#DDE1E6)','linear-gradient(135deg,#F4F4F5,#E4E4E7)','linear-gradient(135deg,#F1F3F5,#E2E6EA)'];
  let h=0; for(let i=0;i<p.nombre.length;i++) h=(h*31+p.nombre.charCodeAt(i))&0xFFFFFF;
  const g=GRADS[h%GRADS.length];
  const fotos=imagenesProducto(p), portada=fotos[0]||'';
  const el=$t('#t-detail');
  el.innerHTML=`
    <div class="tpd-media">
    <div class="tpd-img" style="${!portada?'background:'+g:''}">
      ${portada?`<img id="tpd-main-img" src="${portada}" alt="${escT(p.nombre)}" data-ph="tpd" data-l="${p.nombre[0].toUpperCase()}" data-bg="${g}" onerror="imgFbT(this)">`:`<div class="tpd-placeholder"><span style="color:var(--rose)">${p.nombre[0].toUpperCase()}</span></div>`}
      <button class="tpd-close" onclick="cerrarDetalle()"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
    </div>
    ${fotos.length>1?`<div class="tpd-thumbs">${fotos.map((src,i)=>`<button class="tpd-thumb ${i===0?'active':''}" onclick="cambiarImagenDetalle(${i})"><img src="${src}" alt="Vista ${i+1}"></button>`).join('')}</div>`:''}
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
function cambiarImagenDetalle(i){ const p=prodPor(detalleProdId), fotos=imagenesProducto(p), img=$t('#tpd-main-img'); if(!img||!fotos[i]) return; img.src=fotos[i]; $$t('.tpd-thumb').forEach((b,j)=>b.classList.toggle('active',i===j)); }
window.cambiarImagenDetalle=cambiarImagenDetalle;
function cerrarDetalle(){ $t('#t-detail-overlay').classList.remove('open'); }

/* ── FAVORITOS ── */
function toggleFav(id){
  const clave=favKey(id);
  if(favs.has(clave)) favs.delete(clave); else favs.add(clave);
  localStorage.setItem('bs_favs',JSON.stringify([...favs]));
  refrescarVista(); actualizarFavBadge();
}
function actualizarFavBadge(){
  const n=[...favs].filter(clave=>clave.startsWith(`${DB.empresa_id}:`)).filter(clave=>{ const p=prodPor(+clave.split(':')[1]); return p&&p.estado==='activo'; }).length;
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
function refEmpresaCart(){ return DB?.empresa_id||bsEmpresa(); }
function cargarCarritoTienda(){
  carrito=siwepeCart.deEmpresa(refEmpresaCart());
  return carrito;
}
function guardarCarritoTienda(){
  const todos=siwepeCart.get().filter(x=>Number(x.empresa_id)!==Number(DB.empresa_id));
  siwepeCart.set([...todos,...carrito]);
}
function agregarT(prodId){
  const p=prodPor(prodId); if(!p||p.stock<=0) return;
  const exist=carrito.find(i=>i.producto_id===prodId);
  if(exist){ if(exist.cantidad>=p.stock){ toastT('No hay más stock','warn'); return; } exist.cantidad++; }
  else carrito.push({empresa_id:Number(DB.empresa_id),empresa_slug:String(DB.empresa?.slug||bsEmpresa()||''),empresa_nombre:DB.config.nombre||DB.empresa?.nombre||'Tienda SIWEPE',producto_id:prodId,nombre:p.nombre,precio:p.precio_venta,cantidad:1,imagen:p.imagen,stock:p.stock});
  guardarCarritoTienda();
  updateBadge(); refrescarVista();
  toastT(`${p.nombre} agregado al carrito`);
}

function cambiarCantT(prodId,delta){
  const idx=carrito.findIndex(i=>i.producto_id===prodId);
  if(idx===-1) return;
  carrito[idx].cantidad+=delta;
  if(carrito[idx].cantidad<=0) carrito.splice(idx,1);
  else{ const p=prodPor(prodId); if(p&&carrito[idx].cantidad>p.stock){ carrito[idx].cantidad=p.stock; toastT('Máximo disponible','warn'); } }
  guardarCarritoTienda();
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
function urlCompraT(archivo){ const ref=DB?.empresa?.slug||bsEmpresa()||DB?.empresa_id||''; return `${archivo}?e=${encodeURIComponent(ref)}`; }
function irACarritoT(){ location.href=urlCompraT('carrito.html'); }
function irACheckoutT(){
  if(!clienteActivo){
    intentoCheckout=true;
    try{ sessionStorage.setItem('siwepe_after_login',urlCompraT('checkout.html')); }catch(e){}
    cerrarCarrito(); abrirLogin('cliente');
    toastT('Inicia sesión para continuar con la compra','warn');
    return;
  }
  location.href=urlCompraT('checkout.html');
}
window.irACarritoT=irACarritoT; window.irACheckoutT=irACheckoutT;

function renderCartPanel(){
  const cont=$t('#t-cart-items');
  const footer=$t('#t-cart-footer');
  const bannerEl=$t('#t-cart-pedido-banner');
  if(!cont) return;

  if(bannerEl) bannerEl.innerHTML='';

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
  const botones=$t('#t-cart-actions'); if(botones) botones.style.display='grid';
}


/* ── CONFIRMAR PEDIDO NUEVO ── */
async function confirmarPedidoT(){
  irACheckoutT();
}

/* ── MIS PEDIDOS ── */
const ESTADO_LABELS={'pendiente':'Pendiente','aprobado':'Confirmado','entregado':'Entregado','cancelado':'Cancelado'};
const pedidoPorEmpresa=(pedId,empresaId)=>(DB.pedidos||[]).find(p=>p.id===pedId&&(p.empresa?.id||DB.empresa_id)===empresaId);


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
  const total=misPeds.reduce((s,p)=>s+(DB.mensajes||[]).filter(m=>m.empresa_id===(p.empresa?.id||DB.empresa_id)&&m.pedido_id===p.id&&m.autor!=='cliente'&&!m.leido).length,0);
  const badge=$t('#t-chat-fab-badge');
  if(badge){ badge.textContent=total||''; badge.style.display=total?'flex':'none'; }
}

function iniciarPollChat(){
  if(_chatPoll) clearInterval(_chatPoll);
  _chatPoll=setInterval(async ()=>{
    if(!clienteActivo) return;
    await refrescarEstado({asBuyer:true});  // trae pedidos/mensajes nuevos del backend
    if($t('#t-chat-overlay')?.classList.contains('open')&&chatPedidoId&&chatEmpresaId){
      try{
        const r=await apiGet(`/api/pedidos/${chatEmpresaId}/${chatPedidoId}/mensajes`);
        DB.mensajes=(DB.mensajes||[]).filter(m=>!(m.empresa_id===chatEmpresaId&&m.pedido_id===chatPedidoId));
        DB.mensajes.push(...(r.mensajes||[]).map(m=>({...m,empresa_id:chatEmpresaId})));
      }catch(e){}
    }
    actualizarBadgeFab();
    if($t('#t-chat-overlay')?.classList.contains('open')&&chatPedidoId){
      renderChatMsgs(chatPedidoId);
    }
  },3000);
}

async function abrirChatPedido(pedId,empresaId){
  chatPedidoId=pedId;
  chatEmpresaId=empresaId||DB.empresa_id;
  const overlay=$t('#t-chat-overlay'); if(!overlay) return;
  try{
    const r=await apiGet(`/api/pedidos/${chatEmpresaId}/${pedId}/mensajes`);
    DB.mensajes=(DB.mensajes||[]).filter(m=>!(m.empresa_id===chatEmpresaId&&m.pedido_id===pedId));
    DB.mensajes.push(...(r.mensajes||[]).map(m=>({...m,empresa_id:chatEmpresaId})));
  }catch(e){ toastT(e.message||'No se pudo cargar el chat','error'); return; }
  // Cargar selector de pedidos
  poblarSelectorPedidos(pedId);
  renderChatMsgs(pedId);
  await apiPatch(`/api/pedidos/${chatEmpresaId}/${pedId}/mensajes/leidos`,{}).catch(()=>{});
  (DB.mensajes||[]).filter(m=>m.empresa_id===chatEmpresaId&&m.pedido_id===pedId&&m.autor!=='cliente').forEach(m=>m.leido=true);
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
  abrirChatPedido(miosPeds[0].id,miosPeds[0].empresa?.id||DB.empresa_id);
}

function cerrarChat(){
  $t('#t-chat-overlay')?.classList.remove('open');
  chatPedidoId=null;
  chatEmpresaId=null;
}

function poblarSelectorPedidos(selectedId){
  const sel=$t('#t-chat-pedido-select'); if(!sel) return;
  const mios=DB.pedidos.filter(p=>p.cliente_id===clienteActivo.id&&p.estado!=='cancelado').sort((a,b)=>b.id-a.id);
  sel.innerHTML=mios.map(p=>`<option value="${p.empresa?.id||DB.empresa_id}:${p.id}" ${(p.empresa?.id||DB.empresa_id)===chatEmpresaId&&p.id===selectedId?'selected':''}>${escT(p.empresa?.nombre||DB.config.nombre)} · #${p.id} · ${ESTADO_LABELS[p.estado]||p.estado}</option>`).join('');
  sel.onchange=()=>{ const [e,p]=sel.value.split(':').map(Number); abrirChatPedido(p,e); };
  // Nombre tienda en header chat
  const hnom=$t('#t-chat-nombre-tienda'); if(hnom) hnom.textContent=DB.config.nombre;
  const hav=$t('#t-chat-av'); if(hav) hav.textContent=(DB.config.nombre||'S')[0].toUpperCase();
}

function renderChatMsgs(pedId){
  const cont=$t('#t-chat-msgs'); if(!cont) return;
  const ped=pedidoPorEmpresa(pedId,chatEmpresaId); if(!ped) return;
  const cerrado=ped.estado==='cancelado';
  const msgs=(DB.mensajes||[]).filter(m=>m.empresa_id===chatEmpresaId&&m.pedido_id===pedId).sort((a,b)=>new Date(a.fecha)-new Date(b.fecha));

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

async function enviarMensajeCliente(){
  const inp=$t('#t-chat-input'); if(!inp||!chatPedidoId) return;
  const texto=inp.value.trim(); if(!texto) return;
  const ped=pedidoPorEmpresa(chatPedidoId,chatEmpresaId); if(!ped||ped.estado==='cancelado') return;
  inp.disabled=true;
  try{
    const r=await apiPostAuth(`/api/pedidos/${chatEmpresaId}/${chatPedidoId}/mensajes`,{texto});
    DB.mensajes.push({...r.mensaje,empresa_id:chatEmpresaId});
    inp.value=''; renderChatMsgs(chatPedidoId); actualizarBadgeFab();
  }catch(e){ toastT(e.message||'No se pudo enviar el mensaje','error'); }
  finally{ inp.disabled=false; inp.focus(); }
}

/* ── INICIALIZAR ── */
document.addEventListener('DOMContentLoaded', async ()=>{
  /* tienda.html siempre necesita saber de qué negocio es (?e=slug). Sin eso
     no hay catálogo que mostrar ni tienda contra la cual loguearse — en vez
     de mostrar una tienda vacía y genérica, se manda al marketplace a elegir. */
  if(!bsEmpresa()){
    window.location.href = 'index.html';
    return;
  }
  try{
    await bootstrapDB({checkEmpresa:true,asBuyer:true});
  }catch(e){
    // El token guardado ya no sirve (vencido/revocado): bootstrapDB ya cerró
    // la sesión localmente; se reintenta como invitada para esta tienda.
    await bootstrapDB({checkEmpresa:true,asBuyer:true});
  }
  cargarCarritoTienda();
  /* Reconciliar el carrito con el catálogo actual: corrige precio, portada y
     stock, y elimina productos que ya no existen en esta tienda. */
  carrito=carrito.map(it=>{
    const p=prodPor(it.producto_id); if(!p||p.estado!=='activo'||p.stock<=0) return null;
    return {...it,empresa_id:Number(DB.empresa_id),empresa_slug:String(DB.empresa?.slug||bsEmpresa()||''),empresa_nombre:DB.config.nombre||DB.empresa?.nombre||it.empresa_nombre,nombre:p.nombre,precio:Number(p.precio_venta)||0,imagen:p.imagen||it.imagen||'',stock:Number(p.stock)||0,cantidad:Math.min(Math.max(1,Number(it.cantidad)||1),Number(p.stock)||1)};
  }).filter(Boolean);
  guardarCarritoTienda();
  /* Configurar marca */
  const nombre=DB.config.nombre||'Siwepe';
  const contexto=document.getElementById('sw-tienda-contexto');
  if(contexto) contexto.textContent=nombre;
  document.title=`${nombre} · Tienda`;

  /* Enter en campos de login */
  document.getElementById('t-login-pin')?.addEventListener('keydown',e=>{ if(e.key==='Enter') submitLoginT(); });
  document.getElementById('t-reg-pin2')?.addEventListener('keydown',e=>{ if(e.key==='Enter') submitRegistro(); });

  /* Nav tienda */
  $$t('.t-nav-btn').forEach(b=>b.addEventListener('click',()=>goToT(b.dataset.page)));
  $t('#t-cart-btn')?.addEventListener('click',abrirCarrito);
  $t('#t-cart-close')?.addEventListener('click',cerrarCarrito);
  $t('#t-cart-overlay')?.addEventListener('click',e=>{ if(e.target.id==='t-cart-overlay') cerrarCarrito(); });
  $t('#t-detail-overlay')?.addEventListener('click',e=>{ if(e.target.id==='t-detail-overlay') cerrarDetalle(); });
  $t('#btn-confirmar-ped')?.addEventListener('click',confirmarPedidoT);

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

  /* Restaurar la identidad compradora. Una cuenta administradora conserva su
     rol, pero dentro de la tienda usa catálogo, perfil y pedidos; jamás el
     estado administrativo de la tienda que está visitando. */
  let _idGuardado=null;
  try{ _idGuardado=+localStorage.getItem('bs_sesion_cli')||null; }catch(e){}
  const puedeComprar=bsToken()&&['cliente','admin'].includes(bsRole());
  const _cliGuardado=puedeComprar?(DB.clientes.find(c=>Number(c.id)===Number(_idGuardado))||DB.clientes[0]||null):null;
  if(_cliGuardado) entrarComoCliente(_cliGuardado);
  else {
    mostrarBienvenida();
    if(new URLSearchParams(location.search).get('login')) setTimeout(()=>abrirLogin('cliente'),80);
  }
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
