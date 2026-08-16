/*! SIWEPE · © 2026 Joel Reyes. Todos los derechos reservados. · Prohibida su reproduccion o distribucion sin autorizacion. */
/*
  shared/data.js — Base de datos compartida en localStorage.
  Etapa 2: reemplazar almacen.leer/escribir por fetch() a la API.
*/
const BS_CLAVE = 'siwepe_pro_v1';

/* Base del API:
   - En local (localhost / 127.0.0.1) usa el servidor Node local en :3000.
   - En cualquier otro lado (siwepe.shop, etc.) usa el backend en Railway. */
const API_BASE = (typeof location !== 'undefined'
    && (location.hostname === 'localhost' || location.hostname === '127.0.0.1'))
  ? 'http://localhost:3000'
  : 'https://backendsiwepe-production.up.railway.app';

function bsToken(){ try{ return localStorage.getItem('bs_token')||''; }catch(e){ return ''; } }
function bsRole(){ try{ return localStorage.getItem('bs_role')||''; }catch(e){ return ''; } }

/* Empresa/tienda activa: el formato actual es ?e=slug. También se aceptan
   ?empresa= y ?tienda= para que enlaces guardados de versiones anteriores no
   abran una tienda genérica ni rompan el acceso del cliente. */
function bsEmpresa(){
  try{
    const qs = new URLSearchParams(location.search);
    const u = qs.get('e') || qs.get('empresa') || qs.get('tienda');
    if(u){ localStorage.setItem('bs_empresa', u); return u; }
    return localStorage.getItem('bs_empresa') || '';
  }catch(e){ return ''; }
}

/* Cache local (respaldo si el backend no está disponible).
   Se guarda por empresa para que el respaldo de una tienda nunca se muestre
   encima de otra si el fetch de la tienda actual falla.
   IMPORTANTE: al escribir, la clave sale del `db` recién cargado (su propio
   empresa_id/slug), NUNCA de bsEmpresa() — esa función cae a un valor viejo
   de localStorage en páginas sin ?e= (p. ej. admin.html), y si se usara aquí,
   el estado completo de un admin podría guardarse bajo la clave de la ÚLTIMA
   tienda que visitó como comprador, envenenando el respaldo de esa tienda
   para cualquiera que la abra después. Al leer sí se usa bsEmpresa() (la
   tienda que se está pidiendo ahora), pero se valida contra lo guardado
   antes de confiar en ello (ver bootstrapDB). */
const almacen = {
  leer:  (clave)=>{ try{ return localStorage.getItem(BS_CLAVE + ':' + (clave||'_')); }catch(e){ return null; } },
  escribir: (v,db)=>{ try{ const clave=(db&&(db.empresa&&db.empresa.slug||db.empresa_id))||bsEmpresa()||'_'; localStorage.setItem(BS_CLAVE + ':' + clave, v); }catch(e){} }
};

let DB = null;
let _guardandoHasta = 0;   // evita pisar un guardado reciente al refrescar
let _colaGuardado = Promise.resolve();

function _esqueletoDB(){
  return { empresa_id:null, empresa:null, _revision:0, config:{nombre:'SIWEPE',logo:'',moneda:'L',tema:'cielo',banners:[],galeria:[],pago:{}},
    seq:{}, categorias:[], proveedores:[], clientes:[], productos:[], compras:[], ventas:[], movimientos:[], pedidos:[], mensajes:[] };
}

/* Carga el estado desde el backend.
   - Con sesión (token): estado completo (/api/state).
   - Invitado (sin token): solo catálogo público (/api/catalog).
   - Sin backend: respaldo local/semilla. */
async function bootstrapDB(opts){
  const tok=bsToken(), role=bsRole();
  try{
    const comoComprador=tok&&(role==='cliente'||(role==='admin'&&opts&&opts.asBuyer));
    if(comoComprador){
      const [catalogo,perfil,historial]=await Promise.all([
        apiGet('/api/catalog?empresa='+encodeURIComponent(bsEmpresa())),
        apiGet('/api/clientes/mi'),
        apiGet('/api/mis-pedidos')
      ]);
      DB = _esqueletoDB();
      DB.empresa_id=catalogo.empresa_id;
      DB.empresa=catalogo.empresa||null;
      DB.config=Object.assign(DB.config,catalogo.config||{});
      DB.categorias=catalogo.categorias||[];
      DB.productos=catalogo.productos||[];
      DB.clientes=[perfil];
      DB.pedidos=historial.pedidos||[];
      DB.mensajes=DB.pedidos.flatMap(p=>(p.mensajes||[]).map(m=>({...m,empresa_id:m.empresa_id||p.empresa?.id,pedido_id:m.pedido_id||p.id})));
    }else if(tok){
      const r=await fetch(API_BASE+'/api/state',{headers:{'Authorization':'Bearer '+tok}});
      const j=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(j.error||('estado '+r.status));
      DB=j;
    }else{
      const r=await fetch(API_BASE+'/api/catalog?empresa='+encodeURIComponent(bsEmpresa()));
      const data=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(data.error||('catálogo '+r.status));
      DB=_esqueletoDB();
      DB.empresa_id=data.empresa_id;
      DB.empresa=data.empresa||null;
      DB.config=Object.assign(DB.config,data.config||{});
      DB.categorias=data.categorias||[];
      DB.productos=data.productos||[];
    }
    // El estado de /api/state (admin/proveedor autenticado, rama `else if(tok)`)
    // no trae empresa_id/slug en la respuesta — no hay forma fiable de
    // saber bajo qué tienda cachearlo, así que mejor NO se guarda ahí:
    // guardarlo bajo bsEmpresa() podría ser la clave de otra tienda que este
    // mismo admin visitó como comprador, contaminando su respaldo.
    if(DB.empresa_id!=null || (DB.empresa&&DB.empresa.slug)) almacen.escribir(JSON.stringify(DB), DB);
  }catch(e){
    if(tok&&(e.status===401||e.status===403)){
      limpiarSesionToken();
      try{ localStorage.removeItem('bs_sesion_cli'); localStorage.removeItem('bs_sesion_admin'); }catch(e2){}
      DB = _esqueletoDB();
      _migrar();
      throw e;
    }
    console.warn('Sin conexión al backend, usando datos locales:', e.message);
    // Solo se confía en el respaldo si es justo el de la tienda que se pidió
    // ahora (bsEmpresa()) — si el guardado más reciente bajo esa clave
    // pertenece a otra empresa (dato corrupto de una versión anterior, o
    // nunca se visitó esta tienda antes), mejor mostrar vacío que mezclar.
    const empresaPedida = bsEmpresa();
    const raw = almacen.leer(empresaPedida);
    let candidato = null;
    try{ candidato = raw ? JSON.parse(raw) : null; }catch(e2){ candidato = null; }
    const coincide = candidato && empresaPedida && (
      String(candidato.empresa && candidato.empresa.slug || '') === String(empresaPedida) ||
      String(candidato.empresa_id || '') === String(empresaPedida)
    );
    DB = coincide ? candidato : _esqueletoDB();
  }
  _migrar();
  aplicarTema(DB.config.tema);
  return DB;
}

/* Llamadas de autenticación al backend */
async function apiPost(ruta, datos){
  const r = await fetch(API_BASE + ruta, {
    method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(datos)
  });
  const j = await r.json().catch(()=>({}));
  if(!r.ok){ const e=new Error(j.error || ('Error ' + r.status)); e.status=r.status; throw e; }
  return j;
}

async function apiPostAuth(ruta, datos){
  const tok=bsToken();
  const r=await fetch(API_BASE+ruta,{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},
    body:JSON.stringify(datos||{})
  });
  const j=await r.json().catch(()=>({}));
  if(!r.ok){ const e=new Error(j.error||('Error '+r.status)); Object.assign(e,j); e.status=r.status; throw e; }
  return j;
}

/* Llamadas autenticadas genéricas (usan el token de sesión) */
async function apiGet(ruta){
  const tok = bsToken();
  const r = await fetch(API_BASE + ruta, tok ? { headers:{ 'Authorization':'Bearer '+tok } } : undefined);
  const j = await r.json().catch(()=>({}));
  if(!r.ok){ const e=new Error(j.error || ('Error ' + r.status)); Object.assign(e,j); e.status=r.status; throw e; }
  return j;
}
async function apiPut(ruta, datos){
  const tok = bsToken();
  const r = await fetch(API_BASE + ruta, {
    method:'PUT', headers:{'Content-Type':'application/json', 'Authorization':'Bearer '+tok}, body: JSON.stringify(datos)
  });
  const j = await r.json().catch(()=>({}));
  if(!r.ok){ const e=new Error(j.error || ('Error ' + r.status)); e.status=r.status; throw e; }
  return j;
}
async function apiPatch(ruta, datos){
  const tok=bsToken();
  const r=await fetch(API_BASE+ruta,{method:'PATCH',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},body:JSON.stringify(datos||{})});
  const j=await r.json().catch(()=>({}));
  if(!r.ok){ const e=new Error(j.error||('Error '+r.status)); e.status=r.status; throw e; }
  return j;
}
async function apiDelete(ruta){
  const tok=bsToken();
  const r=await fetch(API_BASE+ruta,{method:'DELETE',headers:{'Authorization':'Bearer '+tok}});
  const j=await r.json().catch(()=>({}));
  if(!r.ok){ const e=new Error(j.error||('Error '+r.status)); e.status=r.status; throw e; }
  return j;
}
function guardarSesionToken(token, role, nombre){
  try{
    localStorage.setItem('bs_token', token || '');
    localStorage.setItem('bs_role', role || '');
    if(nombre) localStorage.setItem('bs_user', nombre);
    // La cuenta de cliente es global: no queda atada a la tienda actual.
    localStorage.removeItem('bs_token_empresa');
  }catch(e){}
}
function limpiarSesionToken(){
  try{
    localStorage.removeItem('bs_token'); localStorage.removeItem('bs_role');
    localStorage.removeItem('bs_user'); localStorage.removeItem('bs_token_empresa');
  }catch(e){}
}

/* ──────────────────────────────────────────────────────────────
   CARRITO GLOBAL SIWEPE
   El carrito persiste entre páginas, pero cada línea conserva la empresa a
   la que pertenece. Así nunca se vuelve a enviar un item sin empresa_id y el
   checkout puede validar precios/stock contra el catálogo correcto.
────────────────────────────────────────────────────────────── */
const SIWEPE_CART_KEY='siwepe_cart_v2';
const siwepeCart={
  get(){
    try{
      const raw=JSON.parse(localStorage.getItem(SIWEPE_CART_KEY)||'[]');
      return (Array.isArray(raw)?raw:[]).map(x=>({
        empresa_id:Number(x.empresa_id)||0,
        empresa_slug:String(x.empresa_slug||''),
        empresa_nombre:String(x.empresa_nombre||''),
        producto_id:Number(x.producto_id)||0,
        nombre:String(x.nombre||'Producto'),
        precio:Math.max(0,Number(x.precio)||0),
        cantidad:Math.max(1,Math.trunc(Number(x.cantidad)||1)),
        imagen:String(x.imagen||''),
        stock:Math.max(0,Math.trunc(Number(x.stock)||0))
      })).filter(x=>x.empresa_id&&x.producto_id);
    }catch(e){ return []; }
  },
  set(items){
    const limpio=(Array.isArray(items)?items:[]).filter(x=>Number(x.empresa_id)&&Number(x.producto_id)&&Number(x.cantidad)>0);
    try{ localStorage.setItem(SIWEPE_CART_KEY,JSON.stringify(limpio)); }catch(e){}
    try{ window.dispatchEvent(new CustomEvent('siwepe:cart',{detail:{items:limpio}})); }catch(e){}
    return limpio;
  },
  deEmpresa(ref){
    const valor=String(ref==null?'':ref);
    return this.get().filter(x=>String(x.empresa_id)===valor||x.empresa_slug===valor);
  },
  add(item){
    const next=this.get();
    const empresaId=Number(item&&item.empresa_id), productoId=Number(item&&item.producto_id);
    if(!empresaId||!productoId) throw new Error('No se pudo identificar la tienda o el producto.');
    const idx=next.findIndex(x=>x.empresa_id===empresaId&&x.producto_id===productoId);
    const limite=Math.max(0,Math.trunc(Number(item.stock)||0));
    if(idx>=0){
      const cantidad=Math.max(1,Math.trunc(Number(next[idx].cantidad)||1))+Math.max(1,Math.trunc(Number(item.cantidad)||1));
      next[idx]={...next[idx],...item,empresa_id:empresaId,producto_id:productoId,cantidad:limite?Math.min(cantidad,limite):cantidad,stock:limite};
    }else{
      next.push({...item,empresa_id:empresaId,producto_id:productoId,cantidad:Math.max(1,Math.trunc(Number(item.cantidad)||1)),stock:limite});
    }
    return this.set(next);
  },
  update(empresaId,productoId,cantidad){
    const next=this.get(), idx=next.findIndex(x=>x.empresa_id===Number(empresaId)&&x.producto_id===Number(productoId));
    if(idx<0) return next;
    const n=Math.trunc(Number(cantidad)||0);
    if(n<=0) next.splice(idx,1);
    else next[idx].cantidad=next[idx].stock?Math.min(n,next[idx].stock):n;
    return this.set(next);
  },
  clearEmpresa(ref){
    const valor=String(ref==null?'':ref);
    return this.set(this.get().filter(x=>!(String(x.empresa_id)===valor||x.empresa_slug===valor)));
  },
  count(ref){ return this.deEmpresa(ref).reduce((n,x)=>n+x.cantidad,0); },
  total(ref){ return this.deEmpresa(ref).reduce((n,x)=>n+x.precio*x.cantidad,0); }
};
if(typeof window!=='undefined') window.siwepeCart=siwepeCart;

const hoy = (d=0) => { const x=new Date(); x.setDate(x.getDate()+d); return x.toISOString().slice(0,10); };
const mesActual = () => hoy().slice(0,7);

/* Compat: el front-end llama dbCargar() en muchos lados para "refrescar".
   Con backend, el estado ya vive en memoria (cargado por bootstrapDB).
   Si por algún motivo DB no existe, se rearma desde cache/semilla. */
function dbCargar(){
  if(!DB){ const r=almacen.leer(); DB=r?JSON.parse(r):_esqueletoDB(); _migrar(); aplicarTema(DB.config.tema); }
  return DB;
}

/* ================================
   MOTOR DE TEMAS (compartido tienda + admin)
   Cada tema define una paleta COMPLETA: acento, neutros, textos y sidebar.
   Cambiar el tema cambia TODO en ambos lados.
================================ */
const TEMAS = {
  /*           acento    hover     claro     medio  | fondo     surf2    borde   | texto1   texto2   texto3  | sb-bg    sb-hover sb-activo */
  rosado:  {ac:'#E08AA0',ah:'#C76A82',al:'#FCEFF3',am:'#F0B5C4',bg:'#FBF7F9',s2:'#FAF4F7',bd:'#F1E6EB',tp:'#3A2F33',ts:'#7C6A70',tm:'#AD9BA2',sb:'#FFFCFD',sh:'#FBF1F5',sa:'#FCEFF3'},
  coral:   {ac:'#E8736A',ah:'#C8554C',al:'#FCEEEC',am:'#F3ABA4',bg:'#FCF8F7',s2:'#FAF1F0',bd:'#F2E4E2',tp:'#3A2B29',ts:'#7C6661',tm:'#AD9893',sb:'#FFFCFB',sh:'#FBF1EF',sa:'#FCEEEC'},
  durazno: {ac:'#DD9558',ah:'#BE7740',al:'#FBF1E6',am:'#F0C9A1',bg:'#FCF9F4',s2:'#FAF3E9',bd:'#F0E7D9',tp:'#3A2E22',ts:'#7B6A58',tm:'#B5A593',sb:'#FFFDFB',sh:'#FBF3EA',sa:'#FBF1E6'},
  salvia:  {ac:'#5FA37E',ah:'#468268',al:'#EAF5EF',am:'#ABD6C0',bg:'#F5FAF7',s2:'#EFF6F2',bd:'#E0EDE6',tp:'#243329',ts:'#566B5E',tm:'#9CB0A4',sb:'#FCFEFD',sh:'#EFF7F2',sa:'#EAF5EF'},
  turquesa:{ac:'#2FA3A3',ah:'#1F8585',al:'#E6F5F5',am:'#9DD8D8',bg:'#F4FAFA',s2:'#ECF6F6',bd:'#DCECEC',tp:'#1F3333',ts:'#536C6C',tm:'#97AFAF',sb:'#FBFEFE',sh:'#ECF7F7',sa:'#E6F5F5'},
  cielo:   {ac:'#4F86C6',ah:'#3A6DA8',al:'#EAF2FB',am:'#A9CBEC',bg:'#F6F9FC',s2:'#F0F5FB',bd:'#E2EBF3',tp:'#21303D',ts:'#5A6B78',tm:'#9AAAB6',sb:'#FCFDFE',sh:'#F0F5FB',sa:'#EAF2FB'},
  indigo:  {ac:'#5B61D6',ah:'#4348B8',al:'#EEEFFC',am:'#B3B6EE',bg:'#F7F7FC',s2:'#F1F1FB',bd:'#E5E5F3',tp:'#272838',ts:'#5E5F75',tm:'#9C9DB8',sb:'#FDFDFE',sh:'#F1F1FB',sa:'#EEEFFC'},
  lavanda: {ac:'#8E6FC4',ah:'#6F52A6',al:'#F2ECFB',am:'#CBB6EC',bg:'#F8F6FC',s2:'#F3EEFB',bd:'#E8E0F3',tp:'#2E2738',ts:'#645A75',tm:'#A99CB8',sb:'#FDFCFE',sh:'#F3EEFB',sa:'#F2ECFB'},
  gris:    {ac:'#6B7280',ah:'#4B5563',al:'#F1F3F5',am:'#C3C9D0',bg:'#F7F8F9',s2:'#F2F4F6',bd:'#E4E7EB',tp:'#1F2430',ts:'#5A6270',tm:'#9AA1AC',sb:'#FDFDFE',sh:'#F2F4F6',sa:'#F1F3F5'},
  byn:     {ac:'#1A1A1A',ah:'#000000',al:'#F2F2F2',am:'#C9C9C9',bg:'#FAFAFA',s2:'#F4F4F4',bd:'#E6E6E6',tp:'#141414',ts:'#555555',tm:'#999999',sb:'#FFFFFF',sh:'#F5F5F5',sa:'#F0F0F0'}
};

function _hexRgb(h){ h=String(h).replace('#',''); if(h.length===3) h=h.split('').map(c=>c+c).join(''); const n=parseInt(h,16); return `${(n>>16)&255},${(n>>8)&255},${n&255}`; }

function aplicarTema(key){
  const t=TEMAS[key]||TEMAS.rosado;
  const map={
    '--accent':t.ac,'--accent-hover':t.ah,'--accent-light':t.al,'--accent-mid':t.am,'--accent-rgb':_hexRgb(t.ac),'--border-focus':t.ac,
    '--bg':t.bg,'--surface':'#FFFFFF','--surface-2':t.s2,'--border':t.bd,
    '--text-primary':t.tp,'--text-secondary':t.ts,'--text-muted':t.tm,
    '--sidebar-bg':t.sb,'--sidebar-hover':t.sh,'--sidebar-active':t.sa,
    '--sidebar-text':t.ts,'--sidebar-text-active':t.ah,'--sidebar-label':t.tm,
    '--sidebar-indicator':t.ac,'--sidebar-indicator-rgb':_hexRgb(t.ac),'--sidebar-border':t.bd,
    /* nombres que usa la tienda */
    '--rose':t.ac,'--rose-light':t.al,'--rose-mid':t.am,'--rose-dark':t.ah,
    '--cream':t.bg,'--cream-dark':t.s2,'--text-dark':t.tp,'--text-mid':t.ts,'--text-soft':t.tm
  };
  let s=document.getElementById('__tema_vars');
  if(!s){ s=document.createElement('style'); s.id='__tema_vars'; document.head.appendChild(s); }
  s.textContent=':root{'+Object.entries(map).map(([k,v])=>k+':'+v).join(';')+'}';
}
/* Avisa un error de guardado usando el toast de la página que esté cargada
   (admin usa `toast`, tienda usa `toastT`); si ninguno existe, alert(). */
function _avisoGuardado(msg){
  if(typeof window!=='undefined'){
    if(typeof window.toast==='function') return window.toast(msg,'error');
    if(typeof window.toastT==='function') return window.toastT(msg,'error');
  }
  try{ window.alert(msg); }catch(e){}
}

function dbGuardar(){
  /* 1) Cache local inmediata (respaldo/offline) */
  try{ almacen.escribir(JSON.stringify(DB)); }
  catch(e){
    _avisoGuardado('No hay espacio para guardar más imágenes. Sube fotos más livianas o quita algunas.');
    console.warn('dbGuardar (cache):',e);
  }
  /* 2) Persistir en el backend (MySQL) si hay sesión con token.
     Importante: esta función devuelve `true` de inmediato (varias pantallas
     la usan como `if(dbGuardar())` para actualizar la UI al toque), pero el
     fetch es asíncrono — si el guardado en el servidor falla, antes esto solo
     quedaba en la consola y la UI igual mostraba "guardado" como si nada.
     Ahora si falla se avisa explícitamente, para no dar una falsa sensación
     de que sí se guardó cuando el cambio solo quedó en este navegador. */
  const tok=bsToken(), role=bsRole();
  if(tok&&role==='admin'){
    _guardandoHasta = Date.now() + 2500;   // no refrescar encima de este guardado
    _colaGuardado=_colaGuardado.then(async()=>{
      const r=await fetch(API_BASE+'/api/state',{method:'PUT',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},body:JSON.stringify(DB)});
      const j=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(j.error||('Error '+r.status));
      if(j.revision!=null) DB._revision=j.revision;
      almacen.escribir(JSON.stringify(DB));
    }).catch(e=>{ console.warn('Guardado en backend error:',e.message); _avisoGuardado(e.message||'No se pudo guardar en el servidor.'); });
  }else if(tok&&role==='proveedor'){
    _avisoGuardado('Tu rol de proveedor es de consulta. Un administrador debe realizar este cambio.');
  }
  return true;
}

/* Trae el estado más reciente del backend (para refresco en vivo).
   No pisa un guardado local reciente. Devuelve true si actualizó.
   Función compartida entre admin.html (refresca SU propio negocio) y el
   poll de chat de tienda.html (refresca pedidos/mensajes mientras se
   navega una tienda como comprador) — opts.asBuyer distingue el segundo
   caso. Sin esto, un admin navegando OTRA tienda con "Abrir portal
   cliente" tiene bsRole()==='admin', así que caía SIEMPRE en la rama de
   /api/state (SU propio negocio) y cada 3s pisaba en memoria el
   DB.productos/categorias de la tienda que estaba viendo con los de su
   propia tienda — el catálogo se veía bien al cargar la página y se
   arruinaba solo con quedarse navegando/cambiando de pestaña un rato. */
async function refrescarEstado(opts){
  const tok = bsToken();
  if(!tok) return false;
  if(Date.now() < _guardandoHasta) return false;
  const comoComprador = bsRole()==='cliente' || (bsRole()==='admin' && opts && opts.asBuyer);
  try{
    if(comoComprador){
      const historial=await apiGet('/api/mis-pedidos');
      DB.pedidos=historial.pedidos||[];
      DB.mensajes=DB.pedidos.flatMap(p=>(p.mensajes||[]).map(m=>({...m,empresa_id:m.empresa_id||p.empresa?.id,pedido_id:m.pedido_id||p.id})));
      almacen.escribir(JSON.stringify(DB), DB);
      return true;
    }
    const r = await fetch(API_BASE + '/api/state', { headers:{ 'Authorization':'Bearer '+tok } });
    if(!r.ok) return false;
    DB = await r.json();
    _migrar();
    almacen.escribir(JSON.stringify(DB), DB);
    return true;
  }catch(e){ return false; }
}
function nuevoId(t){ return ++DB.seq[t]; }

function _migrar(){
  if(!DB||typeof DB!=='object') DB=_esqueletoDB();
  if(!DB.config) DB.config=_esqueletoDB().config;
  for(const k of ['categorias','proveedores','clientes','productos','compras','ventas','movimientos','pedidos','mensajes']) if(!Array.isArray(DB[k])) DB[k]=[];
  if(!DB.seq||typeof DB.seq!=='object') DB.seq={};
  if(!DB.seq.pedido) DB.seq.pedido=0;
  if(!Array.isArray(DB.config.banners)) DB.config.banners=[];
  if(!Array.isArray(DB.config.galeria)) DB.config.galeria=[];
  DB.config.galeria=DB.config.galeria.filter(Boolean).map((g,i)=>typeof g==='string'?{id:i+1,imagen:g,titulo:'',descripcion:''}:{id:g.id||i+1,imagen:g.imagen||'',titulo:g.titulo||'',descripcion:g.descripcion||''}).filter(g=>g.imagen);
  if(!DB.config.pago||typeof DB.config.pago!=='object') DB.config.pago={banco:'',cuenta:'',titular:'',tipo:'',nota:''};
  /* Migrar claves de tema viejas → nuevas */
  const _mapTema={default:'cielo',admin:'cielo',slate:'lavanda',forest:'salvia',wine:'durazno',ocean:'cielo'};
  if(_mapTema[DB.config.tema]) DB.config.tema=_mapTema[DB.config.tema];
  if(!DB.config.tema||!TEMAS[DB.config.tema]) DB.config.tema='cielo';
  DB.clientes.forEach(c=>{ if(c.whatsapp===undefined) c.whatsapp=''; });
  DB.productos.forEach(p=>{
    if(p.destacado===undefined) p.destacado=false;
    if(p.marca===undefined) p.marca='';
    if(!Array.isArray(p.tipoPiel)) p.tipoPiel=[];
    if(!Array.isArray(p.imagenes)) p.imagenes=[];
    p.imagenes=p.imagenes.filter(Boolean);
    if(p.imagen&&!p.imagenes.includes(p.imagen)) p.imagenes.unshift(p.imagen);
    if(!p.imagen&&p.imagenes.length) p.imagen=p.imagenes[0];
    if(p.stock_inventario===undefined) p.stock_inventario=0;
    if(p.publicado_alguna_vez===undefined) p.publicado_alguna_vez=!!(p.stock>0||p.estado==='activo');
  });
  DB.ventas.forEach(v=>{
    if(v.origen_stock===undefined) v.origen_stock='tienda';
    if(v.stock_tienda_usado===undefined) v.stock_tienda_usado=Number(v.cantidad)||0;
    if(v.stock_inventario_usado===undefined) v.stock_inventario_usado=0;
  });
  DB.proveedores.forEach(p=>{ if(p.whatsapp===undefined) p.whatsapp=''; if(!p.origen) p.origen='registrado'; });
  if(!DB.mensajes) DB.mensajes=[];
  if(!DB.seq.mensaje) DB.seq.mensaje=0;
  DB.clientes.forEach(c=>{ if(c.registrado===undefined) c.registrado=true; });
}

/* helpers */
const prodPor  = id => DB.productos.find(p=>p.id===id);
const catPor   = id => DB.categorias.find(c=>c.id===id);
const provPor  = id => DB.proveedores.find(p=>p.id===id);
const cliPor   = id => DB.clientes.find(c=>c.id===id);
const pedPor   = id => DB.pedidos.find(p=>p.id===id);

/* formato */
const dinero  = n => `${DB.config.moneda} ${Number(n||0).toLocaleString('es-HN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const esc     = t => String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fechaCorta = f => { if(!f) return '—'; const [a,m,d]=f.split('-'); const M=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']; return `${+d} ${M[+m-1]} ${a}`; };

/* Helper mensajes — usado por admin/main.js (badge de chat en Pedidos) */
const mensajesNoLeidos = (pedId, autor) => (DB.mensajes||[]).filter(m=>m.pedido_id===pedId&&m.autor!==autor&&!m.leido).length;
const msgsDePedido = pedId => (DB.mensajes||[]).filter(m=>m.pedido_id===pedId).sort((a,b)=>a.id-b.id);
