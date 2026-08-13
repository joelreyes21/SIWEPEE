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

/* Empresa/tienda activa: viene en la URL como ?e=slug (o id). Se recuerda en
   localStorage para que sobreviva a la navegación dentro de la misma tienda. */
function bsEmpresa(){
  try{
    const u = new URLSearchParams(location.search).get('e');
    if(u){ localStorage.setItem('bs_empresa', u); return u; }
    return localStorage.getItem('bs_empresa') || '';
  }catch(e){ return ''; }
}

/* Cache local (respaldo si el backend no está disponible).
   Se guarda por empresa (bs_empresa) para que el respaldo de una tienda
   nunca se muestre encima de otra si el fetch de la tienda actual falla. */
const almacen = {
  leer:  ()=>{ try{ return localStorage.getItem(BS_CLAVE + ':' + (bsEmpresa()||'_')); }catch(e){ return null; } },
  escribir: v=>{ try{ localStorage.setItem(BS_CLAVE + ':' + (bsEmpresa()||'_'), v); }catch(e){} }
};

let DB = null;
let _guardandoHasta = 0;   // evita pisar un guardado reciente al refrescar

function _esqueletoDB(){
  return { config:{nombre:'SIWEPE',logo:'',moneda:'L',tema:'cielo',pinAdmin:'1234',banners:[],pago:{}},
    seq:{}, categorias:[], proveedores:[], clientes:[], productos:[], compras:[], ventas:[], movimientos:[], pedidos:[], mensajes:[] };
}

/* Carga el estado desde el backend.
   - Con sesión (token): estado completo (/api/state).
   - Invitado (sin token): solo catálogo público (/api/catalog).
   - Sin backend: respaldo local/semilla. */
async function bootstrapDB(opts){
  let tok = bsToken();
  /* Un token de cliente pertenece a UNA tienda (empresa_id va adentro del JWT).
     Si estás logueado como cliente de la Tienda A y navegás a la URL de la
     Tienda B, seguir usando ese token mezclaría los datos de A dentro de la
     página de B. bsEmpresa() ya cambia con la URL; acá comparamos contra la
     empresa con la que se guardó la sesión y, si no coincide, se descarta
     (la página actual entra como invitada, no como sesión de otra tienda). */
  if(opts && opts.checkEmpresa && tok){
    const empresaActual = bsEmpresa();
    let empresaToken=''; try{ empresaToken = localStorage.getItem('bs_token_empresa')||''; }catch(e){}
    if(empresaActual && empresaToken && empresaActual!==empresaToken){
      limpiarSesionToken();
      try{ localStorage.removeItem('bs_sesion_cli'); }catch(e){}
      tok='';
    }
  }
  try{
    // Con sesión: estado completo (el token ya sabe de qué empresa es).
    // Invitado: catálogo público de la tienda indicada en la URL (?e=slug).
    const ruta = tok ? '/api/state' : ('/api/catalog?empresa=' + encodeURIComponent(bsEmpresa()));
    const r = await fetch(API_BASE + ruta, tok ? { headers:{ 'Authorization':'Bearer '+tok } } : undefined);
    if(!r.ok) throw new Error('estado ' + r.status);
    const data = await r.json();
    if(tok){
      DB = data;
    }else{
      DB = _esqueletoDB();
      DB.config = Object.assign(DB.config, data.config||{});
      DB.categorias = data.categorias || [];
      DB.productos = data.productos || [];
    }
    almacen.escribir(JSON.stringify(DB));
  }catch(e){
    if(tok){
      /* Con sesión, un fallo del backend (token inválido/vencido, cuenta sin
         empresa asociada como el admin de plataforma, etc.) NO debe tapar el
         error mostrando el respaldo local como si fuera el estado actual:
         ese respaldo puede pertenecer a OTRA cuenta/tienda probada antes en
         este mismo navegador. Se corta la sesión y se avisa a quien llamó. */
      limpiarSesionToken();
      try{ localStorage.removeItem('bs_sesion_cli'); localStorage.removeItem('bs_sesion_admin'); }catch(e2){}
      DB = _esqueletoDB();
      _migrar();
      throw e;
    }
    console.warn('Sin conexión al backend, usando datos locales:', e.message);
    const raw = almacen.leer();
    DB = raw ? JSON.parse(raw) : _esqueletoDB();
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
  if(!r.ok) throw new Error(j.error || ('Error ' + r.status));
  return j;
}

/* Llamadas autenticadas genéricas (usan el token de sesión) */
async function apiGet(ruta){
  const tok = bsToken();
  const r = await fetch(API_BASE + ruta, tok ? { headers:{ 'Authorization':'Bearer '+tok } } : undefined);
  const j = await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(j.error || ('Error ' + r.status));
  return j;
}
async function apiPut(ruta, datos){
  const tok = bsToken();
  const r = await fetch(API_BASE + ruta, {
    method:'PUT', headers:{'Content-Type':'application/json', 'Authorization':'Bearer '+tok}, body: JSON.stringify(datos)
  });
  const j = await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(j.error || ('Error ' + r.status));
  return j;
}
/* POST autenticado (usa el token de sesión) */
async function apiPostAuth(ruta, datos){
  const tok = bsToken();
  const r = await fetch(API_BASE + ruta, {
    method:'POST', headers:{'Content-Type':'application/json', 'Authorization':'Bearer '+tok}, body: JSON.stringify(datos)
  });
  const j = await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(j.error || ('Error ' + r.status));
  return j;
}
function guardarSesionToken(token, role, nombre){
  try{
    localStorage.setItem('bs_token', token || '');
    localStorage.setItem('bs_role', role || '');
    if(nombre) localStorage.setItem('bs_user', nombre);
    // Solo el rol cliente está atado a una tienda puntual (?e=); admin/proveedor
    // no dependen de la URL, así que no hace sentido guardarles una "empresa".
    if(role==='cliente') localStorage.setItem('bs_token_empresa', bsEmpresa());
    else localStorage.removeItem('bs_token_empresa');
  }catch(e){}
}
function limpiarSesionToken(){
  try{
    localStorage.removeItem('bs_token'); localStorage.removeItem('bs_role');
    localStorage.removeItem('bs_user'); localStorage.removeItem('bs_token_empresa');
  }catch(e){}
}

const hoy = (d=0) => { const x=new Date(); x.setDate(x.getDate()+d); return x.toISOString().slice(0,10); };
const mesActual = () => hoy().slice(0,7);

function semilla(){
  return {
    config:{ nombre:'SIWEPE', logo:'', moneda:'L', tema:'cielo', pinAdmin:'1234', banners:[] },
    seq:{ producto:8,categoria:5,proveedor:3,cliente:4,compra:5,venta:6,movimiento:11,pedido:2 },
    categorias:[
      {id:1,nombre:'Maquillaje',descripcion:'Labiales, sombras, bases',estado:'activo'},
      {id:2,nombre:'Cuidado de la piel',descripcion:'Cremas, sérums, limpiadores',estado:'activo'},
      {id:3,nombre:'Perfumería',descripcion:'Fragancias y splash corporales',estado:'activo'},
      {id:4,nombre:'Accesorios',descripcion:'Aretes, bolsos y detalles',estado:'activo'},
      {id:5,nombre:'Cabello',descripcion:'Tratamientos y styling',estado:'activo'}
    ],
    productos:[
      {id:1,codigo:'MAQ-001',nombre:'Labial mate Rosé',categoria_id:1,descripcion:'Larga duración, tono rosa nude. Fórmula hidratante que no reseca.',precio_compra:120,precio_venta:220,stock:24,stock_min:8,imagen:'',estado:'activo',destacado:true},
      {id:2,codigo:'MAQ-002',nombre:'Paleta de sombras Sunset',categoria_id:1,descripcion:'12 tonos cálidos satinados. Pigmentación intensa, fácil difuminado.',precio_compra:280,precio_venta:480,stock:6,stock_min:10,imagen:'',estado:'activo',destacado:true},
      {id:3,codigo:'PIEL-001',nombre:'Sérum de vitamina C',categoria_id:2,descripcion:'Ilumina y unifica el tono de la piel en 4 semanas. 30 ml.',precio_compra:210,precio_venta:390,stock:15,stock_min:6,imagen:'',estado:'activo',destacado:true},
      {id:4,codigo:'PIEL-002',nombre:'Crema hidratante de rosas',categoria_id:2,descripcion:'Con agua de rosas y ácido hialurónico. Para piel sensible.',precio_compra:160,precio_venta:295,stock:3,stock_min:5,imagen:'',estado:'activo',destacado:false},
      {id:5,codigo:'PERF-001',nombre:'Perfume Fleur Dorée 50 ml',categoria_id:3,descripcion:'Notas de peonía, vainilla y ámbar. Duración 8+ horas.',precio_compra:520,precio_venta:890,stock:9,stock_min:4,imagen:'',estado:'activo',destacado:true},
      {id:6,codigo:'ACC-001',nombre:'Aretes perla dorada',categoria_id:4,descripcion:'Baño de oro 18k. Hipoalergénicos, ideales para piel sensible.',precio_compra:85,precio_venta:180,stock:30,stock_min:10,imagen:'',estado:'activo',destacado:false},
      {id:7,codigo:'ACC-002',nombre:'Bolso mini beige',categoria_id:4,descripcion:'Piel sintética premium con cadena dorada. 20×15×6 cm.',precio_compra:340,precio_venta:620,stock:0,stock_min:3,imagen:'',estado:'activo',destacado:true},
      {id:8,codigo:'CAB-001',nombre:'Mascarilla de keratina',categoria_id:5,descripcion:'Reparación profunda para cabello dañado. 250 g.',precio_compra:140,precio_venta:260,stock:18,stock_min:6,imagen:'',estado:'activo',destacado:false}
    ],
    proveedores:[
      {id:1,nombre:'Karla Pineda',telefono:'9988-1122',correo:'ventas@bellezahn.com',empresa:'Belleza HN',direccion:'Col. Palmira, Tegucigalpa',whatsapp:'50499881122',estado:'activo'},
      {id:2,nombre:'Luis Fernández',telefono:'3344-5566',correo:'luis@cosmetigroup.com',empresa:'CosmetiGroup',direccion:'San Pedro Sula',whatsapp:'50433445566',estado:'activo'},
      {id:3,nombre:'María Castillo',telefono:'8877-2233',correo:'maria@doradaimport.com',empresa:'Dorada Import',direccion:'Comayagüela',whatsapp:'',estado:'inactivo'}
    ],
    clientes:[
      {id:1,nombre:'Andrea López',telefono:'9911-4455',correo:'andrea.lopez@gmail.com',direccion:'Res. El Trapiche',whatsapp:'50499114455',pin:'1111'},
      {id:2,nombre:'Sofía Martínez',telefono:'3300-7788',correo:'sofi.mtz@hotmail.com',direccion:'Col. Kennedy',whatsapp:'50433007788',pin:'2222'},
      {id:3,nombre:'Daniela Reyes',telefono:'9455-0000',correo:'dani.reyes@gmail.com',direccion:'Lomas del Guijarro',whatsapp:'50494550000',pin:'3333'},
      {id:4,nombre:'Cliente general',telefono:'—',correo:'—',direccion:'—',whatsapp:'',pin:'0000'}
    ],
    compras:[
      {id:1,producto_id:1,proveedor_id:1,cantidad:12,precio:120,fecha:hoy(-15),obs:'Reposición mensual'},
      {id:2,producto_id:5,proveedor_id:2,cantidad:6,precio:520,fecha:hoy(-10),obs:'Lote fragancias'},
      {id:3,producto_id:6,proveedor_id:1,cantidad:20,precio:85,fecha:hoy(-7),obs:''},
      {id:4,producto_id:3,proveedor_id:2,cantidad:10,precio:210,fecha:hoy(-5),obs:''},
      {id:5,producto_id:2,proveedor_id:3,cantidad:8,precio:280,fecha:hoy(-3),obs:'Reposición'},
      {id:6,producto_id:1,proveedor_id:1,cantidad:10,precio:120,fecha:hoy(-38),obs:''},
      {id:7,producto_id:4,proveedor_id:2,cantidad:8,precio:160,fecha:hoy(-35),obs:''},
      {id:8,producto_id:8,proveedor_id:1,cantidad:12,precio:140,fecha:hoy(-42),obs:''},
      {id:9,producto_id:2,proveedor_id:3,cantidad:6,precio:280,fecha:hoy(-70),obs:''},
      {id:10,producto_id:5,proveedor_id:2,cantidad:4,precio:520,fecha:hoy(-65),obs:''},
      {id:11,producto_id:6,proveedor_id:1,cantidad:15,precio:85,fecha:hoy(-98),obs:''},
      {id:12,producto_id:3,proveedor_id:2,cantidad:8,precio:210,fecha:hoy(-100),obs:''},
      {id:13,producto_id:1,proveedor_id:1,cantidad:14,precio:120,fecha:hoy(-130),obs:''},
      {id:14,producto_id:8,proveedor_id:1,cantidad:10,precio:140,fecha:hoy(-160),obs:''}
    ],
    ventas:[
      // Mes actual
      {id:1,producto_id:1,cliente_id:1,cantidad:2,precio:220,fecha:hoy(-8),total:440},
      {id:2,producto_id:3,cliente_id:2,cantidad:1,precio:390,fecha:hoy(-5),total:390},
      {id:3,producto_id:6,cliente_id:3,cantidad:3,precio:180,fecha:hoy(-3),total:540},
      {id:4,producto_id:5,cliente_id:1,cantidad:1,precio:890,fecha:hoy(-2),total:890},
      {id:5,producto_id:2,cliente_id:2,cantidad:1,precio:480,fecha:hoy(-1),total:480},
      {id:6,producto_id:1,cliente_id:3,cantidad:3,precio:220,fecha:hoy(),total:660},
      {id:7,producto_id:8,cliente_id:1,cantidad:2,precio:260,fecha:hoy(-4),total:520},
      // Mes -1
      {id:8,producto_id:1,cliente_id:2,cantidad:4,precio:220,fecha:hoy(-35),total:880},
      {id:9,producto_id:3,cliente_id:1,cantidad:2,precio:390,fecha:hoy(-30),total:780},
      {id:10,producto_id:5,cliente_id:3,cantidad:1,precio:890,fecha:hoy(-32),total:890},
      {id:11,producto_id:2,cliente_id:1,cantidad:2,precio:480,fecha:hoy(-28),total:960},
      {id:12,producto_id:6,cliente_id:2,cantidad:5,precio:180,fecha:hoy(-27),total:900},
      {id:13,producto_id:4,cliente_id:3,cantidad:2,precio:295,fecha:hoy(-25),total:590},
      // Mes -2
      {id:14,producto_id:1,cliente_id:1,cantidad:3,precio:220,fecha:hoy(-65),total:660},
      {id:15,producto_id:8,cliente_id:2,cantidad:3,precio:260,fecha:hoy(-62),total:780},
      {id:16,producto_id:5,cliente_id:1,cantidad:2,precio:890,fecha:hoy(-58),total:1780},
      {id:17,producto_id:3,cliente_id:3,cantidad:1,precio:390,fecha:hoy(-60),total:390},
      {id:18,producto_id:6,cliente_id:2,cantidad:4,precio:180,fecha:hoy(-55),total:720},
      // Mes -3
      {id:19,producto_id:2,cliente_id:1,cantidad:3,precio:480,fecha:hoy(-95),total:1440},
      {id:20,producto_id:1,cliente_id:3,cantidad:5,precio:220,fecha:hoy(-92),total:1100},
      {id:21,producto_id:5,cliente_id:2,cantidad:1,precio:890,fecha:hoy(-88),total:890},
      {id:22,producto_id:3,cliente_id:1,cantidad:2,precio:390,fecha:hoy(-90),total:780},
      {id:23,producto_id:4,cliente_id:2,cantidad:3,precio:295,fecha:hoy(-85),total:885},
      // Mes -4
      {id:24,producto_id:1,cliente_id:2,cantidad:6,precio:220,fecha:hoy(-125),total:1320},
      {id:25,producto_id:6,cliente_id:1,cantidad:8,precio:180,fecha:hoy(-122),total:1440},
      {id:26,producto_id:2,cliente_id:3,cantidad:2,precio:480,fecha:hoy(-118),total:960},
      {id:27,producto_id:8,cliente_id:2,cantidad:4,precio:260,fecha:hoy(-115),total:1040},
      // Mes -5
      {id:28,producto_id:3,cliente_id:1,cantidad:3,precio:390,fecha:hoy(-155),total:1170},
      {id:29,producto_id:5,cliente_id:3,cantidad:2,precio:890,fecha:hoy(-152),total:1780},
      {id:30,producto_id:1,cliente_id:2,cantidad:4,precio:220,fecha:hoy(-148),total:880},
      {id:31,producto_id:4,cliente_id:1,cantidad:2,precio:295,fecha:hoy(-150),total:590}
    ],
    movimientos:[
      {id:1,tipo:'entrada',producto_id:1,cantidad:12,fecha:hoy(-15),usuario:'Admin',obs:'Compra · Reposición mensual'},
      {id:2,tipo:'entrada',producto_id:5,cantidad:6,fecha:hoy(-10),usuario:'Admin',obs:'Compra · Lote fragancias'},
      {id:3,tipo:'salida',producto_id:1,cantidad:2,fecha:hoy(-8),usuario:'Admin',obs:'Venta a Andrea López'},
      {id:4,tipo:'entrada',producto_id:6,cantidad:20,fecha:hoy(-7),usuario:'Admin',obs:'Compra'},
      {id:5,tipo:'salida',producto_id:3,cantidad:1,fecha:hoy(-5),usuario:'Admin',obs:'Venta a Sofía Martínez'},
      {id:6,tipo:'entrada',producto_id:3,cantidad:10,fecha:hoy(-5),usuario:'Admin',obs:'Compra'},
      {id:7,tipo:'salida',producto_id:6,cantidad:3,fecha:hoy(-3),usuario:'Admin',obs:'Venta a Daniela Reyes'},
      {id:8,tipo:'salida',producto_id:5,cantidad:1,fecha:hoy(-2),usuario:'Admin',obs:'Venta a Andrea López'},
      {id:9,tipo:'entrada',producto_id:2,cantidad:8,fecha:hoy(-3),usuario:'Admin',obs:'Compra'},
      {id:10,tipo:'salida',producto_id:2,cantidad:1,fecha:hoy(-1),usuario:'Admin',obs:'Venta a Sofía Martínez'},
      {id:11,tipo:'salida',producto_id:1,cantidad:3,fecha:hoy(),usuario:'Admin',obs:'Venta a Daniela Reyes'}
    ],
    pedidos:[
      {id:1,cliente_id:1,items:[{producto_id:1,cantidad:2,precio:220,subtotal:440},{producto_id:3,cantidad:1,precio:390,subtotal:390}],total:830,nota:'Para regalo, envolver por favor',fecha:hoy(-2),estado:'aprobado'},
      {id:2,cliente_id:2,items:[{producto_id:5,cantidad:1,precio:890,subtotal:890}],total:890,nota:'',fecha:hoy(),estado:'pendiente'}
    ]
  };
}

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
function dbGuardar(){
  /* 1) Cache local inmediata (respaldo/offline) */
  try{ almacen.escribir(JSON.stringify(DB)); }
  catch(e){
    const msg='No hay espacio para guardar más imágenes. Sube fotos más livianas o quita algunas.';
    if(typeof toast==='function') toast(msg,'error');
    else if(typeof window!=='undefined') window.alert(msg);
    console.warn('dbGuardar (cache):',e);
  }
  /* 2) Persistir en el backend (MySQL) si hay sesión con token */
  const tok = bsToken();
  if(tok){
    _guardandoHasta = Date.now() + 2500;   // no refrescar encima de este guardado
    fetch(API_BASE + '/api/state', {
      method:'PUT',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},
      body: JSON.stringify(DB)
    }).then(r=>{ if(!r.ok) console.warn('Guardado en backend falló:', r.status); })
      .catch(e=>console.warn('Guardado en backend error:', e.message));
  }
  return true;
}

/* Trae el estado más reciente del backend (para refresco en vivo).
   No pisa un guardado local reciente. Devuelve true si actualizó. */
async function refrescarEstado(){
  const tok = bsToken();
  if(!tok) return false;
  if(Date.now() < _guardandoHasta) return false;
  try{
    const r = await fetch(API_BASE + '/api/state', { headers:{ 'Authorization':'Bearer '+tok } });
    if(!r.ok) return false;
    DB = await r.json();
    _migrar();
    almacen.escribir(JSON.stringify(DB));
    return true;
  }catch(e){ return false; }
}
function nuevoId(t){ return ++DB.seq[t]; }

function _migrar(){
  if(!DB.pedidos) DB.pedidos=[];
  if(!DB.seq.pedido) DB.seq.pedido=0;
  if(!DB.config.pinAdmin) DB.config.pinAdmin='1234';
  if(!Array.isArray(DB.config.banners)) DB.config.banners=[];
  if(!DB.config.pago||typeof DB.config.pago!=='object') DB.config.pago={banco:'',cuenta:'',titular:'',tipo:'',nota:''};
  /* Migrar claves de tema viejas → nuevas */
  const _mapTema={default:'cielo',admin:'cielo',slate:'lavanda',forest:'salvia',wine:'durazno',ocean:'cielo'};
  if(_mapTema[DB.config.tema]) DB.config.tema=_mapTema[DB.config.tema];
  if(!DB.config.tema||!TEMAS[DB.config.tema]) DB.config.tema='cielo';
  DB.clientes.forEach(c=>{ if(!c.pin) c.pin='0000'; if(c.whatsapp===undefined) c.whatsapp=''; });
  DB.productos.forEach(p=>{ if(p.destacado===undefined) p.destacado=false; if(p.marca===undefined) p.marca=''; if(!Array.isArray(p.tipoPiel)) p.tipoPiel=[]; });
  DB.proveedores.forEach(p=>{ if(p.whatsapp===undefined) p.whatsapp=''; });
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

/* ── MIGRACIÓN: mensajes de chat por pedido ── */
function _migrarChat(){
  if(!DB.mensajes) DB.mensajes=[];
  if(!DB.seq.mensaje) DB.seq.mensaje=0;
  /* Asegurar que clientes tengan campo registrado */
  DB.clientes.forEach(c=>{ if(c.registrado===undefined) c.registrado=true; });
}

/* Sobreescribir _migrar para incluir chat */
const _migrarOriginal = _migrar;
// Ya llamamos _migrarChat() desde dbCargar extendido

/* Helper mensajes */
const msgsDePedido = pedId => (DB.mensajes||[]).filter(m=>m.pedido_id===pedId).sort((a,b)=>a.id-b.id);
const mensajesNoLeidos = (pedId, autor) => (DB.mensajes||[]).filter(m=>m.pedido_id===pedId&&m.autor!==autor&&!m.leido).length;

function enviarMensaje(pedido_id, autor, texto){
  if(!DB.mensajes) DB.mensajes=[];
  if(!DB.seq.mensaje) DB.seq.mensaje=0;
  const msg={id:++DB.seq.mensaje, pedido_id, autor, texto, fecha:new Date().toISOString(), leido:false};
  DB.mensajes.push(msg);
  dbGuardar();
  return msg;
}

function marcarLeidosMensajes(pedido_id, autor){
  if(!DB.mensajes) return;
  DB.mensajes.filter(m=>m.pedido_id===pedido_id&&m.autor!==autor).forEach(m=>m.leido=true);
  dbGuardar();
}
