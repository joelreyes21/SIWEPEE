/*! SIWEPE · © 2026 Joel Reyes. Todos los derechos reservados. · Prohibida su reproduccion o distribucion sin autorizacion. */
/*
  admin/main.js — Panel Administrador completo
*/

/* ── utilidades ── */
const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const noVacio  = v => v.trim().length > 0;
const numPos   = v => v !== '' && !isNaN(v) && Number(v) >= 0 && !/e/i.test(v);
const numVacioCero = v => v.trim() === '' || numPos(v);
const entPos   = v => /^\d+$/.test(v) && Number(v) > 0;
const correoOk = v => v.trim() === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

const THUMB_COLORS=['#6B7280','#8A8F98','#9AA1AC','#7C8390','#B0B6BE','#A0A6AE','#545B66'];
const GRADS=['linear-gradient(135deg,#EEF0F2,#D6DBE0)','linear-gradient(135deg,#F1F1F3,#D9D9DE)','linear-gradient(135deg,#EDEFF1,#D3D9DE)','linear-gradient(135deg,#F2F1EF,#DAD7D3)','linear-gradient(135deg,#EBEEF1,#CFD6DD)','linear-gradient(135deg,#F0F0EE,#D8D5D0)'];
function prodGrad(n){ let h=0; for(let i=0;i<n.length;i++) h=(h*31+n.charCodeAt(i))&0xFFFFFF; return {bg:GRADS[h%GRADS.length],color:THUMB_COLORS[h%THUMB_COLORS.length]}; }

/* ── Fallback de imágenes rotas → muestra placeholder con la letra ── */
function imgFb(img){
  const p=img.parentNode; if(!p) return;
  const l=img.getAttribute('data-l')||'?';
  const ph=img.getAttribute('data-ph');
  const bg=img.getAttribute('data-bg')||'';
  const col=img.getAttribute('data-col')||'';
  img.remove();
  if(ph==='card'){ p.insertAdjacentHTML('beforeend',`<div class="pca-placeholder" style="background:${bg}"><span style="color:${col}">${l}</span></div>`); }
  else { p.textContent=l; }
}
window.imgFb=imgFb;

/* ── Comprime/redimensiona una imagen antes de guardarla (evita llenar el almacenamiento) ──
   Convierte automáticamente fotos HEIC/HEIF de iPhone a JPG si la librería está disponible. */
async function comprimirImagen(file, maxDim=900, calidad=0.82){
  if(!file || file.size>6*1024*1024) throw {tipo:'peso'};
  if(!/^image\//i.test(file.type||'')&&!/\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name||'')) throw {tipo:'formato'};
  let fuente=file;
  const esHeic = /image\/hei(c|f)/i.test(file.type||'') || /\.(heic|heif)$/i.test(file.name||'');
  if(esHeic){
    if(typeof heic2any==='function'){
      try{
        const conv=await heic2any({blob:file,toType:'image/jpeg',quality:0.9});
        fuente=Array.isArray(conv)?conv[0]:conv;
      }catch(e){ throw {tipo:'heic'}; }
    }else{ throw {tipo:'heic'}; }
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
        }catch(err){ resolve(r.result); } // si no se puede (ej. SVG), usar original
      };
      img.onerror=()=>reject({tipo:'decode'});
      img.src=r.result;
    };
    r.onerror=()=>reject({tipo:'read'});
    r.readAsDataURL(fuente);
  });
}
window.comprimirImagen=comprimirImagen;

/* Mensaje de error de imagen, claro y según el caso */
function errImagen(err){
  if(err&&err.tipo==='peso') return 'La imagen supera 6 MB. Elige una foto más liviana.';
  if(err&&err.tipo==='formato') return 'Formato no compatible. Usa JPG, PNG, WEBP, GIF o HEIC.';
  if(err&&err.tipo==='heic') return 'Esa foto es formato HEIC (iPhone) y no se pudo convertir. Conéctate a internet o guárdala como JPG/PNG e inténtalo de nuevo.';
  if(err&&err.tipo==='decode') return 'Ese archivo no es una imagen válida (¿quizás HEIC o dañada?). Usa JPG o PNG.';
  return 'No se pudo procesar la imagen. Intenta con otra en JPG o PNG.';
}
window.errImagen=errImagen;

function svgIcon(id,size=14){ return `<svg width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><use href="#icon-${id}"/></svg>`; }

/* ── TOASTS ── */
function toast(msg, tipo='ok'){
  const el = document.createElement('div');
  el.className = `toast ${tipo==='ok'?'':''+tipo}`;
  const icon = tipo==='ok'?'check':tipo==='warn'?'alerta':'alerta';
  el.innerHTML = `<span class="toast-dot">${svgIcon(icon,12)}</span><span>${esc(msg)}</span>`;
  $('#toasts').appendChild(el);
  setTimeout(()=>{ el.classList.add('out'); setTimeout(()=>el.remove(),300); },3400);
}

/* ── MODAL ── */
let _modalConfirmFn = null;

function openModal(titulo, sub, html, maxw='580px'){
  $('#modal-title').textContent = titulo;
  $('#modal-sub').textContent = sub || '';
  $('#modal-body').innerHTML = html;
  const m = $('#modal');
  m.style.maxWidth = maxw;
  $('#modal-overlay').classList.add('open');
  setTimeout(()=>{ const f = $('#modal-body input, #modal-body select'); if(f) f.focus(); },120);
}
function closeModal(){ $('#modal-overlay').classList.remove('open'); }

/* Los precios pueden quedar vacíos mientras se editan. Al abandonar el campo
   se normalizan a cero; así el usuario puede borrar el valor completo sin que
   el formulario lo reponga en cada pulsación. */
function precioVacioEnCero(id){
  const input=document.getElementById(id); if(!input) return;
  input.addEventListener('blur',()=>{
    if(input.value.trim()===''){
      input.value='0';
      input.dispatchEvent(new Event('input',{bubbles:true}));
    }
  });
}

function openConfirm(texto, fn){
  $('#confirm-text').textContent = texto;
  _modalConfirmFn = fn;
  $('#confirm-overlay').classList.add('open');
}
function closeConfirm(){ $('#confirm-overlay').classList.remove('open'); _modalConfirmFn = null; }

/* ── VALIDACIÓN ── */
function validar(reglas){
  let ok = true;
  for(const [id, fn, msg] of reglas){
    const inp = document.getElementById(id); if(!inp) continue;
    const field = inp.closest('.field');
    let err = field?.querySelector('.ferr');
    if(!err && field){ err = document.createElement('span'); err.className='ferr'; field.appendChild(err); }
    if(!fn(inp.value)){ field?.classList.add('invalid'); if(err) err.textContent=msg; ok=false; }
    else field?.classList.remove('invalid');
  }
  return ok;
}

/* ── COMBO BUSCABLE (categoría / producto / proveedor) ──
   Reemplaza <select> planos: clic muestra todas las opciones, escribir
   filtra en vivo. Guarda el valor elegido en un <input type="hidden"> con
   el mismo id que antes tenía el <select>, así el resto del código (validar,
   $('#id').value, listeners de 'input') no cambia. */
document.addEventListener('click', e => {
  if (!e.target.closest('.combo')) $$('.combo-drop.open').forEach(d => d.classList.remove('open'));
});
function comboField(id, label, placeholder, opts = {}) {
  const { requerido = true, span = 'span2', disabled = false, actionLabel = '', actionHandler = '' } = opts;
  return `<div class="field ${span} combo-field" id="${id}-wrap">
    <label class="${actionLabel?'field-label-action':''}"><span>${esc(label)}${requerido ? ' <span class="req">*</span>' : ''}</span>${actionLabel?`<button type="button" onclick="${esc(actionHandler)}">${esc(actionLabel)}</button>`:''}</label>
    <div class="combo">
      <input type="text" id="${id}-q" placeholder="${esc(placeholder)}" autocomplete="off" ${disabled ? 'disabled' : ''}>
      <input type="hidden" id="${id}">
      <div class="combo-drop" id="${id}-drop"></div>
    </div>
    <span class="ferr"></span>
  </div>`;
}
function comboInit(id, opciones) {
  const q = document.getElementById(id + '-q'), hid = document.getElementById(id), drop = document.getElementById(id + '-drop');
  let lista = opciones || [];
  function pintar(filtro) {
    const f = (filtro || '').trim().toLowerCase();
    const vis = f ? lista.filter(o => o.label.toLowerCase().includes(f)) : lista;
    drop.innerHTML = vis.length
      ? vis.map(o => `<div class="combo-opt" data-v="${esc(String(o.value))}">${esc(o.label)}${o.sub ? `<span class="combo-opt-sub">${esc(o.sub)}</span>` : ''}</div>`).join('')
      : `<div class="combo-empty">Sin resultados</div>`;
    drop.classList.add('open');
  }
  function elegir(v) {
    const op = lista.find(o => String(o.value) === String(v));
    if (!op) return;
    hid.value = op.value; q.value = op.label; drop.classList.remove('open');
    Object.keys(hid.dataset).forEach(k => delete hid.dataset[k]);
    Object.entries(op.data || {}).forEach(([k, val]) => hid.dataset[k] = val);
    hid.dispatchEvent(new Event('input', { bubbles: true }));
  }
  q.addEventListener('focus', () => { if (!q.disabled) pintar(q.value); });
  q.addEventListener('input', () => {
    if (hid.value) { hid.value = ''; hid.dispatchEvent(new Event('input', { bubbles: true })); }
    pintar(q.value);
  });
  q.addEventListener('keydown', e => { if (e.key === 'Escape') drop.classList.remove('open'); });
  drop.addEventListener('click', e => { const o = e.target.closest('.combo-opt'); if (o) elegir(o.dataset.v); });
  hid._combo = {
    setOpciones(nuevas, placeholderVacio) {
      lista = nuevas || [];
      q.value = ''; hid.value = ''; drop.classList.remove('open'); drop.innerHTML = '';
      if (placeholderVacio) q.placeholder = placeholderVacio;
      q.disabled = !lista.length && !!placeholderVacio;
      hid.dispatchEvent(new Event('input', { bubbles: true }));
    },
    select(v){ elegir(v); }
  };
}

function quickCategoryPanel(prefix){
  return `<div class="field span2 quick-category" id="${prefix}-quick-cat" hidden>
    <div><strong>Nueva categoría sin salir del formulario</strong><span>Todos los datos que ya escribiste se conservan.</span></div>
    <div class="quick-category-row"><input id="${prefix}-quick-cat-name" maxlength="80" placeholder="Ej: Camisas"><input id="${prefix}-quick-cat-desc" maxlength="160" placeholder="Descripción breve"><button type="button" class="btn btn-outline" onclick="saveInlineCategory('${prefix}')">Crear categoría</button></div>
  </div>`;
}
function toggleInlineCategory(prefix){
  const panel=document.getElementById(prefix+'-quick-cat'); if(!panel) return;
  panel.hidden=!panel.hidden;
  if(!panel.hidden) setTimeout(()=>document.getElementById(prefix+'-quick-cat-name')?.focus(),40);
}
function saveInlineCategory(prefix){
  const nombre=(document.getElementById(prefix+'-quick-cat-name')?.value||'').trim();
  const descripcion=(document.getElementById(prefix+'-quick-cat-desc')?.value||'').trim();
  if(!nombre){ toast('Escribe el nombre de la categoría','warn'); document.getElementById(prefix+'-quick-cat-name')?.focus(); return; }
  let cat=DB.categorias.find(c=>c.nombre.toLowerCase()===nombre.toLowerCase()), creada=false;
  if(!cat){ creada=true; cat={id:nuevoId('categoria'),nombre,descripcion,estado:'activo'}; DB.categorias.push(cat); dbGuardar(); renderCategorias(); updateCatFilters(); }
  const hid=document.getElementById(prefix+'-cat');
  const opciones=DB.categorias.filter(c=>c.estado==='activo').map(c=>({value:c.id,label:c.nombre}));
  hid?._combo?.setOpciones(opciones);
  hid?._combo?.select(cat.id);
  document.getElementById(prefix+'-quick-cat').hidden=true;
  toast(creada?'Categoría creada y seleccionada':'Esa categoría ya existía; quedó seleccionada');
}
window.toggleInlineCategory=toggleInlineCategory; window.saveInlineCategory=saveInlineCategory;

/* ── NAVEGACIÓN ── */
const PAGE_TITLES = {
  dashboard:'Panel principal', productos:'Productos', categorias:'Categorías', galeria:'Galería',
  proveedores:'Proveedores', clientes:'Clientes', administradores:'Administradores', inventario:'Inventario', compras:'Compras',
  ventas:'Ventas', movimientos:'Movimientos', pedidos:'Pedidos',
  reportes:'Reportes', configuracion:'Configuración'
};

function goTo(page){
  $$('.page').forEach(p=>p.classList.remove('active'));
  $$('.sb-item').forEach(b=>b.classList.toggle('active', b.dataset.page===page));
  const el = document.getElementById('page-'+page);
  if(el) el.classList.add('active');
  $('#topbar-title').textContent = PAGE_TITLES[page]||page;
  closeSidebar();
  if(page==='dashboard')   renderDashboard();
  if(page==='movimientos') renderMovimientos();
  if(page==='pedidos')     renderPedidos();
  if(page==='galeria')     renderGaleriaAdmin();
  if(page==='inventario')  renderInventario();
  if(page==='reportes')    renderReporte();
  window.scrollTo({top:0});
}

function openSidebar(){ $('#sidebar').classList.add('open'); $('#mobile-veil').classList.add('show'); }
function closeSidebar(){ $('#sidebar').classList.remove('open'); $('#mobile-veil').classList.remove('show'); }

/* ── LOGIN ── */
async function submitLoginAdmin(){
  const email=($('#login-email')?.value||'').trim().toLowerCase();
  const pass=($('#login-pass')?.value||'').trim();
  const errEl=$('#login-error');
  if(!email||!pass){ if(errEl) errEl.textContent='Completa correo y contraseña.'; return; }
  const btn=$('#btn-login'); if(btn){ btn.disabled=true; btn.textContent='Ingresando…'; }
  try{
    const {token,user}=await apiPost('/api/auth/login',{email,password:pass,portal:'admin'});
    if(user.role!=='admin' && user.role!=='proveedor'){ throw new Error('Esta cuenta no tiene acceso al panel.'); }
    guardarSesionToken(token, user.role, user.nombre);
    if(errEl) errEl.textContent='';
    await iniciarPanelAdmin();
  }catch(e){
    if(errEl) errEl.textContent=e.message||'Correo o contraseña incorrectos.';
  }finally{
    if(btn){ btn.disabled=false; btn.textContent='Ingresar →'; }
  }
}

/* ── OLVIDÉ MI CONTRASEÑA ── */
function mostrarPanelLogin(){
  $('#login-panel-login').style.display='';
  $('#login-panel-olvide').style.display='none';
  $('#login-panel-reset').style.display='none';
}
function mostrarPanelOlvide(){
  $('#login-panel-login').style.display='none';
  $('#login-panel-olvide').style.display='';
  $('#login-panel-reset').style.display='none';
  const err=$('#olvide-error'); if(err) err.textContent='';
  const ok=$('#olvide-ok'); if(ok) ok.style.display='none';
}
function mostrarPanelReset(){
  $('#login-panel-login').style.display='none';
  $('#login-panel-olvide').style.display='none';
  $('#login-panel-reset').style.display='';
}

async function submitOlvide(){
  const correo=($('#olvide-email')?.value||'').trim().toLowerCase();
  const errEl=$('#olvide-error'); const okEl=$('#olvide-ok');
  if(errEl) errEl.textContent='';
  if(okEl) okEl.style.display='none';
  if(!correo){ if(errEl) errEl.textContent='Escribí tu correo.'; return; }
  const btn=$('#btn-olvide'); if(btn){ btn.disabled=true; btn.textContent='Enviando…'; }
  try{
    await apiPost('/api/auth/olvide',{correo});
    if(okEl){ okEl.textContent='Si ese correo tiene una cuenta, te llegará un enlace para elegir una nueva contraseña. Revisá también la carpeta de spam.'; okEl.style.display='block'; }
  }catch(e){
    if(errEl) errEl.textContent=e.message||'No se pudo enviar el enlace.';
  }finally{
    if(btn){ btn.disabled=false; btn.textContent='Enviar enlace'; }
  }
}

async function submitReset(){
  const pass=($('#reset-pass')?.value||'').trim();
  const pass2=($('#reset-pass2')?.value||'').trim();
  const errEl=$('#reset-error'); if(errEl) errEl.textContent='';
  if(!pass||pass.length<8){ if(errEl) errEl.textContent='La contraseña debe tener al menos 8 caracteres.'; return; }
  if(pass!==pass2){ if(errEl) errEl.textContent='Las contraseñas no coinciden.'; return; }
  const token=new URLSearchParams(location.search).get('reset');
  const btn=$('#btn-reset'); if(btn){ btn.disabled=true; btn.textContent='Guardando…'; }
  try{
    await apiPost('/api/auth/reset',{token,password:pass});
    history.replaceState({}, '', 'admin.html');
    mostrarPanelLogin();
    const errLogin=$('#login-error'); if(errLogin) errLogin.textContent='Contraseña actualizada — ya podés iniciar sesión.';
  }catch(e){
    if(errEl) errEl.textContent=e.message||'No se pudo actualizar la contraseña. Pedí un enlace nuevo.';
  }finally{
    if(btn){ btn.disabled=false; btn.textContent='Guardar contraseña'; }
  }
}

function cerrarSesionAdmin(){
  try{ localStorage.removeItem('bs_sesion_admin'); }catch(e){}
  limpiarSesionToken();
  // `reload()` puede reutilizar el documento/CSS que el navegador guardó y
  // mostrar el diseño anterior hasta que el usuario pulse F5. Una navegación
  // con versión única fuerza el login actual sin dejar una entrada obsoleta.
  const destino=new URL('admin.html',window.location.href);
  destino.searchParams.set('login','1');
  destino.searchParams.set('v',(window.SIWEPE_ADMIN_BUILD||'actual')+'-'+Date.now());
  window.location.replace(destino.href);
}
window.cerrarSesionAdmin=cerrarSesionAdmin;

/* ═══════════════════════════════════════════════
   DASHBOARD — CHARTS ENGINE
   ═══════════════════════════════════════════════ */

/* ── helpers de tiempo ── */
function mesesAtras(n){
  const meses=[]; const ahora=new Date();
  for(let i=n-1;i>=0;i--){
    const d=new Date(ahora.getFullYear(),ahora.getMonth()-i,1);
    meses.push({
      key:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,
      label:['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][d.getMonth()]
    });
  }
  return meses;
}

const ventaActiva=v=>v.estado!=='anulada';
function ventasMes(mesKey){ return DB.ventas.filter(v=>ventaActiva(v)&&v.fecha.startsWith(mesKey)).reduce((s,v)=>s+v.total,0); }
function comprasMes(mesKey){ return DB.compras.filter(c=>c.fecha.startsWith(mesKey)).reduce((s,c)=>s+c.cantidad*c.precio,0); }

function tendencia(actual,anterior){
  if(!anterior) return null;
  const pct=((actual-anterior)/anterior*100).toFixed(1);
  return {pct:+pct, label:(pct>0?'↑':'↓')+Math.abs(pct)+'%', up:+pct>=0};
}

/* ── CHART: Barras agrupadas (Ventas vs Compras) ── */
function renderChartBarras(meses){
  const el=document.getElementById('dash-chart-barras'); if(!el) return;
  const datos=meses.map(m=>({
    label:m.label,
    ventas:ventasMes(m.key),
    compras:comprasMes(m.key)
  }));
  const maxVal=Math.max(1,...datos.flatMap(d=>[d.ventas,d.compras]));

  /* Líneas de referencia */
  const pasos=4;
  const stepVal=maxVal/pasos;
  const yLines=Array.from({length:pasos+1},(_,i)=>({v:Math.round(stepVal*i),pct:(i/pasos*100).toFixed(1)}));

  el.innerHTML=`
  <div class="barchart-wrap">
    <div class="barchart-yaxis">
      ${[...yLines].reverse().map(y=>`<span>${y.v>=1000?Math.round(y.v/100)/10+'k':y.v}</span>`).join('')}
    </div>
    <div class="barchart-area">
      <div class="barchart-grid">
        ${yLines.map(y=>`<div class="barchart-gridline" style="bottom:${y.pct}%"></div>`).join('')}
      </div>
      <div class="barchart-cols">
        ${datos.map(d=>{
          const pV=((d.ventas/maxVal)*100).toFixed(1);
          const pC=((d.compras/maxVal)*100).toFixed(1);
          return `<div class="bcol">
            <div class="bcol-bars">
              <div class="bcol-bar-wrap" title="Ventas: ${dinero(d.ventas)}">
                <div class="bcol-bar bar-ventas" data-h="${pV}"></div>
              </div>
              <div class="bcol-bar-wrap" title="Compras: ${dinero(d.compras)}">
                <div class="bcol-bar bar-compras" data-h="${pC}"></div>
              </div>
            </div>
            <div class="bcol-label">${d.label}</div>
          </div>`;
        }).join('')}
      </div>
    </div>
  </div>`;

  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    el.querySelectorAll('.bcol-bar').forEach(b=>b.style.height=b.dataset.h+'%');
  }));
}

/* ── CHART: Dona (ventas por categoría) ── */
function renderChartDonut(meses){
  const svg=document.getElementById('dash-donut-svg');
  const leg=document.getElementById('dash-donut-legend');
  if(!svg||!leg) return;

  /* Calcular ventas por categoría en el período */
  const mesKeys=new Set(meses.map(m=>m.key));
  const ventasPeriodo=DB.ventas.filter(v=>ventaActiva(v)&&mesKeys.has(v.fecha.slice(0,7)));
  const porCat={};
  ventasPeriodo.forEach(v=>{
    const p=prodPor(v.producto_id); if(!p) return;
    const cat=catPor(p.categoria_id); if(!cat) return;
    porCat[cat.nombre]=(porCat[cat.nombre]||0)+v.total;
  });

  const entries=Object.entries(porCat).sort((a,b)=>b[1]-a[1]);
  const total=entries.reduce((s,[,v])=>s+v,0)||1;
  const COLORS=['#6B7280','#8A8F98','#9AA1AC','#7C8390','#B0B6BE','#545B66'];

  if(!entries.length){
    svg.innerHTML=`<circle cx="100" cy="100" r="70" fill="none" stroke="#F1E6EB" stroke-width="28"/>
    <text x="100" y="106" text-anchor="middle" font-size="12" fill="#AD9BA2">Sin datos</text>`;
    leg.innerHTML=''; return;
  }

  /* Construir arcos SVG */
  const cx=100,cy=100,r=70,sw=28;
  let cumPct=0;
  const arcs=entries.map(([nombre,val],i)=>{
    const pct=val/total;
    const startAngle=cumPct*2*Math.PI-Math.PI/2;
    const endAngle=(cumPct+pct)*2*Math.PI-Math.PI/2;
    cumPct+=pct;
    const x1=cx+r*Math.cos(startAngle),y1=cy+r*Math.sin(startAngle);
    const x2=cx+r*Math.cos(endAngle),  y2=cy+r*Math.sin(endAngle);
    const large=pct>0.5?1:0;
    const gap=0.010*2*Math.PI;
    const startG=startAngle+gap, endG=endAngle-gap;
    const x1g=cx+r*Math.cos(startG),y1g=cy+r*Math.sin(startG);
    const x2g=cx+r*Math.cos(endG),  y2g=cy+r*Math.sin(endG);
    const lg=pct>0.5?1:0;
    return {nombre,val,pct,color:COLORS[i%COLORS.length],
      path:`M ${x1g} ${y1g} A ${r} ${r} 0 ${lg} 1 ${x2g} ${y2g}`};
  });

  const totalLabel=total>=1000?Math.round(total/100)/10+'k':Math.round(total);
  svg.innerHTML=`
    <circle cx="100" cy="100" r="70" fill="none" stroke="#EDEFF2" stroke-width="24"/>
    ${arcs.map(a=>`<path d="${a.path}" fill="none" stroke="${a.color}" stroke-width="24" stroke-linecap="butt"/>`).join('')}
    <text x="100" y="94" text-anchor="middle" font-size="11" fill="#AD9BA2" font-family="Inter,sans-serif">Total</text>
    <text x="100" y="114" text-anchor="middle" font-size="18" font-weight="800" fill="#3A2F33" font-family="Inter,sans-serif">${DB.config.moneda} ${totalLabel}</text>`;

  leg.innerHTML=arcs.map(a=>`
    <div class="donut-leg-row">
      <span class="donut-leg-dot" style="background:${a.color}"></span>
      <span class="donut-leg-name">${esc(a.nombre)}</span>
      <span class="donut-leg-val">${Math.round(a.pct*100)}%</span>
    </div>`).join('');
}

/* ── CHART: Línea ingresos acumulados ── */
function renderChartLinea(meses){
  const svg=document.getElementById('dash-linea-svg'); if(!svg) return;
  const datos=meses.map(m=>({label:m.label,v:ventasMes(m.key)}));
  /* Acumular */
  let acc=0; const acum=datos.map(d=>({label:d.label,v:acc+=d.v}));

  const W=svg.clientWidth||600, H=160;
  const pad={t:14,r:20,b:28,l:54};
  const cW=W-pad.l-pad.r, cH=H-pad.t-pad.b;
  const maxV=Math.max(1,...acum.map(d=>d.v));
  const n=acum.length;

  const xPos=i=>pad.l+i/(n-1||1)*cW;
  const yPos=v=>pad.t+cH-(v/maxV)*cH;

  /* Pasos Y */
  const ySteps=4;
  const yGridLines=Array.from({length:ySteps+1},(_,i)=>({
    v:Math.round(maxV/ySteps*i),
    y:yPos(maxV/ySteps*i)
  }));

  /* Construir path */
  const pts=acum.map((d,i)=>`${xPos(i)},${yPos(d.v)}`);
  const linePath='M '+pts.join(' L ');
  const areaPath=`M ${xPos(0)},${yPos(0)} L ${pts.join(' L ')} L ${xPos(n-1)},${yPos(0)} Z`;

  /* Color accent desde CSS variable */
  const accent=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()||'#6B7280';

  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  svg.innerHTML=`
    <defs>
      <linearGradient id="lineaGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${accent}" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <!-- Grid lines -->
    ${yGridLines.map(y=>`
      <line x1="${pad.l}" y1="${y.y}" x2="${W-pad.r}" y2="${y.y}" stroke="#F1E6EB" stroke-width="1"/>
      <text x="${pad.l-8}" y="${y.y+4}" text-anchor="end" font-size="9.5" fill="#AD9BA2" font-family="Inter,sans-serif">${y.v>=1000?Math.round(y.v/100)/10+'k':y.v}</text>
    `).join('')}
    <!-- Área rellena -->
    <path d="${areaPath}" fill="url(#lineaGrad)"/>
    <!-- Línea principal -->
    <path d="${linePath}" fill="none" stroke="${accent}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    <!-- Puntos y labels -->
    ${acum.map((d,i)=>`
      <circle cx="${xPos(i)}" cy="${yPos(d.v)}" r="3.5" fill="${accent}" stroke="white" stroke-width="1.8"/>
      <text x="${xPos(i)}" y="${H-8}" text-anchor="middle" font-size="10" fill="#7C6A70" font-family="Inter,sans-serif">${d.label}</text>
    `).join('')}
  `;
}

/* ── TOP 5 PRODUCTOS (barras horizontales) ── */
function renderTopProductos(meses){
  const el=document.getElementById('dash-top-prods'); if(!el) return;
  const mesKeys=new Set(meses.map(m=>m.key));
  const ventasPer=DB.ventas.filter(v=>ventaActiva(v)&&mesKeys.has(v.fecha.slice(0,7)));

  const porProd={};
  ventasPer.forEach(v=>{
    porProd[v.producto_id]=(porProd[v.producto_id]||{uds:0,ingresos:0});
    porProd[v.producto_id].uds+=v.cantidad;
    porProd[v.producto_id].ingresos+=v.total;
  });

  const top=Object.entries(porProd)
    .map(([id,d])=>({p:prodPor(+id),...d}))
    .filter(x=>x.p)
    .sort((a,b)=>b.uds-a.uds)
    .slice(0,6);

  if(!top.length){ el.innerHTML=`<div style="color:var(--text-muted);text-align:center;padding:24px;font-size:13px;font-style:italic">Sin ventas en el período</div>`; return; }

  const maxUds=Math.max(1,...top.map(x=>x.uds));
  const MEDAL=['1','2','3'];
  el.innerHTML=top.map((x,i)=>`
    <div class="top-prod-row">
      <div class="top-prod-pos">${MEDAL[i]||`${i+1}`}</div>
      <div class="top-prod-info">
        <div class="top-prod-name">${esc(x.p.nombre)}</div>
        <div class="top-prod-track">
          <div class="top-prod-fill" data-w="${(x.uds/maxUds*100).toFixed(1)}"
            style="background:${['var(--accent)','var(--accent-mid)','var(--ok)','var(--warn)','var(--error)','var(--text-muted)'][i]}">
          </div>
        </div>
      </div>
      <div class="top-prod-vals">
        <strong>${x.uds} uds</strong>
        <small>${dinero(x.ingresos)}</small>
      </div>
    </div>`).join('');

  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    el.querySelectorAll('.top-prod-fill').forEach(b=>b.style.width=b.dataset.w+'%');
  }));
}

/* ── DASHBOARD PRINCIPAL ── */
function renderDashboard(){
  const hoyStr = hoy();
  const mesStr = mesActual();
  const periodoN = +($('#dash-periodo')?.value||6);
  const meses = mesesAtras(periodoN);
  const mesActualKey = meses[meses.length-1].key;
  const mesAnteriorKey = meses.length>=2 ? meses[meses.length-2].key : null;

  /* KPIs */
  const ventasHoy   = DB.ventas.filter(v=>ventaActiva(v)&&v.fecha===hoyStr).reduce((s,v)=>s+v.total,0);
  const ingMes      = ventasMes(mesActualKey);
  const ingMesAnt   = mesAnteriorKey ? ventasMes(mesAnteriorKey) : 0;
  const bajo        = DB.productos.filter(p=>p.estado==='activo'&&p.stock<=p.stock_min).length;
  const agotados    = DB.productos.filter(p=>p.estado==='activo'&&p.stock<=0).length;
  const pendientes  = DB.pedidos.filter(p=>p.estado==='pendiente').length;
  const totalProd   = DB.productos.filter(p=>p.estado==='activo').length;
  const valorInv    = DB.productos.filter(p=>p.estado==='activo').reduce((s,p)=>s+p.stock*p.precio_compra,0);

  $('#kpi-ventas-hoy').textContent   = dinero(ventasHoy);
  $('#kpi-ingresos-mes').textContent = dinero(ingMes);
  $('#kpi-bajo-stock').textContent   = bajo;
  $('#kpi-pedidos-pend').textContent = pendientes;
  $('#kpi-productos').textContent    = totalProd;

  /* Subinfo KPIs */
  const subEl=document.getElementById('kpi-stock-sub');
  if(subEl) subEl.textContent=agotados>0?agotados+' agotado(s)':'Ninguno agotado';

  const valorEl=document.getElementById('kpi-valor-trend');
  if(valorEl){ valorEl.textContent='Inventario: '+dinero(valorInv); valorEl.style.color='var(--text-muted)'; valorEl.style.fontSize='11.5px'; }

  /* Tendencia ingresos */
  const tIng=tendencia(ingMes,ingMesAnt);
  const tEl=document.getElementById('kpi-ingresos-trend');
  if(tEl&&tIng){ tEl.textContent=tIng.label+' vs mes ant.'; tEl.className='kpi-trend '+(tIng.up?'trend-up':'trend-down'); }

  /* Período label */
  const plEl=document.getElementById('dash-periodo-label');
  if(plEl) plEl.textContent=meses[0].label+' – '+meses[meses.length-1].label;

  /* CHARTS */
  renderChartBarras(meses);
  renderChartDonut(meses);
  renderTopProductos(meses);

  /* Línea — pequeño delay para que el SVG tenga clientWidth */
  requestAnimationFrame(()=>renderChartLinea(meses));

  /* Últimos movimientos */
  const movs=[...DB.movimientos].sort((a,b)=>b.id-a.id).slice(0,7);
  $('#dash-movs').innerHTML=movs.map(m=>{
    const p=prodPor(m.producto_id);
    return `<div class="mov-row">
      <span class="mov-dot ${m.tipo==='entrada'?'mov-in':'mov-out'}">${svgIcon(m.tipo==='entrada'?'entrada':'salida',13)}</span>
      <div class="mov-info"><strong>${esc(p?p.nombre:'(eliminado)')}</strong><small>${fechaCorta(m.fecha)} · ${esc(m.obs||m.tipo)}</small></div>
      <span class="mov-qty ${m.tipo==='entrada'?'pos':'neg'}">${m.tipo==='entrada'?'+':'−'}${m.cantidad}</span>
    </div>`;
  }).join('')||'<div style="color:var(--text-muted);text-align:center;padding:24px;font-size:13px">Sin movimientos</div>';

  /* Pedidos recientes */
  const ultPed=[...DB.pedidos].sort((a,b)=>b.id-a.id).slice(0,4);
  $('#dash-pedidos').innerHTML=ultPed.map(p=>{
    const c=cliPor(p.cliente_id);
    const bc=p.estado==='pendiente'?'b-warn':p.estado==='aprobado'?'b-ok':p.estado==='entregado'?'b-blue':'b-muted';
    return `<div class="ped-row" onclick="goTo('pedidos')" style="cursor:pointer">
      <div class="ped-row-info"><strong>${esc(c?c.nombre:'Cliente')}</strong><small>${fechaCorta(p.fecha)} · ${p.items.length} producto${p.items.length!==1?'s':''}</small></div>
      <div class="ped-row-right"><span class="badge ${bc}">${p.estado}</span><strong>${dinero(p.total)}</strong></div>
    </div>`;
  }).join('')||'<div style="color:var(--text-muted);text-align:center;padding:24px;font-size:13px">Sin pedidos</div>';

  /* Stock bajo */
  const bajos=DB.productos.filter(p=>p.estado==='activo'&&p.stock<=p.stock_min);
  $('#dash-bajo-stock').innerHTML=bajos.slice(0,6).map(p=>`
    <div class="mov-row">
      <div class="mov-info"><strong>${esc(p.nombre)}</strong><small>${esc(p.codigo)}</small></div>
      <span class="badge ${p.stock<=0?'b-error':'b-warn'}">${p.stock<=0?'Agotado':p.stock+' uds'}</span>
    </div>`).join('')||'<div style="color:var(--text-muted);text-align:center;padding:24px;font-size:13px"> Todo en orden</div>';
}

/* ── PRODUCTOS ── */
function renderProductos(){
  const q   = ($('#filtro-prod-q')?.value||'').trim().toLowerCase();
  const cat = $('#filtro-prod-cat')?.value||'';
  const est = $('#filtro-prod-est')?.value||'';
  let lista = DB.productos.filter(p=>
    (!q || p.nombre.toLowerCase().includes(q)||p.codigo.toLowerCase().includes(q))&&
    (!cat||p.categoria_id===+cat)&&(!est||p.estado===est));

  const el = $('#prod-grid');
  if(!lista.length){ el.innerHTML=`<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text-muted)"><em style="font-family:'Fraunces',serif;font-size:18px;font-style:italic">Sin resultados</em></div>`; return; }

  el.innerHTML = lista.map(p=>{
    const c=catPor(p.categoria_id);
    const {bg,color}=prodGrad(p.nombre);
    const margen=p.precio_compra>0?Math.round(((p.precio_venta-p.precio_compra)/p.precio_compra)*100):0;
    const stClass=p.stock<=0?'error':p.stock<=p.stock_min?'warn':'ok';
    const stLabel=`${p.stock||0} tienda · ${p.stock_inventario||0} inventario`;
    const fotos=(Array.isArray(p.imagenes)?p.imagenes:[]).filter(Boolean);
    const portada=p.imagen||fotos[0]||'';
    return `
    <div class="prod-card-admin ${p.estado==='inactivo'?'pca-inactivo':''}">
      <div class="pca-img">
        ${portada?`<img src="${portada}" alt="${esc(p.nombre)}" data-ph="card" data-l="${p.nombre[0].toUpperCase()}" data-bg="${bg}" data-col="${color}" onerror="imgFb(this)">`:`<div class="pca-placeholder" style="background:${bg}"><span style="color:${color}">${p.nombre[0].toUpperCase()}</span></div>`}
        ${fotos.length>1?`<div class="pca-photo-count">${svgIcon('caja',12)} ${fotos.length} fotos</div>`:''}
        ${p.stock<=0?`<div class="pca-badge agotado">Agotado</div>`:p.stock<=p.stock_min?`<div class="pca-badge bajo">Bajo</div>`:''}
        <div class="pca-actions">
          <button class="pca-btn" onclick="openFormProducto(${p.id})">${svgIcon('lapiz',13)} Editar</button>
          <button class="pca-btn del" onclick="deleteProducto(${p.id})">${svgIcon('basura',13)} Eliminar</button>
        </div>
      </div>
      <div class="pca-body">
        <div class="pca-cat">${esc(c?c.nombre:'')}</div>
        <div class="pca-nombre">${esc(p.nombre)}</div>
        <div class="pca-precios">
          <span class="pca-pventa">${dinero(p.precio_venta)}</span>
          <span class="pca-pcompra">Costo: ${dinero(p.precio_compra)}</span>
        </div>
        <div class="pca-footer">
          <span class="pca-stock ${stClass}">${stLabel}</span>
          <span class="pca-margen">+${margen}% margen</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

const TIPOS_PIEL=['Grasa','Seca','Mixta','Sensible','Normal'];

/* Código de producto AUTOMÁTICO: PROD-0001, PROD-0002, … (por empresa). */
function siguienteCodigoProducto(){
  let max=0;
  (DB.productos||[]).forEach(p=>{ const m=/^PROD-(\d+)$/i.exec(p.codigo||''); if(m){ const n=+m[1]; if(n>max) max=n; } });
  return 'PROD-'+String(max+1).padStart(4,'0');
}

/* Borrador del formulario de producto: guarda lo escrito en el navegador para
   que NO se pierda si el form se cierra por accidente. Se limpia al guardar. */
function _draftKeyProd(){ return 'bs_draft_prod_'+((DB.config&&DB.config.nombre)||''); }
function guardarBorradorProd(){
  const g=id=>{ const el=document.getElementById(id); return el?el.value:''; };
  const d={nombre:g('fp-nombre'),cat:g('fp-cat'),estado:g('fp-estado'),desc:g('fp-desc'),
    pcompra:g('fp-pcompra'),pventa:g('fp-pventa'),stock:g('fp-stock'),stockInventario:g('fp-stock-inv'),stockmin:g('fp-stockmin'),
    destacado:g('fp-destacado'),marca:g('fp-marca')};
  const hayAlgo=d.nombre||d.desc||d.pcompra||d.pventa||d.marca||d.cat;
  try{ if(hayAlgo) localStorage.setItem(_draftKeyProd(),JSON.stringify(d)); else localStorage.removeItem(_draftKeyProd()); }catch(e){}
}
function leerBorradorProd(){ try{ return JSON.parse(localStorage.getItem(_draftKeyProd())||'null'); }catch(e){ return null; } }
function limpiarBorradorProd(){ try{ localStorage.removeItem(_draftKeyProd()); }catch(e){} }

function openFormProducto(id=null){
  const p=id?prodPor(id):null;
  const totalExistencias=p?(+p.stock||0)+(+p.stock_inventario||0):0;
  let imgsActuales=[...(p&&Array.isArray(p.imagenes)?p.imagenes:[])].filter(Boolean);
  if(p&&p.imagen&&!imgsActuales.includes(p.imagen)) imgsActuales.unshift(p.imagen);
  const codigoVal=p?p.codigo:siguienteCodigoProducto();
  const cats=DB.categorias.filter(c=>c.estado==='activo').map(c=>`<option value="${c.id}" ${p&&p.categoria_id===c.id?'selected':''}>${esc(c.nombre)}</option>`).join('');
  openModal(p?'Editar producto':'Nuevo producto',p?`Código: ${p.codigo}`:'Completa los datos del producto',`
    <div class="form-grid">
      <div class="field"><label>Código <span style="font-weight:400;color:var(--text-muted)">(automático)</span></label><input id="fp-codigo" value="${esc(codigoVal)}" readonly style="background:var(--surface-2);color:var(--text-secondary);cursor:not-allowed"></div>
      <div class="field"><label>Nombre <span class="req">*</span></label><input id="fp-nombre" value="${p?esc(p.nombre):''}" placeholder="Ej: nombre del producto" maxlength="120"><span class="ferr"></span></div>
      <div class="field"><label class="field-label-action"><span>Categoría <span class="req">*</span></span><button type="button" onclick="toggleQuickCategory()">+ Crear aquí</button></label><select id="fp-cat"><option value="">Selecciona…</option>${cats}</select><span class="ferr"></span></div>
      <div class="field span2 quick-category" id="fp-quick-cat" hidden><div><strong>Nueva categoría sin salir del producto</strong><span>Lo que ya escribiste se conserva.</span></div><div class="quick-category-row"><input id="fp-quick-cat-name" maxlength="80" placeholder="Ej: Camisas"><input id="fp-quick-cat-desc" maxlength="160" placeholder="Descripción breve"><button type="button" class="btn btn-outline" onclick="saveQuickCategory()">Crear categoría</button></div></div>
      <div class="field"><label>Estado</label><select id="fp-estado"><option value="activo" ${p&&p.estado==='activo'?'selected':''}>Activo</option><option value="inactivo" ${!p||p.estado==='inactivo'?'selected':''}>Inactivo</option></select></div>
      <div class="field span2"><label>Descripción</label><textarea id="fp-desc" placeholder="Describe el producto…" rows="2" maxlength="1000">${p?esc(p.descripcion||''):''}</textarea></div>
      <div class="field"><label>Precio de compra <span class="req">*</span></label><input id="fp-pcompra" type="number" min="0" step="0.01" value="${p?p.precio_compra:''}"><span class="ferr"></span></div>
      <div class="field"><label>Precio de venta <span class="req">*</span></label><input id="fp-pventa" type="number" min="0" step="0.01" value="${p?p.precio_venta:''}"><span class="ferr"></span></div>
      <div class="field"><label>Publicado en tienda</label><input id="fp-stock" type="number" min="0" max="${totalExistencias}" step="1" value="${p?p.stock:'0'}" ${p?'':'readonly'}><small>${p?`Puedes publicar hasta ${totalExistencias} unidades; se descuentan del inventario.`:'Primero registra una entrada en Inventario.'}</small><span class="ferr"></span></div>
      <div class="field"><label>Disponible en inventario</label><input id="fp-stock-inv" type="number" min="0" step="1" value="${p?p.stock_inventario||0:'0'}" readonly><small>Se actualiza automáticamente sin alterar el total.</small></div>
      <div class="field"><label>Stock mínimo <span class="req">*</span></label><input id="fp-stockmin" type="number" min="0" step="1" value="${p?p.stock_min:'5'}"><span class="ferr"></span></div>
      <div class="field span2"><label>Galería del producto <span style="font-weight:400;color:var(--text-muted)">(hasta 6 fotos · 6 MB cada una; la primera será portada)</span></label>
        <div class="fp-images-grid" id="fp-images-grid"></div>
        <label class="fp-image-upload">${svgIcon('mas',16)} Agregar fotografías<input type="file" id="fp-img" accept="image/*,.heic,.heif" multiple hidden></label>
      </div>
      <div class="field"><label>¿Destacado en tienda?</label><select id="fp-destacado"><option value="1" ${p&&p.destacado?'selected':''}>Sí</option><option value="0" ${!p||!p.destacado?'selected':''}>No</option></select></div>
      <div class="field"><label>Marca <span style="font-weight:400;color:var(--text-muted)">(opcional)</span></label><input id="fp-marca" value="${p?esc(p.marca||''):''}" placeholder="Ej: marca del producto" maxlength="80"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-primary" onclick="saveProducto(${id||'null'})">${svgIcon('check',14)} Guardar</button>
    </div>`);
  const renderFpImgs=()=>{
    const grid=$('#fp-images-grid'); if(!grid) return;
    grid.innerHTML=imgsActuales.map((src,i)=>`<div class="fp-image-item ${i===0?'is-cover':''}"><img src="${src}" alt="Foto ${i+1}">${i===0?'<span>Portada</span>':''}<button type="button" onclick="quitarFpImg(${i})" title="Quitar">×</button></div>`).join('')||'<div class="fp-images-empty">Agrega varias vistas para que el cliente conozca mejor el producto.</div>';
  };
  window.quitarFpImg=i=>{ imgsActuales.splice(i,1); renderFpImgs(); };
  renderFpImgs();
  $('#fp-img').addEventListener('change',e=>{
    const files=[...e.target.files]; e.target.value=''; if(!files.length) return;
    if(imgsActuales.length+files.length>6){ toast('Cada producto admite hasta 6 fotografías','warn'); return; }
    toast('Procesando fotografías…');
    Promise.all(files.map(f=>comprimirImagen(f,1200,0.82))).then(dataUrls=>{
      imgsActuales.push(...dataUrls); renderFpImgs(); toast(`${dataUrls.length} foto${dataUrls.length!==1?'s':''} lista${dataUrls.length!==1?'s':''}`);
    }).catch(err=>toast(errImagen(err),'error'));
  });
  window.__fpImgs=()=>imgsActuales;
  precioVacioEnCero('fp-pcompra'); precioVacioEnCero('fp-pventa');
  if(p){
    const sincronizarStock=()=>{
      const publicadoRaw=$('#fp-stock').value.trim();
      if(publicadoRaw===''||!/^[0-9]+$/.test(publicadoRaw)) return;
      const publicado=Number(publicadoRaw);
      const field=$('#fp-stock').closest('.field'), err=field.querySelector('.ferr');
      if(publicado>totalExistencias){ field.classList.add('invalid'); err.textContent=`Solo hay ${totalExistencias} unidades en total`; return; }
      field.classList.remove('invalid'); err.textContent='';
      $('#fp-stock-inv').value=totalExistencias-publicado;
    };
    $('#fp-stock').addEventListener('input',sincronizarStock);
    $('#fp-stock').addEventListener('blur',()=>{ if($('#fp-stock').value.trim()===''){ $('#fp-stock').value='0'; sincronizarStock(); } });
  }

  // ── Borrador (sólo para producto NUEVO): restaurar y auto-guardar ──
  if(!p){
    const b=leerBorradorProd();
    if(b){
      const set=(fid,v)=>{ const el=document.getElementById(fid); if(el&&v!=null&&v!=='') el.value=v; };
      set('fp-nombre',b.nombre); set('fp-cat',b.cat); set('fp-estado',b.estado); set('fp-desc',b.desc);
      set('fp-pcompra',b.pcompra); set('fp-pventa',b.pventa); set('fp-stock',b.stock); set('fp-stock-inv',b.stockInventario); set('fp-stockmin',b.stockmin);
      set('fp-destacado',b.destacado); set('fp-marca',b.marca);
      toast('Recuperé lo que habías escrito');
    }
    ['fp-nombre','fp-cat','fp-estado','fp-desc','fp-pcompra','fp-pventa','fp-stockmin','fp-destacado','fp-marca'].forEach(fid=>{
      const el=document.getElementById(fid);
      if(el){ el.addEventListener('input',guardarBorradorProd); el.addEventListener('change',guardarBorradorProd); }
    });
  }
}

function saveProducto(id){
  const p=id?prodPor(id):null;
  const totalExistencias=p?(+p.stock||0)+(+p.stock_inventario||0):0;
  const stockVal=+($('#fp-stock').value||0);
  const ok=validar([['fp-nombre',noVacio,'Escribe el nombre'],['fp-cat',noVacio,'Elige una categoría'],['fp-pcompra',numVacioCero,'Precio inválido'],['fp-pventa',numVacioCero,'Precio inválido'],['fp-stock',v=>/^\d+$/.test(v)&&Number(v)<=totalExistencias,`Máximo ${totalExistencias} unidades`],['fp-stockmin',v=>/^\d+$/.test(v),'Cantidad inválida']]);
  if(!ok) return;
  const cod=($('#fp-codigo').value||'').trim().toUpperCase();  // generado automáticamente
  const imagenes=window.__fpImgs?window.__fpImgs().filter(Boolean).slice(0,6):[];
  const datos={codigo:cod,nombre:$('#fp-nombre').value.trim(),categoria_id:+$('#fp-cat').value,descripcion:$('#fp-desc').value.trim(),precio_compra:+($('#fp-pcompra').value||0),precio_venta:+($('#fp-pventa').value||0),stock:stockVal,stock_inventario:+($('#fp-stock-inv')?.value||0),stock_min:+$('#fp-stockmin').value,imagen:imagenes[0]||'',imagenes,estado:$('#fp-estado').value,destacado:$('#fp-destacado').value==='1',publicado_alguna_vez:p?(!!p.publicado_alguna_vez||stockVal>0):false,marca:$('#fp-marca').value.trim(),tipoPiel:[]};
  if(id){
    const anteriorPublicado=+p.stock||0, diferencia=stockVal-anteriorPublicado;
    Object.assign(prodPor(id),datos);
    if(diferencia!==0) DB.movimientos.push({id:nuevoId('movimiento'),tipo:'ajuste',signo:diferencia>0?'+':'-',producto_id:id,cantidad:Math.abs(diferencia),fecha:hoy(),usuario:'Admin',obs:diferencia>0?'Inventario → tienda · edición de producto':'Tienda → inventario · edición de producto'});
    toast(diferencia===0?'Producto actualizado':`Producto actualizado · ${Math.abs(diferencia)} unidad${Math.abs(diferencia)!==1?'es':''} ${diferencia>0?'publicada'+(Math.abs(diferencia)!==1?'s':''):'devuelta'+(Math.abs(diferencia)!==1?'s':'')} al ${diferencia>0?'catálogo':'inventario'}`);
  }
  else{ DB.productos.push({id:nuevoId('producto'),...datos}); limpiarBorradorProd(); toast('Producto creado'); }
  dbGuardar(); closeModal(); renderProductos(); renderDashboard();
}

function toggleQuickCategory(){
  const panel=$('#fp-quick-cat'); if(!panel) return;
  panel.hidden=!panel.hidden;
  if(!panel.hidden) setTimeout(()=>$('#fp-quick-cat-name')?.focus(),50);
}
function saveQuickCategory(){
  const nombre=($('#fp-quick-cat-name')?.value||'').trim(), descripcion=($('#fp-quick-cat-desc')?.value||'').trim();
  if(!nombre){ toast('Escribe el nombre de la categoría','warn'); $('#fp-quick-cat-name')?.focus(); return; }
  const repetida=DB.categorias.find(c=>c.nombre.toLowerCase()===nombre.toLowerCase());
  if(repetida){ $('#fp-cat').value=repetida.id; $('#fp-quick-cat').hidden=true; toast('Esa categoría ya existía; quedó seleccionada'); return; }
  const cat={id:nuevoId('categoria'),nombre,descripcion,estado:'activo'};
  DB.categorias.push(cat); dbGuardar();
  const sel=$('#fp-cat'); sel.insertAdjacentHTML('beforeend',`<option value="${cat.id}">${esc(cat.nombre)}</option>`); sel.value=cat.id;
  $('#fp-quick-cat').hidden=true; updateCatFilters(); renderCategorias(); toast('Categoría creada y seleccionada');
}
window.toggleQuickCategory=toggleQuickCategory; window.saveQuickCategory=saveQuickCategory;

function deleteProducto(id){
  const p=prodPor(id);
  if(p.estado==='inactivo'){
    openConfirm(`"${p.nombre}" ya está inactivo. ¿Reactivarlo?`,()=>{
      p.estado='activo'; dbGuardar(); renderProductos(); renderDashboard(); toast('Producto reactivado');
    });
    return;
  }
  openConfirm(`Se inactivará "${p.nombre}". Dejará de verse en la tienda pero se conserva su historial de ventas. Podrás reactivarlo cuando quieras.`,()=>{
    p.estado='inactivo'; dbGuardar(); renderProductos(); renderDashboard(); toast('Producto inactivado');
  });
}

/* ── CATEGORÍAS ── */
function renderCategorias(){
  const el=$('#tabla-categorias');
  el.innerHTML=DB.categorias.map(c=>{
    const n=DB.productos.filter(p=>p.categoria_id===c.id).length;
    return `<tr>
      <td><strong>${esc(c.nombre)}</strong></td>
      <td style="color:var(--text-secondary)">${esc(c.descripcion)||'—'}</td>
      <td><span class="badge b-blue">${n} producto${n!==1?'s':''}</span></td>
      <td>${c.estado==='activo'?`<span class="badge b-ok">Activo</span>`:`<span class="badge b-muted">Inactivo</span>`}</td>
      <td class="td-actions"><div class="td-actions-wrap">
        <button class="btn-icon" onclick="openFormCat(${c.id})">${svgIcon('lapiz')}</button>
        <button class="btn-icon danger" onclick="deleteCat(${c.id})">${svgIcon('basura')}</button>
      </div></td>
    </tr>`;
  }).join('')||`<tr class="empty-row"><td colspan="5"><em>Sin categorías</em></td></tr>`;
}

function openFormCat(id=null){
  const c=id?catPor(id):null;
  openModal(c?'Editar categoría':'Nueva categoría','',`
    <div class="field" style="margin-bottom:14px"><label>Nombre <span class="req">*</span></label><input id="fcat-nombre" value="${c?esc(c.nombre):''}" placeholder="Nombre de la categoría" maxlength="80"><span class="ferr"></span></div>
    <div class="field" style="margin-bottom:14px"><label>Descripción</label><textarea id="fcat-desc" rows="2" maxlength="255">${c?esc(c.descripcion||''):''}</textarea></div>
    <div class="field" style="margin-bottom:20px"><label>Estado</label><select id="fcat-estado"><option value="activo" ${!c||c.estado==='activo'?'selected':''}>Activo</option><option value="inactivo" ${c&&c.estado==='inactivo'?'selected':''}>Inactivo</option></select></div>
    <div class="modal-footer">
      <button class="btn btn-primary" onclick="saveCat(${id||'null'})">${svgIcon('check',14)} Guardar</button>
    </div>`,'480px');
}

function saveCat(id){
  if(!validar([['fcat-nombre',noVacio,'Escribe el nombre']])) return;
  const datos={nombre:$('#fcat-nombre').value.trim(),descripcion:$('#fcat-desc').value.trim(),estado:$('#fcat-estado').value};
  if(id){ Object.assign(catPor(id),datos); toast('Categoría actualizada'); }
  else{ DB.categorias.push({id:nuevoId('categoria'),...datos}); toast('Categoría creada'); }
  dbGuardar(); closeModal(); renderCategorias(); updateCatFilters();
}

function deleteCat(id){
  const usados=DB.productos.filter(p=>p.categoria_id===id).length;
  if(usados>0){ toast(`No se puede eliminar: ${usados} producto(s) la usan`,'warn'); return; }
  const c=catPor(id);
  openConfirm(`Se eliminará la categoría "${c.nombre}".`,()=>{ DB.categorias=DB.categorias.filter(x=>x.id!==id); dbGuardar(); renderCategorias(); updateCatFilters(); toast('Categoría eliminada'); });
}

function updateCatFilters(){
  const opts=DB.categorias.map(c=>`<option value="${c.id}">${esc(c.nombre)}</option>`).join('');
  $$('.cat-filter-sel').forEach(sel=>{ const v=sel.value; sel.innerHTML=`<option value="">Todas las categorías</option>${opts}`; sel.value=v; });
}

/* ── PROVEEDORES ── */
let provVista='todos';
function setProveedorView(vista){
  provVista=['todos','registrado','no_registrado'].includes(vista)?vista:'todos';
  $$('.provider-view-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.provView===provVista));
  renderProveedores();
}
/* ── ADMINISTRADORES ──
   A diferencia del resto de secciones, esta NO vive en DB (el estado
   completo /api/state nunca incluye password_hash ni la lista de usuarios
   por diseño). Se carga aparte con GET /api/users y se guarda con el
   POST /api/users que ya existía (upsert por correo, admin-only). */
let _administradoresCache=[];
async function renderAdministradores(){
  const tbody=$('#tabla-administradores'); if(!tbody) return;
  try{
    _administradoresCache=await apiGet('/api/users');
    tbody.innerHTML=_administradoresCache.map(u=>`<tr>
      <td><strong>${esc(u.nombre)}</strong></td>
      <td>${esc(u.email)}</td>
      <td>${u.role==='admin'?'<span class="badge b-blue">Administrador</span>':'<span class="badge b-purple">Proveedor</span>'}</td>
      <td>${u.activo?'<span class="badge b-ok">Activo</span>':'<span class="badge b-muted">Inactivo</span>'}</td>
      <td class="td-actions"><div class="td-actions-wrap"><button class="btn-icon js-mutate" onclick="openFormAdmin('${esc(u.email)}')">${svgIcon('lapiz')}</button></div></td>
    </tr>`).join('')||`<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px">Sin administradores aún</td></tr>`;
  }catch(e){ tbody.innerHTML=`<tr><td colspan="5" style="text-align:center;color:var(--error);padding:24px">${esc(e.message||'No se pudo cargar la lista')}</td></tr>`; }
}

function openFormAdmin(correo=null){
  const u=correo?_administradoresCache.find(x=>x.email===correo):null;
  openModal(u?'Editar administrador':'Nuevo administrador',u?'Escribe una contraseña nueva para actualizar el acceso de esta cuenta.':'Crea una cuenta con acceso a este panel.',`
    <div class="form-grid">
      <div class="field span2"><label>Nombre <span class="req">*</span></label><input id="fadmin-nombre" value="${u?esc(u.nombre):''}" maxlength="80"><span class="ferr"></span></div>
      <div class="field span2"><label>Correo <span class="req">*</span></label><input id="fadmin-correo" type="email" value="${u?esc(u.email):''}" ${u?'disabled':''} placeholder="correo@empresa.com" maxlength="120"><span class="ferr"></span></div>
      <div class="field span2"><label>Contraseña <span class="req">*</span></label><input id="fadmin-pass" type="password" placeholder="Mínimo 8 caracteres" maxlength="120"><span class="ferr"></span></div>
      <div class="field span2"><label>Rol</label><select id="fadmin-rol"><option value="admin" ${!u||u.role==='admin'?'selected':''}>Administrador</option><option value="proveedor" ${u&&u.role==='proveedor'?'selected':''}>Proveedor (solo consulta)</option></select></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-primary" onclick="saveAdmin('${u?esc(u.email):''}')">${svgIcon('check',14)} Guardar</button>
      <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
    </div>`);
}

async function saveAdmin(correoOriginal){
  const nombre=$('#fadmin-nombre').value.trim();
  const correo=(correoOriginal||$('#fadmin-correo').value.trim());
  const password=$('#fadmin-pass').value;
  const role=$('#fadmin-rol').value;
  if(!nombre){ toast('Escribe el nombre','error'); return; }
  if(!correoOk(correo)||!correo){ toast('Correo inválido','error'); return; }
  if(!password||password.length<8){ toast('La contraseña debe tener al menos 8 caracteres','error'); return; }
  try{
    await apiPostAuth('/api/users',{nombre,email:correo,password,role});
    closeModal();
    toast('Administrador guardado');
    renderAdministradores();
  }catch(e){ toast(e.message||'No se pudo guardar','error'); }
}

function renderProveedores(){
  const registrados=DB.proveedores.filter(p=>(p.origen||'registrado')==='registrado').length;
  const rapidos=DB.proveedores.length-registrados;
  if($('#prov-kpi-registrados')) $('#prov-kpi-registrados').textContent=registrados;
  if($('#prov-kpi-rapidos')) $('#prov-kpi-rapidos').textContent=rapidos;
  $$('.provider-view-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.provView===provVista));
  const lista=DB.proveedores.filter(p=>provVista==='todos'||(p.origen||'registrado')===provVista);
  $('#tabla-proveedores').innerHTML=lista.map(p=>`<tr>
    <td><strong>${esc(p.nombre)}</strong><br><small style="color:var(--text-muted)">${esc(p.direccion||'')}</small></td>
    <td>${(p.origen||'registrado')==='no_registrado'?'<span class="badge b-warn">No registrado</span>':'<span class="badge b-blue">Registrado</span>'}</td>
    <td>${esc(p.empresa)||'—'}</td><td>${esc(p.telefono)||'—'}</td><td>${esc(p.correo)||'—'}</td>
    <td>${p.whatsapp?`<a href="https://wa.me/${p.whatsapp.replace(/[^0-9]/g,'')}" target="_blank" class="wa-link"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> WhatsApp</a>`:'—'}</td>
    <td>${p.estado==='activo'?`<span class="badge b-ok">Activo</span>`:`<span class="badge b-muted">Inactivo</span>`}</td>
    <td class="td-actions"><div class="td-actions-wrap">
      <button class="btn-icon" onclick="openFormProv(${p.id})">${svgIcon('lapiz')}</button>
      <button class="btn-icon danger" onclick="deleteProv(${p.id})">${svgIcon('basura')}</button>
    </div></td></tr>`).join('')||`<tr class="empty-row"><td colspan="8"><em>Sin proveedores en esta sección</em></td></tr>`;
}

function openFormProv(id=null){
  const p=id?provPor(id):null;
  const esRapido=p&&(p.origen||'registrado')==='no_registrado';
  openModal(p?(esRapido?'Completar proveedor no registrado':'Editar proveedor'):'Nuevo proveedor',esRapido?'Agrega sus datos cuando los tengas o conviértelo en proveedor registrado.':'',`
    <div class="form-grid">
      <div class="field"><label>Nombre <span class="req">*</span></label><input id="fprov-nombre" value="${p?esc(p.nombre):''}" maxlength="120"><span class="ferr"></span></div>
      <div class="field"><label>Empresa</label><input id="fprov-empresa" value="${p?esc(p.empresa||''):''}" maxlength="120"></div>
      <div class="field"><label>Teléfono</label><input id="fprov-tel" value="${p?esc(p.telefono||''):''}" maxlength="30"></div>
      <div class="field"><label>Correo</label><input id="fprov-correo" value="${p?esc(p.correo||''):''}" placeholder="correo@empresa.com" maxlength="120"><span class="ferr"></span></div>
      <div class="field span2"><label>Dirección</label><input id="fprov-dir" value="${p?esc(p.direccion||''):''}" maxlength="180"></div>
      <div class="field"><label>WhatsApp</label><input id="fprov-wa" type="tel" value="${p?esc(p.whatsapp||''):''}" placeholder="50499881122" maxlength="24"><small style="color:var(--text-muted);font-size:11.5px;margin-top:3px;display:block">Número con código de país, sin + ni espacios</small></div>
      <div class="field"><label>Estado</label><select id="fprov-estado"><option value="activo" ${!p||p.estado==='activo'?'selected':''}>Activo</option><option value="inactivo" ${p&&p.estado==='inactivo'?'selected':''}>Inactivo</option></select></div>
      <div class="field span2"><label>Tipo de registro</label><select id="fprov-origen"><option value="registrado" ${!esRapido?'selected':''}>Registrado · ficha completa</option><option value="no_registrado" ${esRapido?'selected':''}>No registrado · contacto rápido</option></select><small>Los proveedores escritos durante una compra comienzan como no registrados.</small></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-primary" onclick="saveProv(${id||'null'})">${svgIcon('check',14)} Guardar</button>
    </div>`);
}

function saveProv(id){
  if(!validar([['fprov-nombre',noVacio,'Escribe el nombre'],['fprov-correo',correoOk,'Correo inválido']])) return;
  const datos={nombre:$('#fprov-nombre').value.trim(),empresa:$('#fprov-empresa').value.trim(),telefono:$('#fprov-tel').value.trim(),correo:$('#fprov-correo').value.trim(),direccion:$('#fprov-dir').value.trim(),whatsapp:$('#fprov-wa').value.trim().replace(/[^0-9]/g,''),estado:$('#fprov-estado').value,origen:$('#fprov-origen').value};
  if(id){ Object.assign(provPor(id),datos); toast('Proveedor actualizado'); }
  else{ DB.proveedores.push({id:nuevoId('proveedor'),...datos}); toast('Proveedor creado'); }
  dbGuardar(); closeModal(); renderProveedores();
}
window.setProveedorView=setProveedorView;

function deleteProv(id){
  const p=provPor(id);
  openConfirm(`Se eliminará el proveedor "${p.nombre}".`,()=>{ DB.proveedores=DB.proveedores.filter(x=>x.id!==id); dbGuardar(); renderProveedores(); toast('Proveedor eliminado'); });
}

/* ── CLIENTES ──
   Se muestran juntas las cuentas globales SIWEPE que ya compraron aquí y la
   agenda manual privada del negocio. Un contacto manual nunca recibe acceso
   ni contraseña: el cliente crea su cuenta global personalmente si la desea. */
function renderClientes(){
  $('#tabla-clientes').innerHTML=DB.clientes.map(c=>{
    const misPedidos=DB.pedidos.filter(p=>p.cliente_id===c.id);
    const pedidosValidos=misPedidos.filter(p=>p.estado!=='cancelado');
    const totalComprado=pedidosValidos.reduce((s,p)=>s+(p.total||0),0);
    const wa=String(c.whatsapp||'').replace(/\D/g,'');
    return `<tr>
    <td><strong>${esc(c.nombre)}</strong><span class="client-origin ${c.origen==='manual'?'manual':'siwepe'}">${c.origen==='manual'?'Registro manual':'Cuenta SIWEPE'}</span></td>
    <td>${esc(c.telefono)||'—'}</td><td>${esc(c.correo)||'—'}</td>
    <td>${wa?`<a href="https://wa.me/${wa}" target="_blank" rel="noopener" class="wa-link"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> WhatsApp</a>`:'—'}</td>
    <td><span class="badge b-muted">${pedidosValidos.length}</span></td>
    <td><strong>${dinero(totalComprado)}</strong></td>
    <td>${esc(c.direccion)||'—'}</td>
    <td class="center">${c.origen==='manual'?`<div class="actions"><button class="act-btn" onclick="openFormClienteManual(${Number(c.manualId)})" title="Editar">${svgIcon('lapiz',14)}</button><button class="act-btn danger" onclick="borrarClienteManual(${Number(c.manualId)})" title="Eliminar">${svgIcon('basura',14)}</button></div>`:'<span class="client-managed">Gestionado por el cliente</span>'}</td>
    </tr>`;
  }).join('')||`<tr class="empty-row"><td colspan="8"><em>Aún no hay clientes — registrá el primero o esperá una compra desde el portal</em></td></tr>`;
}

function openFormClienteManual(manualId=null){
  const c=manualId?DB.clientes.find(x=>Number(x.manualId)===Number(manualId)&&x.origen==='manual'):null;
  openModal(c?'Editar cliente':'Registrar cliente',c?'Actualizá los datos de tu agenda privada.':'Agregá un contacto sin crearle una cuenta SIWEPE.',`
    <div class="form-grid">
      <div class="field span2"><label>Nombre completo <span class="req">*</span></label><input id="fcli-nombre" maxlength="120" value="${esc(c?.nombre||'')}" placeholder="Nombre del cliente"><span class="ferr"></span></div>
      <div class="field"><label>Teléfono</label><input id="fcli-telefono" maxlength="30" value="${esc(c?.telefono||'')}" placeholder="+504 9999-9999"></div>
      <div class="field"><label>WhatsApp</label><input id="fcli-whatsapp" maxlength="24" value="${esc(c?.whatsapp||'')}" placeholder="50499999999"></div>
      <div class="field span2"><label>Correo</label><input id="fcli-correo" type="email" maxlength="120" value="${esc(c?.correo||'')}" placeholder="cliente@correo.com"><span class="ferr"></span></div>
      <div class="field span2"><label>Dirección</label><textarea id="fcli-direccion" maxlength="180" rows="3" placeholder="Dirección o referencia de entrega">${esc(c?.direccion||'')}</textarea></div>
    </div>
    <div class="manual-client-privacy">${svgIcon('info',15)} <span>Este contacto será visible únicamente dentro del panel de esta empresa.</span></div>
    <div class="modal-footer"><button class="btn btn-primary" id="btn-guardar-cliente" onclick="guardarClienteManual(${manualId||'null'})">${svgIcon('check',14)} ${c?'Guardar cambios':'Registrar cliente'}</button></div>`);
}

async function guardarClienteManual(manualId){
  if(!validar([['fcli-nombre',noVacio,'Escribe el nombre'],['fcli-correo',correoOk,'Correo inválido']])) return;
  const btn=$('#btn-guardar-cliente'); if(btn){btn.disabled=true;btn.textContent='Guardando…';}
  const datos={nombre:$('#fcli-nombre').value.trim(),telefono:$('#fcli-telefono').value.trim(),correo:$('#fcli-correo').value.trim(),whatsapp:$('#fcli-whatsapp').value.trim(),direccion:$('#fcli-direccion').value.trim()};
  try{
    if(manualId) await apiPut(`/api/clientes-manuales/${manualId}`,datos);
    else await apiPostAuth('/api/clientes-manuales',datos);
    await bootstrapDB();
    closeModal(); renderClientes();
    toast(manualId?'Cliente actualizado':'Cliente registrado');
  }catch(e){ toast(e.message||'No se pudo guardar el cliente','error'); if(btn){btn.disabled=false;btn.innerHTML=`${svgIcon('check',14)} Guardar`;}}
}

function borrarClienteManual(manualId){
  const c=DB.clientes.find(x=>Number(x.manualId)===Number(manualId));
  openConfirm(`Se eliminará a "${c?.nombre||'este cliente'}" de la agenda de esta empresa.`,async()=>{
    try{ await apiDelete(`/api/clientes-manuales/${manualId}`); await bootstrapDB(); renderClientes(); toast('Cliente eliminado'); }
    catch(e){ toast(e.message||'No se pudo eliminar el cliente','error'); }
  });
}
window.openFormClienteManual=openFormClienteManual; window.guardarClienteManual=guardarClienteManual; window.borrarClienteManual=borrarClienteManual;

/* ── INVENTARIO CONECTADO ──
   `stock_inventario` representa las unidades físicas todavía guardadas y
   `stock` únicamente las unidades que el negocio decidió publicar. */
function estadoInventario(p){
  if(!p.publicado_alguna_vez) return 'nuevo';
  if(p.estado==='inactivo') return 'inactivo';
  if((+p.stock||0)>0) return 'tienda';
  return 'almacen';
}

function renderInventario(){
  const el=$('#inventory-list'); if(!el) return;
  const q=($('#filtro-inv-q')?.value||'').trim().toLowerCase();
  const filtro=$('#filtro-inv-est')?.value||'';
  const productos=DB.productos.filter(p=>(!q||(p.nombre||'').toLowerCase().includes(q)||(p.codigo||'').toLowerCase().includes(q))&&(!filtro||estadoInventario(p)===filtro));
  const almacen=DB.productos.reduce((n,p)=>n+(+p.stock_inventario||0),0);
  const tienda=DB.productos.reduce((n,p)=>n+(+p.stock||0),0);
  const valor=DB.productos.reduce((n,p)=>n+((+p.stock||0)+(+p.stock_inventario||0))*(+p.precio_compra||0),0);
  if($('#inv-kpi-almacen')) $('#inv-kpi-almacen').textContent=almacen;
  if($('#inv-kpi-tienda')) $('#inv-kpi-tienda').textContent=tienda;
  if($('#inv-kpi-valor')) $('#inv-kpi-valor').textContent=dinero(valor);
  if($('#inv-kpi-productos')) $('#inv-kpi-productos').textContent=DB.productos.length;
  if(!productos.length){ el.innerHTML=`<div class="inventory-empty"><span>${svgIcon('caja',24)}</span><h3>No encontramos existencias</h3><p>Registra una compra para crear un artículo y llevarlo primero al inventario físico.</p><button class="btn btn-primary" onclick="openFormCompra()">Registrar entrada</button></div>`; return; }
  const etiquetas={nuevo:['Nuevo producto','inv-new'],tienda:['Producto en tienda','inv-live'],inactivo:['Tienda inactiva','inv-off'],almacen:['Solo en inventario','inv-warehouse']};
  el.innerHTML=productos.map(p=>{
    const estado=estadoInventario(p), etiqueta=etiquetas[estado], cat=catPor(p.categoria_id);
    const fotos=(Array.isArray(p.imagenes)?p.imagenes:[]).filter(Boolean), portada=p.imagen||fotos[0]||'';
    return `<article class="inventory-row">
      <div class="inventory-product">
        <div class="inventory-thumb">${portada?`<img src="${portada}" alt="${esc(p.nombre)}" onerror="imgFb(this)">`:`<span>${esc((p.nombre||'?')[0].toUpperCase())}</span>`}</div>
        <div><span class="inventory-status ${etiqueta[1]}">${etiqueta[0]}</span><h3>${esc(p.nombre)}</h3><p>${esc(p.codigo)} · ${esc(cat?.nombre||'Sin categoría')}</p></div>
      </div>
      <div class="inventory-balance"><div><span>En tienda</span><strong>${+p.stock||0}</strong></div><i>${svgIcon('salida',17)}</i><div><span>En inventario</span><strong>${+p.stock_inventario||0}</strong></div></div>
      <div class="inventory-cost"><span>Costo unitario</span><strong>${dinero(p.precio_compra)}</strong><small>${dinero(((+p.stock||0)+(+p.stock_inventario||0))*(+p.precio_compra||0))} total</small></div>
      <div class="inventory-actions">
        <button class="btn btn-primary btn-sm" ${(+p.stock_inventario||0)<=0?'disabled':''} onclick="openTransferirInventario(${p.id},'publicar')">Publicar</button>
        <button class="btn btn-outline btn-sm" ${(+p.stock||0)<=0?'disabled':''} onclick="openTransferirInventario(${p.id},'retirar')">Retirar</button>
        <button class="btn-icon" title="Editar producto" onclick="openFormProducto(${p.id})">${svgIcon('lapiz',15)}</button>
      </div>
    </article>`;
  }).join('');
}

function openTransferirInventario(productoId,direccion){
  const p=prodPor(productoId); if(!p) return;
  const publicar=direccion==='publicar', disponible=publicar?(+p.stock_inventario||0):(+p.stock||0);
  openModal(publicar?'Publicar unidades en tienda':'Retirar unidades de la tienda',p.nombre,`
    <div class="stock-transfer-visual"><div><span>Origen</span><strong>${publicar?'Inventario':'Tienda'}</strong><b>${disponible} disponibles</b></div><i>${svgIcon(publicar?'salida':'entrada',22)}</i><div><span>Destino</span><strong>${publicar?'Tienda':'Inventario'}</strong><b>${publicar?(+p.stock||0):(+p.stock_inventario||0)} actuales</b></div></div>
    <div class="field"><label>Cantidad a ${publicar?'publicar':'retirar'} <span class="req">*</span></label><input id="fit-cantidad" type="number" min="1" max="${disponible}" step="1" value="1"><small>Este traslado no crea ni elimina existencias.</small><span class="ferr"></span></div>
    <div class="modal-footer"><button id="fit-save" class="btn btn-primary" onclick="saveTransferenciaInventario(${productoId},'${direccion}')">Confirmar traslado</button></div>`,'520px');
}

async function saveTransferenciaInventario(productoId,direccion){
  const p=prodPor(productoId), cantidad=+($('#fit-cantidad')?.value||0), disponible=direccion==='publicar'?(+p.stock_inventario||0):(+p.stock||0);
  if(!Number.isInteger(cantidad)||cantidad<1||cantidad>disponible){ validar([['fit-cantidad',()=>false,`Elige entre 1 y ${disponible}`]]); return; }
  const btn=$('#fit-save'); if(btn){btn.disabled=true;btn.textContent='Guardando…';}
  try{
    await apiPostAuth('/api/inventario/transferir',{productoId,cantidad,direccion});
    await bootstrapDB(); closeModal(); renderAll(); goTo('inventario');
    toast(direccion==='publicar'?`${cantidad} unidad${cantidad!==1?'es':''} publicada${cantidad!==1?'s':''} en la tienda`:`${cantidad} unidad${cantidad!==1?'es':''} devuelta${cantidad!==1?'s':''} al inventario`);
  }catch(e){ toast(e.message||'No se pudo trasladar el inventario','error'); if(btn){btn.disabled=false;btn.textContent='Confirmar traslado';} }
}
window.renderInventario=renderInventario; window.openTransferirInventario=openTransferirInventario; window.saveTransferenciaInventario=saveTransferenciaInventario;

/* ── COMPRAS ── */
let comFiltros={desde:'',hasta:''};
function renderCompras(){
  const lista=[...DB.compras]
    .filter(c=>(!comFiltros.desde||c.fecha>=comFiltros.desde)&&(!comFiltros.hasta||c.fecha<=comFiltros.hasta))
    .sort((a,b)=> b.fecha<a.fecha?-1 : b.fecha>a.fecha?1 : b.id-a.id);
  $('#tabla-compras').innerHTML=lista.map(c=>{
    const p=prodPor(c.producto_id),pr=provPor(c.proveedor_id);
    return `<tr><td>${fechaCorta(c.fecha)}</td><td><div class="td-prod"><div class="td-prod-thumb">${p&&p.imagen?`<img src="${p.imagen}" alt="" data-l="${p.nombre[0].toUpperCase()}" onerror="imgFb(this)">`:(p?p.nombre[0].toUpperCase():'?')}</div><div class="td-prod-info"><strong>${esc(p?p.nombre:'(eliminado)')}</strong></div></div></td><td>${esc(pr?pr.nombre:'—')}</td><td><span class="badge b-ok">+${c.cantidad}</span></td><td>${dinero(c.precio)}</td><td><strong>${dinero(c.cantidad*c.precio)}</strong></td><td style="color:var(--text-muted)">${esc(c.obs)||'—'}</td></tr>`;
  }).join('')||`<tr class="empty-row"><td colspan="7"><em>Sin compras</em></td></tr>`;
}

function openFormCompra(){
  const cats=DB.categorias.filter(c=>c.estado==='activo').map(c=>({value:c.id,label:c.nombre}));
  const provs=DB.proveedores.filter(p=>p.estado==='activo').map(p=>({value:p.id,label:p.nombre,sub:p.empresa||''}));
  openModal('Registrar compra','La entrada se guardará en inventario; tú eliges después cuánto publicar',`
    <div class="form-grid">
      ${comboField('fc-cat','Categoría','Escribe o selecciona una categoría…',{actionLabel:'+ Crear aquí',actionHandler:"toggleInlineCategory('fc')"})}
      ${quickCategoryPanel('fc')}
      ${comboField('fc-prod','Producto','Elige una categoría primero…',{disabled:true})}
      <div class="field span2 purchase-new-product" id="fc-nuevo-wrap" hidden>
        <div class="purchase-new-head"><span>${svgIcon('caja',17)}</span><div><strong>Nuevo artículo de inventario</strong><small>Se crea inactivo y sin unidades publicadas.</small></div></div>
        <div class="form-grid">
          <div class="field"><label>Nombre <span class="req">*</span></label><input id="fc-nuevo-nombre" maxlength="120" placeholder="Ej: Camisa básica negra"><span class="ferr"></span></div>
          <div class="field"><label>Precio de venta sugerido</label><input id="fc-nuevo-pventa" type="number" min="0" step="0.01" placeholder="0.00"></div>
          <div class="field"><label>Stock mínimo</label><input id="fc-nuevo-min" type="number" min="0" step="1" value="5"></div>
          <div class="field"><label>Marca</label><input id="fc-nuevo-marca" maxlength="80" placeholder="Opcional"></div>
          <div class="field span2"><label>Descripción</label><textarea id="fc-nuevo-desc" maxlength="1000" rows="2" placeholder="Detalles para identificar el artículo"></textarea></div>
        </div>
      </div>
      ${comboField('fc-prov','Proveedor','Selecciona, escribe uno nuevo o déjalo vacío…',{requerido:false})}
      <div class="field span2 inline-provider-note" id="fc-prov-note">Puedes seleccionar un proveedor existente, escribir un nombre nuevo o dejarlo vacío. Los nombres nuevos aparecerán como <strong>No registrados</strong> en Proveedores.</div>
      <div class="field"><label>Cantidad <span class="req">*</span></label><input id="fc-cant" type="number" min="1" step="1" placeholder="0"><span class="ferr"></span></div>
      <div class="field"><label>Precio de compra <span class="req">*</span></label><input id="fc-precio" type="number" min="0" step="0.01"><span class="ferr"></span></div>
      <div class="field"><label>Fecha <span class="req">*</span></label><input id="fc-fecha" type="date" value="${hoy()}" max="${hoy()}"><span class="ferr"></span></div>
      <div class="field"><label>&nbsp;</label><div style="background:var(--accent-light);border-radius:var(--r-sm);padding:11px 14px;display:flex;justify-content:space-between;align-items:center"><span style="font-size:12px;font-weight:600;color:var(--text-muted)">TOTAL</span><strong id="fc-total" style="font-size:20px;color:var(--accent)">${dinero(0)}</strong></div></div>
      <div class="field span2"><label>Observaciones</label><textarea id="fc-obs" rows="2" placeholder="Lote, factura…" maxlength="255"></textarea></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-primary" id="btn-save-compra" onclick="saveCompra()">${svgIcon('check',14)} Guardar entrada</button>
    </div>`);
  comboInit('fc-cat', cats);
  comboInit('fc-prod', []);
  comboInit('fc-prov', provs);
  const updTotal=()=>{ $('#fc-total').textContent=dinero((+$('#fc-cant').value||0)*(+$('#fc-precio').value||0)); };
  const cargarPrecioProducto=()=>{ const hid=$('#fc-prod'); if(hid.value&&hid.value!=='nuevo') $('#fc-precio').value=hid.dataset.precio||'0'; updTotal(); };
  $('#fc-cat').addEventListener('input',()=>{
    const catId=$('#fc-cat').value, prodHid=$('#fc-prod');
    if(!catId){ prodHid._combo.setOpciones([],'Elige una categoría primero…'); updTotal(); return; }
    const prods=DB.productos.filter(p=>String(p.categoria_id)===String(catId))
      .map(p=>({value:p.id,label:p.nombre,sub:p.codigo||'',data:{precio:p.precio_compra}}));
    prods.unshift({value:'nuevo',label:'Crear un artículo nuevo',sub:'Ingresará primero al inventario'});
    prodHid._combo.setOpciones(prods,'Escribe, selecciona o crea un producto…');
    updTotal();
  });
  $('#fc-prod').addEventListener('input',()=>{
    const nuevo=$('#fc-prod').value==='nuevo';
    $('#fc-nuevo-wrap').hidden=!nuevo;
    if(nuevo) setTimeout(()=>$('#fc-nuevo-nombre')?.focus(),40);
    cargarPrecioProducto();
  });
  ['fc-cant','fc-precio'].forEach(id=>document.getElementById(id).addEventListener('input',updTotal));
  const updProveedorNota=()=>{
    const nombre=$('#fc-prov-q').value.trim(), seleccionado=$('#fc-prov').value;
    const nota=$('#fc-prov-note');
    if(seleccionado) nota.innerHTML='Proveedor existente seleccionado.';
    else if(nombre) nota.innerHTML=`<strong>${esc(nombre)}</strong> se guardará automáticamente como proveedor no registrado.`;
    else nota.innerHTML='La compra se guardará sin proveedor. Podrás completar este dato después.';
  };
  $('#fc-prov-q').addEventListener('input',updProveedorNota);
  $('#fc-prov').addEventListener('input',updProveedorNota);
  precioVacioEnCero('fc-nuevo-pventa'); precioVacioEnCero('fc-precio');
}

async function saveCompra(){
  const ok=validar([['fc-cat',noVacio,'Elige una categoría'],['fc-prod',noVacio,'Elige un producto'],['fc-cant',entPos,'Cantidad inválida'],['fc-precio',numVacioCero,'Precio inválido'],['fc-fecha',noVacio,'Elige una fecha']]);
  if(!ok) return;
  const esNuevo=$('#fc-prod').value==='nuevo';
  if(esNuevo&&!validar([['fc-nuevo-nombre',noVacio,'Escribe el nombre del artículo']])) return;
  const cant=+$('#fc-cant').value,precio=+($('#fc-precio').value||0), btn=$('#btn-save-compra');
  const proveedorId=+($('#fc-prov').value||0), proveedorNombre=proveedorId?'':$('#fc-prov-q').value.trim();
  const payload={productoId:esNuevo?null:+$('#fc-prod').value,proveedorId:proveedorId||null,proveedorNombre,cantidad:cant,precio,fecha:$('#fc-fecha').value,obs:$('#fc-obs').value.trim()};
  if(esNuevo) payload.nuevo={nombre:$('#fc-nuevo-nombre').value.trim(),categoria_id:+$('#fc-cat').value,descripcion:$('#fc-nuevo-desc').value.trim(),precio_venta:+($('#fc-nuevo-pventa').value||0),stock_min:+($('#fc-nuevo-min').value||0),marca:$('#fc-nuevo-marca').value.trim()};
  if(btn){btn.disabled=true;btn.textContent='Guardando entrada…';}
  try{
    const r=await apiPostAuth('/api/inventario/compras',payload);
    await bootstrapDB(); closeModal(); renderAll(); goTo('inventario');
    const p=prodPor(r.productoId);
    toast(`${cant} unidad${cant!==1?'es':''} de ${p?.nombre||'producto'} ingresada${cant!==1?'s':''} al inventario${r.proveedorCreado?' · proveedor guardado como no registrado':''}`);
  }catch(e){ toast(e.message||'No se pudo registrar la compra','error'); if(btn){btn.disabled=false;btn.innerHTML=`${svgIcon('check',14)} Guardar entrada`;} }
}

/* ── VENTAS ── */
let venFiltros={desde:'',hasta:''};
function renderVentas(){
  const lista=DB.ventas.filter(ventaActiva)
    .filter(v=>(!venFiltros.desde||v.fecha>=venFiltros.desde)&&(!venFiltros.hasta||v.fecha<=venFiltros.hasta))
    .sort((a,b)=> b.fecha<a.fecha?-1 : b.fecha>a.fecha?1 : b.id-a.id);
  $('#tabla-ventas').innerHTML=lista.map(v=>{
    const p=prodPor(v.producto_id);
    const origen=v.origen_stock||((+v.stock_inventario_usado||0)>0?'inventario':'tienda');
    const usadoT=+v.stock_tienda_usado||0, usadoI=+v.stock_inventario_usado||0;
    const origenTxt=origen==='mixto'?`Mixto · ${usadoT}+${usadoI}`:origen==='inventario'?'Inventario':'Tienda';
    const origenCls=origen==='mixto'?'b-warn':origen==='inventario'?'b-blue':'b-ok';
    return `<tr><td>${fechaCorta(v.fecha)}</td><td><div class="td-prod"><div class="td-prod-thumb">${p&&p.imagen?`<img src="${p.imagen}" alt="" data-l="${p.nombre[0].toUpperCase()}" onerror="imgFb(this)">`:(p?p.nombre[0].toUpperCase():'?')}</div><div class="td-prod-info"><strong>${esc(p?p.nombre:'(eliminado)')}</strong></div></div></td><td>${esc(v.cliente_nombre)||'—'}</td><td><span class="badge b-error">−${v.cantidad}</span></td><td><span class="badge ${origenCls}">${origenTxt}</span></td><td>${dinero(v.precio)}</td><td><strong>${dinero(v.total)}</strong></td></tr>`;
  }).join('')||`<tr class="empty-row"><td colspan="7"><em>Sin ventas</em></td></tr>`;
}

function openFormVenta(){
  const cats=DB.categorias.filter(c=>c.estado==='activo').map(c=>({value:c.id,label:c.nombre}));
  openModal('Registrar venta directa','Se descuenta primero lo publicado; si no alcanza, te pediremos confirmar el uso de inventario',`
    <div class="form-grid">
      ${comboField('fv-cat','Categoría','Escribe o selecciona una categoría…',{actionLabel:'+ Crear aquí',actionHandler:"toggleInlineCategory('fv')"})}
      ${quickCategoryPanel('fv')}
      ${comboField('fv-prod','Producto','Elige una categoría primero…',{disabled:true})}
      <p id="fv-stock-nota" style="grid-column:1/-1;font-size:12.5px;color:var(--text-muted);margin-top:-6px"></p>
      <div class="field"><label>Nombre del cliente <span class="req">*</span></label><input id="fv-cli-nombre" placeholder="Nombre completo" maxlength="120"><span class="ferr"></span></div>
      <div class="field"><label>Número de identidad</label><input id="fv-cli-id" placeholder="Opcional" maxlength="40"></div>
      <div class="field"><label>Cantidad <span class="req">*</span></label><input id="fv-cant" type="number" min="1" step="1" placeholder="0"><span class="ferr"></span></div>
      <div class="field"><label>Precio de venta <span class="req">*</span></label><input id="fv-precio" type="number" min="0" step="0.01"><span class="ferr"></span></div>
      <div class="field span2"><label>Fecha <span class="req">*</span></label><input id="fv-fecha" type="date" value="${hoy()}" max="${hoy()}"><span class="ferr"></span></div>
    </div>
    <div style="background:var(--accent-light);border-radius:var(--r-sm);padding:12px 16px;display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><span style="font-size:12px;font-weight:600;color:var(--text-muted)">TOTAL DE LA VENTA</span><strong id="fv-total" style="font-size:24px;color:var(--accent)">${dinero(0)}</strong></div>
    <div class="modal-footer">
      <button class="btn btn-primary" onclick="saveVenta()">${svgIcon('check',14)} Guardar venta</button>
    </div>`);
  comboInit('fv-cat', cats);
  comboInit('fv-prod', []);
  const upd=()=>{
    const hid=$('#fv-prod');
    if(hid.value){ $('#fv-stock-nota').innerHTML=`<strong>${hid.dataset.stock} en tienda</strong> · ${hid.dataset.inventario} en inventario · ${hid.dataset.total} disponibles en total`; }
    else $('#fv-stock-nota').textContent='';
    $('#fv-total').textContent=dinero((+$('#fv-cant').value||0)*(+$('#fv-precio').value||0));
  };
  $('#fv-cat').addEventListener('input',()=>{
    const catId=$('#fv-cat').value, prodHid=$('#fv-prod');
    if(!catId){ prodHid._combo.setOpciones([],'Elige una categoría primero…'); upd(); return; }
    const prods=DB.productos.filter(p=>((+p.stock||0)+(+p.stock_inventario||0))>0&&String(p.categoria_id)===String(catId))
      .map(p=>({value:p.id,label:p.nombre,sub:`${+p.stock||0} tienda · ${+p.stock_inventario||0} inventario`,data:{precio:p.precio_venta,stock:+p.stock||0,inventario:+p.stock_inventario||0,total:(+p.stock||0)+(+p.stock_inventario||0)}}));
    prodHid._combo.setOpciones(prods, prods.length?'Escribe o selecciona un producto…':'Sin existencias en esta categoría');
    upd();
  });
  $('#fv-prod').addEventListener('input',()=>{ if($('#fv-prod').value) $('#fv-precio').value=$('#fv-prod').dataset.precio||'0'; upd(); });
  ['fv-cant','fv-precio'].forEach(id=>document.getElementById(id).addEventListener('input',upd));
  precioVacioEnCero('fv-precio');
}

async function saveVenta(confirmarInventario=false){
  const ok=validar([['fv-cat',noVacio,'Elige una categoría'],['fv-prod',noVacio,'Elige un producto'],['fv-cli-nombre',noVacio,'Escribe el nombre del cliente'],['fv-cant',entPos,'Cantidad inválida'],['fv-precio',numVacioCero,'Precio inválido'],['fv-fecha',noVacio,'Elige una fecha']]);
  if(!ok) return;
  const pid=+$('#fv-prod').value,cant=+$('#fv-cant').value,precio=+($('#fv-precio').value||0);
  const p=prodPor(pid), totalDisponible=(+p.stock||0)+(+p.stock_inventario||0);
  if(cant>totalDisponible){ validar([['fv-cant',()=>false,`Solo hay ${totalDisponible} uds entre tienda e inventario`]]); return; }
  const nombreCli=$('#fv-cli-nombre').value.trim(), idCli=$('#fv-cli-id').value.trim();
  const total=+(cant*precio).toFixed(2);
  const btn=$('#modal-body .btn-primary'); if(btn){btn.disabled=true;btn.textContent='Registrando…';}
  try{
    const r=await apiPostAuth('/api/ventas/directas',{productoId:pid,cantidad:cant,precio,fecha:$('#fv-fecha').value,clienteNombre:nombreCli,clienteIdentidad:idCli,confirmarInventario});
    await bootstrapDB(); closeModal(); renderAll(); goTo('ventas');
    toast(`Venta registrada por ${dinero(total)} · ${r.origen==='mixto'?'tienda e inventario':r.origen}`);
  }catch(e){
    if(e.requiereConfirmacion){
      if(btn){btn.disabled=false;btn.innerHTML=`${svgIcon('check',14)} Guardar venta`;}
      openConfirm(`${e.message} ¿Deseas continuar con esta distribución?`,()=>saveVenta(true));
      return;
    }
    toast(e.message||'No se pudo registrar la venta','error');
    if(btn){btn.disabled=false;btn.innerHTML=`${svgIcon('check',14)} Guardar venta`;}
  }
}

/* ── MOVIMIENTOS con gráficos ── */
let movFiltros={q:'',tipo:'',desde:'',hasta:''};

function renderMovimientos(){
  const lista=movsFiltrados();
  renderMovKPIs(lista);
  renderMovChart(lista);
  renderMovRank(lista);
  renderMovTabla(lista);
}

function movsFiltrados(){
  return [...DB.movimientos].sort((a,b)=>b.id-a.id).filter(m=>{
    const p=prodPor(m.producto_id);
    return(!movFiltros.q||(p&&p.nombre.toLowerCase().includes(movFiltros.q)))&&(!movFiltros.tipo||m.tipo===movFiltros.tipo)&&(!movFiltros.desde||m.fecha>=movFiltros.desde)&&(!movFiltros.hasta||m.fecha<=movFiltros.hasta);
  });
}

function renderMovKPIs(lista){
  const ent=lista.filter(m=>m.tipo==='entrada'),sal=lista.filter(m=>m.tipo==='salida');
  const tE=ent.reduce((s,m)=>s+m.cantidad,0),tS=sal.reduce((s,m)=>s+m.cantidad,0);
  const pp={}; lista.forEach(m=>{pp[m.producto_id]=(pp[m.producto_id]||0)+m.cantidad;});
  const topId=Object.entries(pp).sort((a,b)=>b[1]-a[1])[0];
  const topP=topId?prodPor(+topId[0]):null;
  $('#mov-kpi-ent').textContent=tE; $('#mov-kpi-sal').textContent=tS;
  $('#mov-kpi-top').textContent=topP?topP.nombre.slice(0,20)+(topP.nombre.length>20?'…':''):'—';
  $('#mov-kpi-ops').textContent=lista.length;
}

function renderMovChart(lista){
  const pf={}; lista.forEach(m=>{ if(m.tipo==='ajuste') return; if(!pf[m.fecha]) pf[m.fecha]={e:0,s:0}; pf[m.fecha][m.tipo==='entrada'?'e':'s']+=m.cantidad; });
  const fechas=Object.keys(pf).sort().slice(-14);
  const MESES=['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const el=$('#mov-chart'); if(!el) return;
  if(!fechas.length){ el.innerHTML=`<div style="text-align:center;color:var(--text-muted);padding:40px;font-style:italic;font-size:13.5px">Sin datos</div>`; return; }
  const mx=Math.max(1,...fechas.map(f=>pf[f].e+pf[f].s));
  el.innerHTML=`<div class="chart-legend"><span class="cleg"><span class="cleg-dot" style="background:var(--ok)"></span>Entradas</span><span class="cleg"><span class="cleg-dot" style="background:var(--accent)"></span>Salidas</span></div>
  <div class="chart-bars-dates">${fechas.map(f=>{
    const d=pf[f],dia=f.split('-')[2],mes=MESES[+f.split('-')[1]];
    const pE=((d.e/mx)*100).toFixed(1),pS=((d.s/mx)*100).toFixed(1);
    return `<div class="cbd-col"><div class="cbd-bars"><div class="cbd-bar ent" data-h="${pE}" title="Ent:${d.e}"></div><div class="cbd-bar sal" data-h="${pS}" title="Sal:${d.s}"></div></div><div class="cbd-lbl">${+dia} ${mes}</div></div>`;
  }).join('')}</div>`;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{ $$('.cbd-bar').forEach(b=>b.style.height=b.dataset.h+'%'); }));
}

function renderMovRank(lista){
  const pp={}; lista.forEach(m=>{ if(m.tipo==='ajuste') return; if(!pp[m.producto_id]) pp[m.producto_id]={e:0,s:0}; pp[m.producto_id][m.tipo==='entrada'?'e':'s']+=m.cantidad; });
  const top=Object.entries(pp).map(([id,v])=>({p:prodPor(+id),...v})).filter(x=>x.p).sort((a,b)=>b.s-a.s).slice(0,6);
  const el=$('#mov-rank'); if(!el) return;
  if(!top.length){ el.innerHTML=`<div style="text-align:center;color:var(--text-muted);padding:30px;font-style:italic;font-size:13.5px">Sin datos</div>`; return; }
  const mx=Math.max(1,...top.map(x=>x.s));
  const COLS=['var(--accent)','var(--accent-mid)','var(--ok)','var(--warn)','var(--error)','var(--text-muted)'];
  el.innerHTML=`<div class="rank-rows">${top.map((x,i)=>`<div class="rank-row"><div class="rank-num">${i+1}</div><div class="rank-nombre" title="${esc(x.p.nombre)}">${esc(x.p.nombre)}</div><div class="rank-track"><div class="rank-fill" data-w="${((x.s/mx)*100).toFixed(1)}" style="background:${COLS[i%COLS.length]}"></div></div><div class="rank-val">−${x.s}</div></div>`).join('')}</div>`;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{ $$('.rank-fill').forEach(b=>b.style.width=b.dataset.w+'%'); }));
}

function renderMovTabla(lista){
  $('#tabla-movimientos').innerHTML=lista.slice(0,60).map(m=>{
    const p=prodPor(m.producto_id);
    let badge,signo,color;
    if(m.tipo==='entrada'){ badge='<span class="badge b-ok">Entrada</span>'; signo='+'; color='var(--ok)'; }
    else if(m.tipo==='salida'){ badge='<span class="badge b-error">Salida</span>'; signo='−'; color='var(--error)'; }
    else { badge='<span class="badge b-warn">Ajuste</span>'; signo=(m.signo==='+'?'+':'−'); color='var(--warn)'; }
    return `<tr><td>${badge}</td><td><strong>${esc(p?p.nombre:'(eliminado)')}</strong></td><td><span style="font-weight:700;color:${color}">${signo}${m.cantidad}</span></td><td>${fechaCorta(m.fecha)}</td><td>${esc(m.usuario)}</td><td style="color:var(--text-muted)">${esc(m.obs)||'—'}</td></tr>`;
  }).join('')||`<tr class="empty-row"><td colspan="6"><em>Sin movimientos</em></td></tr>`;
}

/* ── AJUSTE DE INVENTARIO (daño, merma, corrección) ── */
function openFormAjuste(){
  const cats=DB.categorias.filter(c=>c.estado==='activo').map(c=>({value:c.id,label:c.nombre}));
  openModal('Registrar ajuste de inventario','Corrige el stock por daño, merma, robo o conteo físico',`
    <div class="form-grid">
      ${comboField('fa-cat','Categoría','Escribe o selecciona una categoría…',{actionLabel:'+ Crear aquí',actionHandler:"toggleInlineCategory('fa')"})}
      ${quickCategoryPanel('fa')}
      ${comboField('fa-prod','Producto','Elige una categoría primero…',{disabled:true})}
      <div class="field"><label>Tipo de ajuste <span class="req">*</span></label><select id="fa-signo">
        <option value="-">Restar (daño, merma, robo)</option>
        <option value="+">Sumar (corrección, devolución)</option>
      </select></div>
      <div class="field"><label>Cantidad <span class="req">*</span></label><input id="fa-cant" type="number" min="1" step="1" placeholder="0"><span class="ferr"></span></div>
      <div class="field span2"><label>Fecha <span class="req">*</span></label><input id="fa-fecha" type="date" value="${hoy()}" max="${hoy()}"><span class="ferr"></span></div>
      <div class="field span2"><label>Motivo <span class="req">*</span></label><input id="fa-motivo" placeholder="Ej: producto dañado, ajuste por conteo físico…" maxlength="255"><span class="ferr"></span></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-primary" onclick="saveAjuste()">${svgIcon('check',14)} Guardar ajuste</button>
    </div>`);
  comboInit('fa-cat', cats);
  comboInit('fa-prod', []);
  $('#fa-cat').addEventListener('input',()=>{
    const catId=$('#fa-cat').value, prodHid=$('#fa-prod');
    if(!catId){ prodHid._combo.setOpciones([],'Elige una categoría primero…'); return; }
    const prods=DB.productos.filter(p=>p.estado==='activo'&&String(p.categoria_id)===String(catId))
      .map(p=>({value:p.id,label:p.nombre,sub:`${p.stock} en stock`,data:{stock:p.stock}}));
    prodHid._combo.setOpciones(prods, prods.length?'Escribe o selecciona un producto…':'Sin productos activos en esta categoría');
  });
}

function saveAjuste(){
  const ok=validar([['fa-cat',noVacio,'Elige una categoría'],['fa-prod',noVacio,'Elige un producto'],['fa-cant',entPos,'Cantidad inválida'],['fa-motivo',noVacio,'Escribe el motivo'],['fa-fecha',noVacio,'Elige una fecha']]);
  if(!ok) return;
  const pid=+$('#fa-prod').value, cant=+$('#fa-cant').value, signo=$('#fa-signo').value, motivo=$('#fa-motivo').value.trim();
  const p=prodPor(pid);
  if(signo==='-'&&cant>p.stock){ validar([['fa-cant',()=>false,`Solo hay ${p.stock} en stock`]]); return; }
  p.stock += (signo==='+'?cant:-cant);
  DB.movimientos.push({id:nuevoId('movimiento'),tipo:'ajuste',signo,producto_id:pid,cantidad:cant,fecha:$('#fa-fecha').value,usuario:'Admin',obs:`Ajuste · ${motivo}`});
  dbGuardar(); closeModal(); renderMovimientos(); renderProductos(); renderDashboard();
  toast(`Ajuste registrado · "${p.nombre}" ahora tiene ${p.stock} uds`);
}

/* ── PEDIDOS ── */
const PEDIDO_ESTADO_LABEL={pendiente:'Pendiente',aprobado:'Confirmado',preparando:'Preparando',listo:'Listo',enviado:'Enviado',entregado:'Entregado',cancelado:'Cancelado'};

function renderPedidos(){
  /* Sync: releer DB para ver pedidos nuevos del portal cliente */
  dbCargar();
  const filtroE=$('#filtro-ped-estado')?.value||'';
  const lista=[...DB.pedidos].sort((a,b)=>b.id-a.id).filter(p=>!filtroE||p.estado===filtroE);
  const pend=DB.pedidos.filter(p=>p.estado==='pendiente').length;
  const badge=$('#pedidos-badge'); if(badge){ badge.textContent=pend||''; badge.style.display=pend?'flex':'none'; }

  const el=$('#ped-contenedor');
  if(!lista.length){ el.innerHTML=`<div style="text-align:center;padding:60px;color:var(--text-muted)"><em style="font-family:'Fraunces',serif;font-size:18px;font-style:italic">Sin pedidos</em><p style="margin-top:8px;font-size:13.5px">Cuando un cliente haga un pedido aparecerá aquí.</p></div>`; return; }

  el.innerHTML=lista.map(p=>{
    const c=cliPor(p.cliente_id);
    const bc=p.estado==='pendiente'?'b-warn':['aprobado','preparando','listo'].includes(p.estado)?'b-ok':['enviado','entregado'].includes(p.estado)?'b-blue':'b-muted';
    const items=p.items.map(it=>{ const pr=prodPor(it.producto_id), fotos=pr&&Array.isArray(pr.imagenes)?pr.imagenes:[], foto=(pr&&pr.imagen)||fotos[0]||''; return `<div class="ped-item-row">${foto?`<img class="ped-item-thumb" src="${foto}" alt="">`:`<span class="ped-item-thumb ph">${esc((pr?pr.nombre:'?')[0])}</span>`}<span class="ped-item-main"><strong>${esc(pr?pr.nombre:'Producto no disponible')}</strong><small>${it.cantidad} × ${dinero(it.precio)}</small></span><span>${dinero(it.subtotal)}</span></div>`; }).join('');
    const siguiente={pendiente:['aprobado','Confirmar pedido'],aprobado:['preparando','Iniciar preparación'],preparando:['listo','Marcar listo'],listo:['enviado','Marcar enviado'],enviado:['entregado','Marcar entregado']}[p.estado];
    const puedeCancelar=['pendiente','aprobado','preparando','listo'].includes(p.estado);
    const acciones=`<button class="btn btn-outline btn-sm" onclick="verPedidoAdmin(${p.id})">${svgIcon('ojo',13)} Ver orden</button>${siguiente?`<button class="btn btn-success btn-sm js-mutate" onclick="cambiarEstadoPed(${p.id},'${siguiente[0]}')">${svgIcon('check',13)} ${siguiente[1]}</button>`:''}${puedeCancelar?`<button class="btn btn-outline btn-sm js-mutate" onclick="cancelarPed(${p.id})">Cancelar</button>`:''}`;
    return `
    <div class="ped-card" data-estado="${p.estado}">
      <div class="ped-card-header">
        <div class="ped-card-left">
          <div class="ped-av">${(c?c.nombre:'?')[0].toUpperCase()}</div>
          <div><strong>${esc(c?c.nombre:'Cliente')}</strong><span>Pedido #${p.id} · ${fechaCorta(p.fecha)}</span></div>
        </div>
        <div class="ped-card-right">
          <span class="badge ${bc}">${PEDIDO_ESTADO_LABEL[p.estado]||p.estado}</span>
          <span class="ped-total">${dinero(p.total)}</span>
        </div>
      </div>
      <div class="ped-items">${items}</div>
      ${p.metodoPago==='transferencia'||p.comprobante?`<div class="ped-pago">
        <span class="ped-pago-tag"><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg> Transferencia</span>
        ${p.comprobante
          ?`<img src="${p.comprobante}" class="ped-comprobante-thumb" alt="Comprobante" title="Ver comprobante" onclick="verImagenAdmin('${p.id}')">`
          :`<span class="ped-pago-sin">Sin comprobante</span>`}
      </div>`:''}
      ${p.nota?`<div class="ped-nota">${svgIcon('info',13)} ${esc(p.nota)}</div>`:''}
      <div class="ped-actions">
        ${acciones}
        ${p.estado!=='cancelado'?`<button class="btn btn-outline btn-sm" onclick="abrirChatAdmin(${p.id})" style="display:inline-flex;align-items:center;gap:5px"><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Chat${mensajesNoLeidos(p.id,'admin')?` <span style="background:#E53E3E;color:#fff;border-radius:50%;width:16px;height:16px;font-size:10px;font-weight:700;display:inline-flex;align-items:center;justify-content:center">${mensajesNoLeidos(p.id,'admin')}</span>`:''}</button>`:''}
      </div>
    </div>`;
  }).join('');
  aplicarPermisosRol();
}

function verImagenAdmin(pedId){
  const p=pedPor(+pedId); if(!p||!p.comprobante) return;
  const ov=document.createElement('div');
  ov.className='admin-lightbox';
  ov.innerHTML=`<img src="${p.comprobante}" alt="Comprobante"><a class="admin-lightbox-dl" href="${p.comprobante}" download="comprobante-pedido-${p.id}.jpg" onclick="event.stopPropagation()">Descargar</a>`;
  ov.addEventListener('click',()=>ov.remove());
  document.body.appendChild(ov);
}
window.verImagenAdmin=verImagenAdmin;

async function cambiarEstadoPed(id,estado){
  const p=pedPor(id); if(!p) return;
  try{
    await apiPatch(`/api/pedidos/${id}/estado`,{estado});
    await refrescarEstado();
    renderPedidos(); renderProductos(); renderVentas(); renderDashboard();
    toast(`Pedido #${id} → ${estado}`);
  }catch(e){ toast(e.message||'No se pudo cambiar el estado','error'); renderPedidos(); }
}


function cancelarPed(id){
  openConfirm(`¿Cancelar el pedido #${id}? Si ya estaba aprobado, el stock se repondrá automáticamente.`,()=>cambiarEstadoPed(id,'cancelado'));
}

function pedidoOpcionesEstado(p){
  const mapa={pendiente:['aprobado','cancelado'],aprobado:['preparando','listo','enviado','entregado','cancelado'],preparando:['listo','enviado','entregado','cancelado'],listo:['enviado','entregado','cancelado'],enviado:['entregado']};
  return mapa[p.estado]||[];
}

function verPedidoAdmin(id){
  const p=pedPor(+id); if(!p) return;
  const c=cliPor(p.cliente_id)||{};
  const items=(p.items||[]).map(it=>{const pr=prodPor(it.producto_id),fotos=pr&&Array.isArray(pr.imagenes)?pr.imagenes:[],foto=(pr&&pr.imagen)||fotos[0]||it.imagen||'';return `<div class="order-detail-item">${foto?`<img src="${foto}" alt="">`:`<span>${esc((it.nombre||(pr&&pr.nombre)||'?')[0])}</span>`}<div><strong>${esc(it.nombre||(pr&&pr.nombre)||'Producto no disponible')}</strong><small>${it.cantidad} × ${dinero(it.precio)}</small></div><b>${dinero(it.subtotal)}</b></div>`}).join('');
  const mensajes=(DB.mensajes||[]).filter(m=>m.pedido_id===p.id).sort((a,b)=>new Date(a.fecha)-new Date(b.fecha));
  const opciones=pedidoOpcionesEstado(p);
  openModal(`Pedido #${p.id}`,`${esc(c.nombre||p.destinatario||'Cliente')} · ${fechaCorta(p.fecha)}`,`
    <div class="order-detail-toolbar"><span class="badge ${p.estado==='pendiente'?'b-warn':['enviado','entregado'].includes(p.estado)?'b-blue':p.estado==='cancelado'?'b-muted':'b-ok'}">${PEDIDO_ESTADO_LABEL[p.estado]||p.estado}</span><button class="btn btn-outline btn-sm" onclick="imprimirPedidoAdmin(${p.id})">${svgIcon('reporte',13)} Imprimir / PDF</button></div>
    <div class="order-detail-grid">
      <section class="order-detail-panel"><h4>Cliente y entrega</h4><dl><div><dt>Nombre</dt><dd>${esc(p.destinatario||c.nombre||'—')}</dd></div><div><dt>Teléfono</dt><dd>${esc(p.telefonoEntrega||c.telefono||'—')}</dd></div><div><dt>Correo</dt><dd>${esc(c.correo||'—')}</dd></div><div class="wide"><dt>Dirección</dt><dd>${esc(p.direccionEntrega||c.direccion||'—')}</dd></div></dl></section>
      <section class="order-detail-panel"><h4>Pago</h4><dl><div><dt>Método</dt><dd>${esc(PEDIDO_ESTADO_LABEL[p.metodoPago]||p.metodoPago||'—')}</dd></div><div><dt>Estado del pago</dt><dd>${esc((p.pagoEstado||'pendiente').replace(/_/g,' '))}</dd></div>${p.pagoReferencia?`<div class="wide"><dt>Referencia</dt><dd>${esc(p.pagoReferencia)}</dd></div>`:''}</dl>${p.comprobante?`<button class="btn btn-outline btn-sm" onclick="verImagenAdmin('${p.id}')">Ver comprobante</button>`:''}</section>
    </div>
    <section class="order-detail-panel"><h4>Artículos</h4><div class="order-detail-items">${items}</div><div class="order-detail-total"><span>Total de la orden</span><strong>${dinero(p.total)}</strong></div>${p.nota?`<div class="ped-nota">${svgIcon('info',13)} ${esc(p.nota)}</div>`:''}</section>
    ${opciones.length?`<section class="order-detail-panel"><h4>Actualizar avance</h4><div class="order-status-control"><select id="order-next-status"><option value="">Selecciona el nuevo estado…</option>${opciones.map(x=>`<option value="${x}">${PEDIDO_ESTADO_LABEL[x]}</option>`).join('')}</select><button class="btn btn-primary js-mutate" onclick="guardarEstadoPedidoAdmin(${p.id})">Guardar estado</button></div><p class="order-detail-hint">El cliente recibirá una notificación automática al cambiar el estado.</p></section>`:''}
    <section class="order-detail-panel"><h4>Observaciones y mensajes</h4><div class="order-message-list">${mensajes.length?mensajes.map(m=>`<div class="order-message ${m.autor==='admin'?'mine':''}"><strong>${m.autor==='admin'?'Tu equipo':'Cliente'}</strong><p>${esc(m.texto)}</p><small>${new Date(m.fecha).toLocaleString('es-HN')}</small></div>`).join(''):'<p class="order-detail-empty">Todavía no hay mensajes en este pedido.</p>'}</div>${p.estado!=='cancelado'?`<div class="order-message-compose"><textarea id="order-admin-note" rows="2" maxlength="2000" placeholder="Escribe una observación para el cliente…"></textarea><button class="btn btn-primary" onclick="enviarNotaPedidoAdmin(${p.id})">Enviar al cliente</button></div>`:''}</section>
  `,'920px');
  apiPatch(`/api/pedidos/${p.id}/mensajes/admin/leidos`,{}).catch(()=>{});
}
window.verPedidoAdmin=verPedidoAdmin;

async function guardarEstadoPedidoAdmin(id){
  const estado=$('#order-next-status')?.value;if(!estado){toast('Selecciona el nuevo estado','warn');return;}
  await cambiarEstadoPed(+id,estado);
  if(pedPor(+id)) verPedidoAdmin(+id);
}
window.guardarEstadoPedidoAdmin=guardarEstadoPedidoAdmin;

async function enviarNotaPedidoAdmin(id){
  const inp=$('#order-admin-note'),texto=(inp?.value||'').trim();if(!texto){toast('Escribe una observación','warn');return;}
  if(inp) inp.disabled=true;
  try{
    const r=await apiPostAuth(`/api/pedidos/${id}/mensajes/admin`,{texto});
    DB.mensajes=DB.mensajes||[];DB.mensajes.push(r.mensaje);if(r.revision!=null)DB._revision=r.revision;
    toast('Mensaje enviado al cliente');verPedidoAdmin(+id);
  }catch(e){toast(e.message||'No se pudo enviar el mensaje','error');if(inp)inp.disabled=false;}
}
window.enviarNotaPedidoAdmin=enviarNotaPedidoAdmin;

function imprimirPedidoAdmin(id){
  const p=pedPor(+id),c=p&&cliPor(p.cliente_id);if(!p)return;
  const filas=(p.items||[]).map(it=>{
    const pr=prodPor(it.producto_id);
    const fotos=pr&&Array.isArray(pr.imagenes)?pr.imagenes:[];
    const foto=(pr&&pr.imagen)||fotos[0]||it.imagen||'';
    const nombre=esc(it.nombre||(pr&&pr.nombre)||'Producto');
    const miniatura=foto?`<img src="${foto}" alt="">`:`<span class="ph">${nombre[0].toUpperCase()}</span>`;
    return `<tr><td><div class="prod-cell">${miniatura}${nombre}</div></td><td>${it.cantidad}</td><td>${dinero(it.precio)}</td><td>${dinero(it.subtotal)}</td></tr>`;
  }).join('');
  const w=window.open('','_blank','width=900,height=700');if(!w){toast('Permite ventanas emergentes para imprimir','warn');return;}
  w.document.write(`<!doctype html><html><head><title>Pedido ${p.id}</title><style>body{font:14px Arial;color:#12213a;padding:34px}header{display:flex;justify-content:space-between;border-bottom:3px solid #0b82c1;padding-bottom:18px}h1{margin:0}small{color:#718096}.box{border:1px solid #dbe4ec;border-radius:12px;padding:16px;margin-top:18px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{text-align:left;padding:10px;border-bottom:1px solid #e4eaf0}th{font-size:11px;text-transform:uppercase}.prod-cell{display:flex;align-items:center;gap:10px}.prod-cell img{width:40px;height:40px;border-radius:8px;object-fit:cover;flex:none}.prod-cell .ph{display:grid;place-items:center;width:40px;height:40px;border-radius:8px;background:#eef4f9;color:#0b82c1;font-weight:700;flex:none}.total{text-align:right;font-size:22px;font-weight:bold;margin-top:18px}@media print{button{display:none}}</style></head><body><header><div><h1>${esc(DB.config.nombre)}</h1><small>Orden de cliente SIWEPE</small></div><div><strong>Pedido #${p.id}</strong><br><small>${fechaCorta(p.fecha)}</small></div></header><section class="box grid"><div><small>CLIENTE</small><br><strong>${esc(p.destinatario||(c&&c.nombre)||'—')}</strong></div><div><small>TELÉFONO</small><br><strong>${esc(p.telefonoEntrega||(c&&c.telefono)||'—')}</strong></div><div style="grid-column:1/-1"><small>DIRECCIÓN</small><br><strong>${esc(p.direccionEntrega||(c&&c.direccion)||'—')}</strong></div><div><small>ESTADO</small><br>${esc(PEDIDO_ESTADO_LABEL[p.estado]||p.estado)}</div><div><small>PAGO</small><br>${esc(p.metodoPago||'—')}</div></section><section class="box"><table><thead><tr><th>Producto</th><th>Cantidad</th><th>Precio</th><th>Subtotal</th></tr></thead><tbody>${filas}</tbody></table><div class="total">Total: ${dinero(p.total)}</div></section><script>addEventListener('load',()=>setTimeout(()=>print(),150))<\/script></body></html>`);w.document.close();
}
window.imprimirPedidoAdmin=imprimirPedidoAdmin;

/* ── REPORTES ── */
let reporteActual='bajo';
let reporteFecha={desde:'',hasta:''};

function elegirReporte(tipo,el){
  reporteActual=tipo;
  $$('.report-tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  renderReporte();
}

function datosReporte(){
  const fD=reporteFecha.desde, fH=reporteFecha.hasta;
  const inRango = fecha => (!fD||fecha>=fD)&&(!fH||fecha<=fH);
  if(reporteActual==='bajo'){
    const filas=DB.productos.filter(p=>p.stock<=p.stock_min).map(p=>[p.codigo,p.nombre,(catPor(p.categoria_id)||{}).nombre||'—',p.stock,p.stock_min,dinero(p.stock*p.precio_compra),p.stock<=0?'Agotado':'Bajo stock']);
    return{titulo:'Productos con bajo stock',cols:['Código','Producto','Categoría','Stock','Mínimo','Valor','Estado'],filas};
  }
  if(reporteActual==='ventas'){
    const ventas=DB.ventas.filter(v=>ventaActiva(v)&&inRango(v.fecha));
    const filas=ventas.sort((a,b)=>b.fecha.localeCompare(a.fecha)).map(v=>[fechaCorta(v.fecha),(prodPor(v.producto_id)||{}).nombre||'—',(cliPor(v.cliente_id)||{}).nombre||'—',v.cantidad,dinero(v.precio),dinero(v.total)]);
    const total=ventas.reduce((s,v)=>s+v.total,0);
    return{titulo:'Reporte de ventas',cols:['Fecha','Producto','Cliente','Cantidad','Precio','Total'],filas,pie:['','','','','Total general',dinero(total)]};
  }
  if(reporteActual==='compras'){
    const compras=DB.compras.filter(c=>inRango(c.fecha));
    const filas=compras.sort((a,b)=>b.fecha.localeCompare(a.fecha)).map(c=>[fechaCorta(c.fecha),(prodPor(c.producto_id)||{}).nombre||'—',(provPor(c.proveedor_id)||{}).nombre||'—',c.cantidad,dinero(c.precio),dinero(c.cantidad*c.precio)]);
    const total=compras.reduce((s,c)=>s+c.cantidad*c.precio,0);
    return{titulo:'Reporte de compras',cols:['Fecha','Producto','Proveedor','Cantidad','Precio','Total'],filas,pie:['','','','','Total general',dinero(total)]};
  }
  if(reporteActual==='pedidos'){
    const peds=DB.pedidos.filter(p=>inRango(p.fecha));
    const filas=peds.sort((a,b)=>b.fecha.localeCompare(a.fecha)).map(p=>{ const c=cliPor(p.cliente_id); return [fechaCorta(p.fecha),`#${p.id}`,esc(c?c.nombre:'—'),p.items.length+' item(s)',dinero(p.total),p.estado]; });
    return{titulo:'Reporte de pedidos',cols:['Fecha','#','Cliente','Items','Total','Estado'],filas};
  }
  const filas=DB.productos.map(p=>[p.codigo,p.nombre,(catPor(p.categoria_id)||{}).nombre||'—',p.stock,dinero(p.precio_compra),dinero(p.precio_venta),dinero(p.stock*p.precio_compra),p.estado]);
  const valor=DB.productos.reduce((s,p)=>s+p.stock*p.precio_compra,0);
  return{titulo:'Inventario general',cols:['Código','Producto','Categoría','Stock','P. compra','P. venta','Valor','Estado'],filas,pie:['','','','','','','Valor total: '+dinero(valor),'']};
}

function renderReporte(){
  const r=datosReporte();
  $('#reporte-titulo').textContent=r.titulo;
  $('#reporte-meta').textContent=`${DB.config.nombre} · Generado el ${fechaCorta(hoy())} · ${r.filas.length} registro${r.filas.length!==1?'s':''}`;
  const cuerpo=r.filas.length?r.filas.map(f=>`<tr>${f.map(c=>`<td>${esc(String(c))}</td>`).join('')}</tr>`).join(''):`<tr class="empty-row"><td colspan="${r.cols.length}"><em>Sin datos</em></td></tr>`;
  const pie=r.pie?`<tr style="background:var(--accent-light);font-weight:700">${r.pie.map(c=>`<td>${esc(String(c))}</td>`).join('')}</tr>`:'';
  $('#reporte-tabla').innerHTML=`<table><thead><tr>${r.cols.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${cuerpo}${pie}</tbody></table>`;
}

function exportarPDF(){ toast('Preparando impresión…','warn'); setTimeout(()=>window.print(),400); }

function exportarCSV(){
  const r=datosReporte(); const sep=';';
  let csv='\uFEFF'+r.cols.join(sep)+'\n';
  csv+=r.filas.map(f=>f.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(sep)).join('\n');
  if(r.pie) csv+='\n'+r.pie.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(sep);
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download=`${r.titulo.toLowerCase().replace(/ /g,'_')}_${hoy()}.csv`;
  a.click(); URL.revokeObjectURL(a.href); toast('Exportado a CSV (Excel)');
}

/* ── CONFIGURACIÓN ── */
function renderConfig(){
  $('#cfg-nombre').value=DB.config.nombre;
  $('#cfg-moneda').value=DB.config.moneda;
  const logoEl=$('#cfg-logo-prev');
  if(logoEl) logoEl.innerHTML=DB.config.logo?`<img src="${DB.config.logo}" alt="" style="width:100%;height:100%;object-fit:contain;border-radius:8px">`:(DB.config.nombre||'B')[0].toUpperCase();
  $$('.paleta-btn').forEach(b=>b.classList.toggle('active',b.dataset.tema===(DB.config.tema||'rosado')));
  const pago=DB.config.pago||{};
  if($('#cfg-pago-banco'))   $('#cfg-pago-banco').value=pago.banco||'';
  if($('#cfg-pago-cuenta'))  $('#cfg-pago-cuenta').value=pago.cuenta||'';
  if($('#cfg-pago-titular')) $('#cfg-pago-titular').value=pago.titular||'';
  if($('#cfg-pago-tipo'))    $('#cfg-pago-tipo').value=pago.tipo||'';
  if($('#cfg-pago-nota'))    $('#cfg-pago-nota').value=pago.nota||'';
  renderBanners();
  renderPerfilEmpresa();
}

function guardarPago(){
  if(!DB.config.pago||typeof DB.config.pago!=='object') DB.config.pago={};
  DB.config.pago.banco=($('#cfg-pago-banco')?.value||'').trim();
  DB.config.pago.cuenta=($('#cfg-pago-cuenta')?.value||'').trim();
  DB.config.pago.titular=($('#cfg-pago-titular')?.value||'').trim();
  DB.config.pago.tipo=($('#cfg-pago-tipo')?.value||'').trim();
  DB.config.pago.nota=($('#cfg-pago-nota')?.value||'').trim();
  dbGuardar();
  toast('Datos de transferencia guardados');
}
window.guardarPago=guardarPago;

/* ── GALERÍA PÚBLICA DE LA TIENDA ── */
function renderGaleriaAdmin(){
  const el=$('#admin-galeria-grid'); if(!el) return;
  const gal=Array.isArray(DB.config.galeria)?DB.config.galeria:[];
  if(!gal.length){
    el.innerHTML=`<div class="admin-gallery-empty"><div class="admin-gallery-empty-ic">${svgIcon('mas',22)}</div><h3>Tu galería está lista para cobrar vida</h3><p>Sube fotografías reales de tu emprendimiento. Eso genera confianza y hace que la tienda se sienta única.</p><label class="btn btn-primary js-mutate">Agregar primeras fotos<input type="file" accept="image/*,.heic,.heif" multiple hidden onchange="subirGaleriaDesdeInput(this)"></label></div>`;
    return;
  }
  el.innerHTML=gal.map((g,i)=>`<article class="admin-gallery-card">
    <img src="${g.imagen}" alt="${esc(g.titulo||`Galería ${i+1}`)}">
    <div class="admin-gallery-card-overlay"><span>${i+1}</span><div><button onclick="editarGaleria(${i})" title="Editar texto">${svgIcon('lapiz',14)}</button><button onclick="borrarGaleria(${i})" title="Eliminar">${svgIcon('basura',14)}</button></div></div>
    <div class="admin-gallery-card-copy"><strong>${esc(g.titulo||'Sin título')}</strong><span>${esc(g.descripcion||'Agrega una breve historia a esta foto')}</span></div>
  </article>`).join('');
}

async function agregarFotosGaleria(files){
  if(bsRole()!=='admin'){ toast('Tu rol es de consulta; un administrador debe publicar las fotos.','warn'); return; }
  const lista=[...files]; if(!lista.length) return;
  if(!Array.isArray(DB.config.galeria)) DB.config.galeria=[];
  if(DB.config.galeria.length+lista.length>12){ toast('La galería admite hasta 12 fotografías','warn'); return; }
  const pesoEntrada=lista.reduce((n,f)=>n+(f.size||0),0);
  if(pesoEntrada>36*1024*1024){ toast('El grupo de fotografías supera 36 MB. Súbelas en dos tandas.','warn'); return; }
  toast(`Optimizando ${lista.length} fotografía${lista.length!==1?'s':''}…`);
  const anterior=DB.config.galeria.map(g=>({...g}));
  try{
    const imgs=[];
    for(const f of lista) imgs.push(await comprimirImagen(f,1200,0.72));
    const pesoEstimado=[...DB.config.galeria.map(g=>g.imagen||''),...imgs].reduce((n,s)=>n+Math.ceil((s.length||0)*0.75),0);
    if(pesoEstimado>20*1024*1024) throw new Error('La galería completa superaría 20 MB. Elimina una foto o usa imágenes más livianas.');
    const ahora=Date.now();
    DB.config.galeria.push(...imgs.map((imagen,i)=>({id:ahora+i,imagen,titulo:'',descripcion:''})));
    renderGaleriaAdmin();
    await guardarGaleriaServidor();
    toast(`${imgs.length} fotografía${imgs.length!==1?'s':''} publicada${imgs.length!==1?'s':''}`);
  }catch(err){ DB.config.galeria=anterior; renderGaleriaAdmin(); toast(err?.message||errImagen(err),'error'); }
}
function subirGaleriaDesdeInput(inp){ const files=[...(inp.files||[])]; inp.value=''; agregarFotosGaleria(files); }
async function guardarGaleriaServidor(){
  const r=await apiPut('/api/galeria',{galeria:DB.config.galeria});
  DB.config.galeria=r.galeria||DB.config.galeria;
  if(r.revision!=null) DB._revision=r.revision;
  try{ almacen.escribir(JSON.stringify(DB)); }catch(e){}
  renderGaleriaAdmin();
}
function borrarGaleria(i){
  if(bsRole()!=='admin'){ toast('Tu rol es de consulta.','warn'); return; }
  openConfirm('¿Quitar esta fotografía de la galería pública?',async()=>{
    const anterior=DB.config.galeria.map(g=>({...g}));
    DB.config.galeria.splice(i,1); renderGaleriaAdmin();
    try{ await guardarGaleriaServidor(); toast('Fotografía eliminada'); }
    catch(e){ DB.config.galeria=anterior; renderGaleriaAdmin(); toast(e.message||'No se pudo eliminar la fotografía','error'); }
  });
}
function editarGaleria(i){
  if(bsRole()!=='admin'){ toast('Tu rol es de consulta.','warn'); return; }
  const g=DB.config.galeria[i]; if(!g) return;
  openModal('Editar fotografía','El texto ayuda a contar la historia de tu negocio.',`<div class="form-grid"><div class="field span2"><label>Título</label><input id="fg-titulo" maxlength="80" value="${esc(g.titulo||'')}" placeholder="Ej: Hecho a mano con dedicación"></div><div class="field span2"><label>Descripción</label><textarea id="fg-desc" maxlength="180" rows="3" placeholder="Cuenta brevemente qué muestra esta foto">${esc(g.descripcion||'')}</textarea></div></div><div class="modal-footer"><button class="btn btn-primary" onclick="guardarTextoGaleria(${i})">Guardar</button></div>`);
}
async function guardarTextoGaleria(i){
  const g=DB.config.galeria[i]; if(!g) return;
  const anterior={...g}; g.titulo=($('#fg-titulo')?.value||'').trim(); g.descripcion=($('#fg-desc')?.value||'').trim();
  closeModal(); renderGaleriaAdmin();
  try{ await guardarGaleriaServidor(); toast('Texto actualizado'); }
  catch(e){ DB.config.galeria[i]=anterior; renderGaleriaAdmin(); toast(e.message||'No se pudo actualizar el texto','error'); }
}
window.subirGaleriaDesdeInput=subirGaleriaDesdeInput; window.borrarGaleria=borrarGaleria; window.editarGaleria=editarGaleria; window.guardarTextoGaleria=guardarTextoGaleria;

$('#galeria-inp')?.addEventListener('change',e=>{ const files=[...(e.target.files||[])]; e.target.value=''; agregarFotosGaleria(files); });

/* ── BANNERS / CARRUSEL DE LA TIENDA ── */
function renderBanners(){
  const el=$('#banners-grid'); if(!el) return;
  const b=DB.config.banners||[];
  if(!b.length){ el.innerHTML=`<div class="banners-empty">Aún no hay imágenes. Agrega la primera para activar el carrusel.</div>`; return; }
  el.innerHTML=b.map((src,i)=>`
    <div class="banner-item">
      <span class="banner-num">${i+1}</span>
      <button class="banner-del" title="Quitar" onclick="borrarBanner(${i})">${svgIcon('basura',14)}</button>
      <img src="${src}" alt="Banner ${i+1}">
    </div>`).join('');
}

function borrarBanner(i){
  openConfirm('Se quitará esta imagen del carrusel.',()=>{
    DB.config.banners.splice(i,1); dbGuardar(); renderBanners(); toast('Imagen eliminada');
  });
}

$('#cfg-banner-inp')?.addEventListener('change',e=>{
  const f=e.target.files[0]; if(!f) return;
  e.target.value='';
  if(!f.type.startsWith('image/')&&!/\.(heic|heif)$/i.test(f.name||'')){ toast('Selecciona un archivo de imagen','warn'); return; }
  toast('Procesando imagen…');
  comprimirImagen(f,1600,0.82).then(dataUrl=>{
    if(!Array.isArray(DB.config.banners)) DB.config.banners=[];
    DB.config.banners.push(dataUrl);
    if(dbGuardar()){ renderBanners(); toast('Imagen agregada al carrusel'); }
    else { DB.config.banners.pop(); }
  }).catch(err=>toast(errImagen(err),'error'));
});

/* ── PERFIL PÚBLICO DE LA EMPRESA (tabla empresas, separada de DB.config) ── */
let _miEmpresaSlug='';
async function renderPerfilEmpresa(){
  const msg=$('#perfil-msg');
  try{
    const perfil = await apiGet('/api/empresas/mi');
    _miEmpresaSlug = perfil.slug || _miEmpresaSlug;
    const tiposNegocio=new Set(perfil.tiposNegocio||[]);
    $$('#perfil-tipos input[type="checkbox"]').forEach(x=>{ x.checked=tiposNegocio.has(x.value); });
    if($('#perfil-rubro'))        $('#perfil-rubro').value=perfil.rubro||'';
    if($('#perfil-telefono'))     $('#perfil-telefono').value=perfil.telefono||'';
    if($('#perfil-contacto'))     $('#perfil-contacto').value=perfil.contactoPublico||'';
    if($('#perfil-correo-publico')) $('#perfil-correo-publico').value=perfil.correoPublico||'';
    if($('#perfil-pais'))         $('#perfil-pais').value=perfil.pais||'';
    if($('#perfil-ciudad'))       $('#perfil-ciudad').value=perfil.ciudad||'';
    if($('#perfil-descripcion'))  $('#perfil-descripcion').value=perfil.descripcion||'';
    if(msg) msg.textContent='';
  }catch(e){
    if(msg) msg.textContent='No se pudo cargar el perfil público (' + (e.message||'sin conexión') + ').';
  }
}

/* Abre el portal de cliente de MI tienda (no la tienda.html pelada, que no
   sabe de qué negocio es y termina mandando al marketplace).
   La pestaña se abre YA, de forma sincrónica dentro del click (si no, el
   navegador la bloquea como popup por abrirse después de un await) y recién
   después se le pone la URL final una vez que se sabe el slug. */
function abrirPortalCliente(){
  const w = window.open('', '_blank');
  (async ()=>{
    let slug=_miEmpresaSlug;
    if(!slug){
      try{ const perfil=await apiGet('/api/empresas/mi'); slug=perfil.slug||''; _miEmpresaSlug=slug; }catch(e){}
    }
    if(w) w.location.href = 'tienda.html'+(slug?('?e='+encodeURIComponent(slug)):'');
  })();
}
window.abrirPortalCliente=abrirPortalCliente;

async function guardarPerfilEmpresa(){
  const msg=$('#perfil-msg');
  const datos={
    nombre: DB.config.nombre,
    logo: DB.config.logo||'',
    tiposNegocio: $$('#perfil-tipos input[type="checkbox"]:checked').map(x=>x.value),
    rubro: ($('#perfil-rubro')?.value||'').trim(),
    telefono: ($('#perfil-telefono')?.value||'').trim(),
    contactoPublico: ($('#perfil-contacto')?.value||'').trim(),
    correoPublico: ($('#perfil-correo-publico')?.value||'').trim(),
    pais: ($('#perfil-pais')?.value||'').trim(),
    ciudad: ($('#perfil-ciudad')?.value||'').trim(),
    descripcion: ($('#perfil-descripcion')?.value||'').trim()
  };
  try{
    await apiPut('/api/empresas/mi', datos);
    if(msg) msg.textContent='Perfil actualizado — ya se ve así en siwepe.shop.';
    toast('Perfil de la empresa actualizado');
  }catch(e){
    if(msg) msg.textContent=e.message||'No se pudo guardar el perfil.';
    toast('No se pudo guardar el perfil','error');
  }
}
window.guardarPerfilEmpresa=guardarPerfilEmpresa;

function guardarConfig(){
  const nombre=$('#cfg-nombre').value.trim();
  if(!nombre){ toast('El nombre es obligatorio','error'); return; }
  DB.config.nombre=nombre; DB.config.moneda=$('#cfg-moneda').value;
  dbGuardar(); renderDashboard();
  const sbN=$('#sb-nombre'); if(sbN) sbN.textContent=nombre;
  document.title=`${nombre} · Admin`;
  aplicarLogo();
  toast('Configuración guardada');
}

/* ── TEMAS ── (el motor TEMAS/aplicarTema vive en shared/data.js y aplica a tienda + admin) */
document.addEventListener('click',e=>{
  const pb=e.target.closest('.paleta-btn');
  if(pb){
    DB.config.tema=pb.dataset.tema; dbGuardar();
    $$('.paleta-btn').forEach(b=>b.classList.toggle('active',b===pb));
    aplicarTema(pb.dataset.tema);
    toast('Tema aplicado');
  }
});

$('#cfg-logo-inp')?.addEventListener('change',e=>{
  const f=e.target.files[0]; if(!f) return;
  if(!f.type.startsWith('image/')){ toast('Selecciona un archivo de imagen','warn'); return; }
  comprimirImagen(f,256,0.85).then(dataUrl=>{
    DB.config.logo=dataUrl;
    if(dbGuardar()){
      const prev=$('#cfg-logo-prev'); if(prev) prev.innerHTML=`<img src="${dataUrl}" alt="" style="width:100%;height:100%;object-fit:contain;border-radius:8px">`;
      aplicarLogo();
      toast('Logo actualizado');
    }
  }).catch(err=>toast(errImagen(err),'error'));
});

/* ── SEARCH ── */
$('#topbar-search-inp')?.addEventListener('input',e=>{
  const q=e.target.value.trim().toLowerCase();
  const res=$('#topbar-search-res');
  if(q.length<2){ res.classList.remove('open'); return; }
  const prods=DB.productos.filter(p=>p.nombre.toLowerCase().includes(q)||p.codigo.toLowerCase().includes(q)).slice(0,6);
  res.innerHTML=prods.length?prods.map(p=>`<div class="search-result-item" onclick="searchGoTo(${p.id})"><span>${esc(p.nombre)}</span><small>${esc(p.codigo)} · ${p.stock} uds</small></div>`).join(''):`<div class="search-result-item" style="color:var(--text-muted)">Sin resultados</div>`;
  res.classList.add('open');
});
document.addEventListener('click',e=>{ if(!e.target.closest('.topbar-search')) $('#topbar-search-res')?.classList.remove('open'); });

function searchGoTo(id){
  $('#topbar-search-res')?.classList.remove('open');
  $('#topbar-search-inp').value='';
  goTo('productos');
  const pq=$('#filtro-prod-q'); if(pq){ pq.value=(prodPor(id)||{}).nombre||''; renderProductos(); }
}

/* ── LOGO Y TEMA GLOBALES ── */
function aplicarLogo(){
  const logo=DB.config.logo, nombre=DB.config.nombre||'B';
  const inner=logo?`<img src="${logo}" alt="" style="width:100%;height:100%;object-fit:contain;border-radius:inherit">`:`<span style="font-family:'Fraunces',serif;font-weight:700">${nombre[0].toUpperCase()}</span>`;
  $$('#sb-logo,#login-logo').forEach(el=>{ if(el) el.innerHTML=inner; });
}

function aplicarPermisosRol(){
  const soloLectura=bsRole()==='proveedor';
  document.body.dataset.role=soloLectura?'proveedor':'admin';
  let aviso=document.getElementById('role-readonly-note');
  if(soloLectura&&!aviso){
    aviso=document.createElement('div'); aviso.id='role-readonly-note';
    aviso.textContent='Vista de proveedor · consulta sin permisos de edición';
    document.body.appendChild(aviso);
  }
  const patron=/openForm|save|guardar|eliminar|borrar|toggle|ajuste|aprobar|cancelar|cambiarEstado|enviarMensajeAdmin|Quitar logo/i;
  document.querySelectorAll('[onclick]').forEach(el=>{
    if(soloLectura&&patron.test(el.getAttribute('onclick')||'')){
      el.disabled=true; el.setAttribute('aria-disabled','true'); el.title='Tu rol es de solo lectura';
    }
  });
  document.querySelectorAll('input[type="file"]').forEach(el=>{ el.disabled=soloLectura; });
}

/* ── RENDER ALL ── */
function renderAll(){
  updateCatFilters();
  renderProductos();
  renderCategorias();
  renderGaleriaAdmin();
  renderInventario();
  renderProveedores();
  renderClientes();
  renderAdministradores();
  renderCompras();
  renderVentas();
  renderMovimientos();
  renderPedidos();
  renderConfig();
  renderReporte();
  const nombre=DB.config.nombre;
  const sbNombre=$('#sb-nombre'); if(sbNombre) sbNombre.textContent=nombre;
  document.title=`${nombre} · Admin`;
  aplicarLogo();
  aplicarTema(DB.config.tema||'rosado');
  aplicarPermisosRol();
}

/* ── REFRESCO EN VIVO (pedidos y chat, sin recargar) ── */
function iniciarPollAdmin(){
  setInterval(async ()=>{
    // No interrumpir si hay un modal abierto (estás editando/creando)
    if(document.getElementById('modal-overlay')?.classList.contains('open')) return;
    const ok = await refrescarEstado();
    if(!ok) return;
    // Badge de pedidos pendientes (siempre)
    const pend = DB.pedidos.filter(p=>p.estado==='pendiente').length;
    const badge = $('#pedidos-badge'); if(badge){ badge.textContent=pend||''; badge.style.display=pend?'flex':'none'; }
    // Re-render de la página visible si es pedidos (lo más importante en vivo)
    const activa = document.querySelector('.page.active')?.id;
    if(activa==='page-pedidos') renderPedidos();
    // Chat del admin abierto → refrescar mensajes
    const chatOv = document.getElementById('admin-chat-overlay');
    if(chatOv && chatOv.style.display!=='none' && adminChatPedidoId) renderAdminChatMsgs();
  }, 4000);
}

/* Carga el estado y muestra el dashboard (llamado con sesión ya válida) */
async function iniciarPanelAdmin(){
  try{
    await bootstrapDB();
  }catch(e){
    // El token no sirve para ningún negocio (vencido, revocado, o es una
    // cuenta sin empresa asociada como el admin de plataforma). No hay un
    // "panel general" al que entrar con esa cuenta — se vuelve al login.
    mostrarPanelLogin();
    const lp=$('#login-page'); if(lp) lp.style.display='flex';
    const ap=$('#admin-app'); if(ap) ap.style.display='none';
    const errEl=$('#login-error'); if(errEl) errEl.textContent='Tu sesión ya no es válida para ningún negocio. Iniciá sesión de nuevo.';
    return;
  }
  try{ localStorage.setItem('bs_sesion_admin','1'); }catch(e){}
  const lp=$('#login-page'); if(lp) lp.style.display='none';
  const ap=$('#admin-app'); if(ap) ap.style.display='grid';
  renderAll(); goTo('dashboard');
  iniciarPollAdmin();
}

/* ── INICIALIZAR ── */
let _controlesAdminVinculados=false;
function vincularControlesAdmin(){
  if(_controlesAdminVinculados) return;
  _controlesAdminVinculados=true;
  $('#modal-close')?.addEventListener('click',closeModal);
  $('#confirm-si')?.addEventListener('click',()=>{ if(_modalConfirmFn) _modalConfirmFn(); closeConfirm(); });
  $('#confirm-no')?.addEventListener('click',closeConfirm);
  $$('.sb-item').forEach(b=>b.addEventListener('click',()=>goTo(b.dataset.page)));
  $('#topbar-menu-btn')?.addEventListener('click',openSidebar);
  $('#mobile-veil')?.addEventListener('click',closeSidebar);
  ['filtro-prod-q','filtro-prod-cat','filtro-prod-est'].forEach(id=>document.getElementById(id)?.addEventListener('input',renderProductos));
  const bindMov=(id,key)=>document.getElementById(id)?.addEventListener('input',e=>{ movFiltros[key]=e.target.value.trim().toLowerCase(); renderMovimientos(); });
  bindMov('filtro-mov-q','q'); bindMov('filtro-mov-tipo','tipo');
  document.getElementById('filtro-mov-desde')?.addEventListener('change',e=>{ movFiltros.desde=e.target.value; renderMovimientos(); });
  document.getElementById('filtro-mov-hasta')?.addEventListener('change',e=>{ movFiltros.hasta=e.target.value; renderMovimientos(); });
  document.getElementById('filtro-ven-desde')?.addEventListener('change',e=>{ venFiltros.desde=e.target.value; renderVentas(); });
  document.getElementById('filtro-ven-hasta')?.addEventListener('change',e=>{ venFiltros.hasta=e.target.value; renderVentas(); });
  document.getElementById('filtro-ven-limpiar')?.addEventListener('click',()=>{ venFiltros={desde:'',hasta:''}; ['filtro-ven-desde','filtro-ven-hasta'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; }); renderVentas(); });
  document.getElementById('filtro-com-desde')?.addEventListener('change',e=>{ comFiltros.desde=e.target.value; renderCompras(); });
  document.getElementById('filtro-com-hasta')?.addEventListener('change',e=>{ comFiltros.hasta=e.target.value; renderCompras(); });
  document.getElementById('filtro-com-limpiar')?.addEventListener('click',()=>{ comFiltros={desde:'',hasta:''}; ['filtro-com-desde','filtro-com-hasta'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; }); renderCompras(); });
  document.getElementById('filtro-mov-limpiar')?.addEventListener('click',()=>{ movFiltros={q:'',tipo:'',desde:'',hasta:''}; ['filtro-mov-q','filtro-mov-tipo','filtro-mov-desde','filtro-mov-hasta'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; }); renderMovimientos(); });
  document.getElementById('rpt-desde')?.addEventListener('change',e=>{ reporteFecha.desde=e.target.value; renderReporte(); });
  document.getElementById('rpt-hasta')?.addEventListener('change',e=>{ reporteFecha.hasta=e.target.value; renderReporte(); });
  document.getElementById('filtro-ped-estado')?.addEventListener('change',renderPedidos);
  window.addEventListener('storage',e=>{
    if(e.key==='siwepe_pro_v1'){
      dbCargar(); renderPedidos(); renderDashboard(); renderInventario();
      const badge=$('#pedidos-badge'),n=DB.pedidos.filter(p=>p.estado==='pendiente').length;
      if(badge){ badge.textContent=n||''; badge.style.display=n?'flex':'none'; }
    }
  });
}

function avisarAccionBloqueada(){
  let aviso=document.getElementById('admin-blocked-action');
  if(!aviso){ aviso=document.createElement('div'); aviso.id='admin-blocked-action'; aviso.innerHTML=`${svgIcon('alerta',18)}<div><strong>Acción bloqueada en esta pestaña</strong><span>Este panel protege el acceso administrativo.</span></div>`; document.body.appendChild(aviso); }
  aviso.classList.remove('show'); void aviso.offsetWidth; aviso.classList.add('show');
  clearTimeout(avisarAccionBloqueada._t); avisarAccionBloqueada._t=setTimeout(()=>aviso.classList.remove('show'),2600);
}

document.addEventListener('DOMContentLoaded', async ()=>{
  /* Se vincula antes de cualquier retorno por login/reset. Así, después de
     iniciar sesión el panel queda navegable sin tener que recargar. */
  vincularControlesAdmin();
  /* Login */
  $('#btn-login')?.addEventListener('click',submitLoginAdmin);
  $('#login-pass')?.addEventListener('keydown',e=>{ if(e.key==='Enter') submitLoginAdmin(); });
  $('#btn-mostrar-olvide')?.addEventListener('click',mostrarPanelOlvide);
  $('#btn-volver-login')?.addEventListener('click',mostrarPanelLogin);
  $('#btn-olvide')?.addEventListener('click',submitOlvide);
  $('#olvide-email')?.addEventListener('keydown',e=>{ if(e.key==='Enter') submitOlvide(); });
  $('#btn-reset')?.addEventListener('click',submitReset);
  $('#reset-pass2')?.addEventListener('keydown',e=>{ if(e.key==='Enter') submitReset(); });

  /* Después de verificar una empresa, el backend entrega un código de un solo
     uso. Se canjea aquí por el JWT y se abre el panel sin volver a pedir las
     mismas credenciales. El JWT nunca viaja dentro de la URL. */
  const onboardingCode=new URLSearchParams(location.search).get('onboarding');
  if(onboardingCode){
    const lp=$('#login-page'); if(lp) lp.style.display='flex';
    const errEl=$('#login-error'); if(errEl) errEl.textContent='Activando tu empresa y preparando el panel…';
    try{
      const {token,user,slug}=await apiPost('/api/auth/onboarding',{code:onboardingCode});
      guardarSesionToken(token,user.role,user.nombre);
      try{localStorage.setItem('bs_empresa',slug);localStorage.setItem('bs_sesion_admin','1');}catch(e){}
      history.replaceState({},'',`admin.html?e=${encodeURIComponent(slug)}&activated=1`);
    }catch(e){
      history.replaceState({},'','admin.html');
      mostrarPanelLogin(); if(lp) lp.style.display='flex';
      if(errEl) errEl.textContent=e.message||'No pudimos abrir el panel automáticamente. Iniciá sesión con la contraseña que acabás de crear.';
      return;
    }
  }

  /* Enlace de recuperación de contraseña (?reset=token en la URL, del correo) */
  if(new URLSearchParams(location.search).get('reset')){
    mostrarPanelReset();
    const lp=$('#login-page'); if(lp) lp.style.display='flex';
    return;
  }

  /* "Iniciar sesión" desde index.html (?login=1): siempre debe llevar al
     formulario de login, aunque quede una sesión vieja guardada en este
     navegador (de otra tienda que se probó antes) — no continuar con esa
     sesión en silencio, cerrar y pedir credenciales de nuevo. */
  if(new URLSearchParams(location.search).get('login')){
    limpiarSesionToken();
    try{ localStorage.removeItem('bs_sesion_admin'); }catch(e){}
    history.replaceState({}, '', 'admin.html');
    mostrarPanelLogin();
    const lp=$('#login-page'); if(lp) lp.style.display='flex';
    return;
  }

  /* Control de acceso: se requiere sesión (token) de admin o proveedor.
     Sin token válido se muestra el login de este mismo panel. */
  const token=(()=>{ try{ return localStorage.getItem('bs_token')||''; }catch(e){ return ''; } })();
  const role=(()=>{ try{ return localStorage.getItem('bs_role')||''; }catch(e){ return ''; } })();
  if(!token || (role!=='admin' && role!=='proveedor')){
    const lp=$('#login-page'); if(lp) lp.style.display='flex';
    return;
  }

  await iniciarPanelAdmin();

  /* Los controles ya quedaron vinculados al inicio, incluso si esta carga
     comenzó mostrando el login. */
});

/* ── CHAT ADMIN ── */
let adminChatPedidoId=null;

function abrirChatAdmin(pedId){
  adminChatPedidoId=pedId;
  // Crear panel si no existe
  let overlay=document.getElementById('admin-chat-overlay');
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='admin-chat-overlay';
    overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:500;display:flex;align-items:flex-end;justify-content:flex-end;padding:24px;';
    overlay.innerHTML=`
      <div style="background:var(--surface);border-radius:20px;width:360px;max-width:calc(100vw - 32px);max-height:80vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.2);overflow:hidden;">
        <div style="padding:16px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;border-radius:50%;background:var(--accent-light);display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--accent);font-size:15px" id="admin-chat-av">A</div>
          <div><strong id="admin-chat-cli" style="font-size:14px;color:var(--text-primary);display:block">Cliente</strong><span id="admin-chat-sub" style="font-size:12px;color:var(--text-muted)">Pedido</span></div>
          <button onclick="cerrarChatAdmin()" style="margin-left:auto;background:none;border:none;cursor:pointer;color:var(--text-muted);padding:4px;border-radius:6px;font-size:18px;line-height:1">×</button>
        </div>
        <div id="admin-chat-msgs" style="flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:8px;min-height:200px;"></div>
        <div id="admin-chat-input-wrap" style="padding:12px 16px;border-top:1px solid var(--border);display:flex;gap:8px;align-items:flex-end;">
          <textarea id="admin-chat-input" placeholder="Responder al cliente…" rows="1" maxlength="2000" style="flex:1;padding:9px 12px;border-radius:12px;border:1.5px solid var(--border);background:var(--surface-2);color:var(--text-primary);font-size:13.5px;resize:none;outline:none;font-family:inherit;line-height:1.4;max-height:100px;"></textarea>
          <button onclick="enviarMensajeAdmin()" style="width:38px;height:38px;border-radius:50%;background:var(--accent);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <svg width="14" height="14" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="m22 2-11 11"/><path d="M22 2 15 22 11 13 2 9l20-7z"/></svg>
          </button>
        </div>
        <div id="admin-chat-closed" style="display:none;text-align:center;padding:14px;background:var(--surface-2);font-size:12.5px;color:var(--text-muted);border-top:1px solid var(--border);">Pedido cancelado · Chat cerrado</div>
      </div>`;
    overlay.addEventListener('click',e=>{ if(e.target===overlay) cerrarChatAdmin(); });
    document.body.appendChild(overlay);
    document.getElementById('admin-chat-input')?.addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); enviarMensajeAdmin(); } });
  }

  overlay.style.display='flex';
  renderAdminChatMsgs();
  (DB.mensajes||[]).filter(m=>m.pedido_id===pedId&&m.autor==='cliente').forEach(m=>m.leido=true);
  apiPatch(`/api/pedidos/${pedId}/mensajes/admin/leidos`,{}).catch(()=>{});
  setTimeout(renderPedidos,100);
}

function cerrarChatAdmin(){
  const ov=document.getElementById('admin-chat-overlay');
  if(ov) ov.style.display='none';
  adminChatPedidoId=null;
}

function renderAdminChatMsgs(){
  if(!adminChatPedidoId) return;
  dbCargar();
  const ped=pedPor(adminChatPedidoId); if(!ped) return;
  const cli=cliPor(ped.cliente_id);
  const cerrado=ped.estado==='cancelado';

  const avEl=document.getElementById('admin-chat-av');
  if(avEl) avEl.textContent=(cli?cli.nombre:'C')[0].toUpperCase();
  const cliEl=document.getElementById('admin-chat-cli');
  if(cliEl) cliEl.textContent=cli?cli.nombre:'Cliente';
  const subEl=document.getElementById('admin-chat-sub');
  if(subEl) subEl.textContent=`Pedido #${ped.id} · ${ped.estado}`;

  const wrap=document.getElementById('admin-chat-input-wrap');
  const closed=document.getElementById('admin-chat-closed');
  if(cerrado){ if(wrap) wrap.style.display='none'; if(closed) closed.style.display='block'; }
  else { if(wrap) wrap.style.display='flex'; if(closed) closed.style.display='none'; }

  const cont=document.getElementById('admin-chat-msgs'); if(!cont) return;
  const msgs=msgsDePedido(adminChatPedidoId);
  if(!msgs.length){
    cont.innerHTML='<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:13px">Sin mensajes aún.</div>';
    return;
  }
  cont.innerHTML=msgs.map(m=>{
    const isMine=m.autor==='admin';
    const t=new Date(m.fecha).toLocaleTimeString('es-HN',{hour:'2-digit',minute:'2-digit'});
    const bg=isMine?'var(--accent)':'var(--surface-2)';
    const color=isMine?'#fff':'var(--text-primary)';
    const align=isMine?'flex-end':'flex-start';
    const br=isMine?'14px 14px 4px 14px':'14px 14px 14px 4px';
    return `<div style="max-width:78%;display:flex;flex-direction:column;gap:2px;align-self:${align};align-items:${align};">
      <div style="padding:9px 13px;border-radius:${br};font-size:13.5px;line-height:1.45;word-break:break-word;background:${bg};color:${color}">${esc(m.texto)}</div>
      <span style="font-size:10.5px;color:var(--text-muted);padding:0 2px">${t}</span>
    </div>`;
  }).join('');
  cont.scrollTop=cont.scrollHeight;
}

async function enviarMensajeAdmin(){
  const inp=document.getElementById('admin-chat-input'); if(!inp||!adminChatPedidoId) return;
  const texto=inp.value.trim(); if(!texto) return;
  const ped=pedPor(adminChatPedidoId); if(!ped||ped.estado==='cancelado') return;
  inp.disabled=true;
  try{
    const r=await apiPostAuth(`/api/pedidos/${adminChatPedidoId}/mensajes/admin`,{texto});
    DB.mensajes=DB.mensajes||[];DB.mensajes.push(r.mensaje);if(r.revision!=null)DB._revision=r.revision;
    inp.value='';renderAdminChatMsgs();renderPedidos();
  }catch(e){toast(e.message||'No se pudo enviar el mensaje','error');}
  finally{inp.disabled=false;inp.focus();}
}
