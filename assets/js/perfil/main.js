/* SIWEPE — portal global del cliente */
(() => {
  'use strict';
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeImage = v => /^(?:https:\/\/|data:image\/(?:png|jpe?g|webp|gif);base64,)/i.test(String(v || '')) ? String(v) : '';
  const statusText = { pendiente:'Pendiente', aprobado:'Confirmado', preparando:'Preparando', listo:'Listo', enviado:'Enviado', entregado:'Entregado', cancelado:'Cancelado' };
  let profile = null;
  let orders = [];
  let activeStatus = 'todos';
  let activeSection = 'resumen';
  let toastTimer = null;

  function storeRef(){
    const p = new URLSearchParams(location.search);
    return p.get('e') || p.get('empresa') || p.get('tienda') || bsEmpresa() || '';
  }
  function storeUrl(slug){ return `tienda.html${slug ? `?e=${encodeURIComponent(slug)}` : ''}`; }
  function money(order, value){ return `${esc(order.empresa?.moneda || 'L')} ${Number(value || 0).toLocaleString('es-HN',{minimumFractionDigits:2,maximumFractionDigits:2})}`; }
  function dateText(v){
    if(!v) return 'Sin fecha';
    const d = new Date(String(v).length === 10 ? `${v}T12:00:00` : v);
    return Number.isNaN(d.getTime()) ? esc(v) : d.toLocaleDateString('es-HN',{day:'numeric',month:'long',year:'numeric'});
  }
  function initials(name){ return String(name || 'SI').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase(); }
  function toast(message, error=false){
    const el=$('#toast'); el.textContent=message; el.classList.toggle('error',error); el.classList.add('show');
    clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2800);
  }
  function icon(id){ return `<svg aria-hidden="true"><use href="#${id}"/></svg>`; }
  function empty(iconId,title,text,button=''){
    return `<div class="empty">${icon(iconId)}<h3>${esc(title)}</h3><p>${esc(text)}</p>${button}</div>`;
  }

  function showGate(){
    $('#profile-app').hidden=true; $('#access-gate').hidden=false;
    $('#gate-login').onclick=()=>location.href=storeUrl(storeRef());
  }
  function goStore(slug){ location.href=storeUrl(slug || storeRef()); }
  function logout(){ limpiarSesionToken(); try{localStorage.removeItem('bs_sesion_cli')}catch(e){} location.href=storeUrl(storeRef()); }

  function navigate(section){
    activeSection=section;
    $('#order-detail').hidden=true;
    $$('.content-section').forEach(x=>x.classList.toggle('active',x.dataset.view===section));
    $$('.profile-nav button').forEach(x=>x.classList.toggle('active',x.dataset.section===section));
    window.scrollTo({top:0,behavior:'smooth'});
    if(section==='pedidos') renderOrders();
    if(section==='direcciones') renderAddresses();
  }

  function renderIdentity(){
    const ini=initials(profile.nombre);
    $('#side-avatar').textContent=ini; $('.avatar.mini').textContent=ini;
    $('#side-name').textContent=profile.nombre || 'Cliente SIWEPE';
    $('#side-email').textContent=profile.correo || '';
    $('#welcome-title').textContent=`Qué gusto verte, ${(profile.nombre || 'Cliente').split(/\s+/)[0]}`;
    $('#header-user strong').textContent=(profile.nombre || 'Mi cuenta').split(/\s+/)[0];
    $('#nav-orders').textContent=orders.length;
    const noLeidos=orders.reduce((n,o)=>n+(o.mensajes||[]).filter(m=>m.autor==='admin'&&!m.leido).length,0);
    $('#notification-count').textContent=noLeidos;
    $('#profile-notifications').classList.toggle('has-news',noLeidos>0);
  }
  function renderStats(){
    const pending=orders.filter(x=>['pendiente','aprobado','preparando','listo','enviado'].includes(x.estado)).length;
    const delivered=orders.filter(x=>x.estado==='entregado').length;
    const stores=new Set(orders.map(x=>x.empresa?.id).filter(Boolean)).size;
    $('#profile-stats').innerHTML=[
      ['i-bag','',orders.length,'Pedidos totales'],
      ['i-truck','amber',pending,'En curso'],
      ['i-check','green',delivered,'Entregados'],
      ['i-store','violet',stores,'Tiendas visitadas'],
    ].map(([ic,color,value,label])=>`<article class="stat-card"><span class="stat-icon ${color}">${icon(ic)}</span><div><strong>${value}</strong><small>${label}</small></div></article>`).join('');
  }
  function storeLogo(order){
    const img=safeImage(order.empresa?.logo);
    return img ? `<img class="store-logo" src="${esc(img)}" alt="">` : `<span class="store-logo">${esc(initials(order.empresa?.nombre).slice(0,1))}</span>`;
  }
  function renderRecent(){
    const list=$('#recent-orders');
    if(!orders.length){ list.innerHTML=empty('i-bag','Aún no tienes pedidos','Cuando compres en una tienda SIWEPE, aquí verás cada avance.',`<button class="primary-button" data-back-store>Explorar una tienda</button>`); return; }
    list.innerHTML=orders.slice(0,4).map((o,i)=>`<article class="recent-card" data-order-index="${i}">${storeLogo(o)}<div><h3>${esc(o.empresa?.nombre || 'Tienda SIWEPE')} · Pedido #${o.id}</h3><p>${dateText(o.fecha)} · ${o.items?.length || 0} producto${(o.items?.length||0)!==1?'s':''}</p></div><div><span class="status ${esc(o.estado)}">${esc(statusText[o.estado]||o.estado)}</span><strong>${money(o,o.total)}</strong></div></article>`).join('');
  }
  function fillProfileForm(){
    $('#pf-name').value=profile.nombre||''; $('#pf-email').value=profile.correo||''; $('#pf-phone').value=profile.telefono||''; $('#pf-whatsapp').value=profile.whatsapp||''; $('#pf-since').value=dateText(profile.created_at);
  }
  async function saveProfile(ev){
    ev.preventDefault(); const err=$('#profile-error'); err.textContent=''; const btn=ev.submitter;
    const next={...profile,nombre:$('#pf-name').value.trim(),correo:$('#pf-email').value.trim(),telefono:$('#pf-phone').value.trim(),whatsapp:$('#pf-whatsapp').value.trim(),direcciones:profile.direcciones||[],direccion:profile.direccion||''};
    if(btn) btn.disabled=true;
    try{ await apiPut('/api/clientes/mi',next); profile={...profile,...next}; renderIdentity(); renderAddresses(); toast('Tu información se guardó correctamente.'); }
    catch(e){ err.textContent=e.message||'No fue posible guardar los cambios.'; }
    finally{ if(btn) btn.disabled=false; }
  }

  function filterCounts(status){ return status==='todos' ? orders.length : orders.filter(x=>x.estado===status).length; }
  function renderOrders(){
    $$('#order-filters button').forEach(b=>{ b.classList.toggle('active',b.dataset.status===activeStatus); const count=$('b',b); if(count) count.textContent=filterCounts(b.dataset.status); });
    const q=$('#order-search').value.trim().toLowerCase();
    const filtered=orders.filter(o=>(activeStatus==='todos'||o.estado===activeStatus)&&(!q||String(o.id).includes(q)||String(o.empresa?.nombre||'').toLowerCase().includes(q)||String(o.items?.map(x=>x.nombre).join(' ')||'').toLowerCase().includes(q)));
    if(!filtered.length){ $('#orders-list').innerHTML=empty('i-bag',orders.length?'No encontramos coincidencias':'Tu historial está listo para comenzar',orders.length?'Prueba con otro filtro o término de búsqueda.':'Tu primer pedido aparecerá aquí con su tienda, artículos y seguimiento.'); return; }
    $('#orders-list').innerHTML=filtered.map(o=>`<article class="order-card" data-order-key="${esc(`${o.empresa?.id||0}:${o.id}`)}"><div class="order-store">${storeLogo(o)}<div><h3>${esc(o.empresa?.nombre||'Tienda SIWEPE')}</h3><p>Pedido #${o.id} · ${dateText(o.fecha)}</p></div></div><div class="order-meta"><span class="status ${esc(o.estado)}">${esc(statusText[o.estado]||o.estado)}</span><p>${o.items?.length||0} producto${(o.items?.length||0)!==1?'s':''} · ${esc(o.metodoPago||'Pago por definir')}</p></div><div class="order-total"><strong>${money(o,o.total)}</strong><button class="view-order">Ver seguimiento</button></div></article>`).join('');
  }
  function orderByKey(key){ return orders.find(o=>`${o.empresa?.id||0}:${o.id}`===key); }
  function showOrder(order){
    if(!order) return;
    $$('.content-section').forEach(x=>x.classList.remove('active')); $('#order-detail').hidden=false;
    const stateOrder=['pendiente','aprobado','preparando','listo','enviado','entregado'];
    const stage=Math.max(0,stateOrder.indexOf(order.estado));
    const cancelled=order.estado==='cancelado';
    const steps=[['Recibido','Tu solicitud llegó a la tienda'],['Confirmado','La tienda aceptó tu pedido'],['Preparando','Tu compra se está alistando'],['Listo','Ya está listo para salir'],['Enviado','Va en camino'],['Entregado','Pedido finalizado']];
    const items=(order.items||[]).map(it=>{ const img=safeImage(it.imagen); return `<div class="detail-item">${img?`<img src="${esc(img)}" alt="">`:`<span class="item-placeholder">${esc(initials(it.nombre).slice(0,1))}</span>`}<div><h4>${esc(it.nombre||'Producto')}</h4><p>${it.cantidad} × ${money(order,it.precio)}</p></div><strong>${money(order,it.subtotal)}</strong></div>`; }).join('');
    const delivery=order.direccionEntrega||profile.direccion||'Sin dirección registrada';
    const messages=(order.mensajes||[]).map(m=>`<article class="profile-message ${m.autor==='cliente'?'mine':''}"><strong>${m.autor==='admin'?'Actualización de la tienda':'Tu mensaje'}</strong><p>${esc(m.texto)}</p><small>${dateText(m.fecha)}</small></article>`).join('');
    $('#order-detail').innerHTML=`<button class="detail-back">${icon('i-arrow')} Volver a mis pedidos</button><div class="detail-title"><div><h2>Pedido #${order.id}</h2><p>${esc(order.empresa?.nombre||'Tienda SIWEPE')} · ${dateText(order.fecha)}</p></div><span class="status ${esc(order.estado)}">${esc(statusText[order.estado]||order.estado)}</span></div><section class="detail-panel"><div class="current-stage"><div><span class="eyebrow blue">${cancelled?'ESTADO DEL PEDIDO':'ETAPA ACTUAL'}</span><h3>${cancelled?'Pedido cancelado':steps[stage][0]}</h3></div><strong>${money(order,order.total)}</strong></div>${order.nota?`<div class="order-note"><strong>Nota del pedido:</strong> ${esc(order.nota)}</div>`:''}${cancelled?`<div class="order-note">Este pedido no continuará su proceso. Si necesitas ayuda, comunícate directamente con la tienda.</div>`:`<div class="timeline"><span class="timeline-progress" style="width:${stage/Math.max(1,steps.length-1)*84}%"></span>${steps.map((s,i)=>`<div class="timeline-step ${i<stage?'done':''} ${i===stage?'current':''}"><span class="timeline-dot">${i<=stage?icon('i-check'):i+1}</span><span><strong>${s[0]}</strong><small>${s[1]}</small></span></div>`).join('')}</div>`}</section><div class="detail-grid"><section class="detail-panel"><h3 class="panel-heading">${icon('i-bag')} Artículos</h3>${items||'<p>Sin artículos disponibles.</p>'}</section><div><section class="detail-panel"><h3 class="panel-heading">${icon('i-truck')} Envío y pago</h3><div class="detail-info"><div><span>Recibe</span><strong>${esc(order.destinatario||profile.nombre||'Cliente')}</strong></div><div><span>Teléfono</span><strong>${esc(order.telefonoEntrega||profile.telefono||'No registrado')}</strong></div><div><span>Dirección</span><strong>${esc(delivery)}</strong></div><div><span>Método de pago</span><strong>${esc(order.metodoPago||'No especificado')}</strong></div><div><span>Estado del pago</span><strong>${esc((order.pagoEstado||'pendiente').replace(/_/g,' '))}</strong></div></div></section><section class="detail-panel"><h3 class="panel-heading">${icon('i-store')} Emprendimiento</h3><div class="detail-store">${storeLogo(order)}<div><h4>${esc(order.empresa?.nombre||'Tienda SIWEPE')}</h4><p>${esc([order.empresa?.rubro,order.empresa?.ciudad].filter(Boolean).join(' · ')||'Emprendimiento SIWEPE')}</p></div></div><button class="visit-store" data-visit-store="${esc(order.empresa?.slug||order.empresa?.id||'')}">Visitar tienda</button></section></div></div><section class="detail-panel"><h3 class="panel-heading">${icon('i-card')} Novedades del pedido</h3><div class="profile-messages">${messages||'<p class="profile-message-empty">La tienda todavía no ha enviado observaciones.</p>'}</div></section>`;
    (order.mensajes||[]).filter(m=>m.autor==='admin').forEach(m=>m.leido=true);
    apiPatch(`/api/pedidos/${order.empresa?.id}/${order.id}/mensajes/leidos`,{}).catch(()=>{});
    renderIdentity();
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function renderAddresses(){
    const dirs=profile.direcciones||[];
    if(!dirs.length){ $('#addresses-list').innerHTML=empty('i-pin','Aún no guardas direcciones','Agrega tu casa, trabajo u otro lugar frecuente para preparar tus próximas entregas.',`<button class="primary-button" data-add-address>${icon('i-plus')} Agregar dirección</button>`); return; }
    $('#addresses-list').innerHTML=dirs.map((d,i)=>`<article class="address-card ${d.principal?'primary':''}"><div class="address-actions"><button data-edit-address="${i}" title="Editar">${icon('i-edit')}</button><button class="delete" data-delete-address="${i}" title="Eliminar">${icon('i-trash')}</button></div><div class="address-head"><span class="address-icon">${icon('i-pin')}</span><div><h3>${esc(d.etiqueta||'Dirección')}</h3>${d.principal?'<span class="primary-label">Principal</span>':''}</div></div><p>${esc(d.direccion)}${d.ciudad?`<br>${esc(d.ciudad)}${d.departamento?`, ${esc(d.departamento)}`:''}`:''}${d.referencia?`<br><small>${esc(d.referencia)}</small>`:''}</p><span class="address-phone">${esc(d.nombre||profile.nombre)} · ${esc(d.telefono||profile.telefono||'Sin teléfono')}</span></article>`).join('');
  }
  function openAddress(index=null){
    const d=index==null?null:(profile.direcciones||[])[index];
    $('#address-dialog-title').textContent=d?'Editar dirección':'Nueva dirección'; $('#ad-id').value=index==null?'':String(index); $('#ad-label').value=d?.etiqueta||''; $('#ad-name').value=d?.nombre||profile.nombre||''; $('#ad-address').value=d?.direccion||''; $('#ad-city').value=d?.ciudad||''; $('#ad-state').value=d?.departamento||''; $('#ad-reference').value=d?.referencia||''; $('#ad-phone').value=d?.telefono||profile.telefono||''; $('#ad-primary').checked=d?!!d.principal:!(profile.direcciones||[]).length; $('#address-error').textContent=''; $('#address-dialog').showModal();
  }
  async function persistAddresses(next){
    const payload={...profile,direcciones:next,direccion:next.find(x=>x.principal)?.direccion||profile.direccion||''};
    await apiPut('/api/clientes/mi',payload); profile={...profile,...payload}; renderAddresses();
  }
  async function saveAddress(ev){
    ev.preventDefault(); if(ev.submitter?.value==='cancel'){ $('#address-dialog').close(); return; }
    const idx=$('#ad-id').value===''?null:Number($('#ad-id').value); const next=[...(profile.direcciones||[])];
    const d={id:idx==null?`dir-${Date.now()}`:(next[idx]?.id||`dir-${Date.now()}`),etiqueta:$('#ad-label').value.trim(),nombre:$('#ad-name').value.trim(),direccion:$('#ad-address').value.trim(),ciudad:$('#ad-city').value.trim(),departamento:$('#ad-state').value.trim(),referencia:$('#ad-reference').value.trim(),telefono:$('#ad-phone').value.trim(),principal:$('#ad-primary').checked};
    if(!d.etiqueta||!d.nombre||!d.direccion){ $('#address-error').textContent='Completa la etiqueta, persona que recibe y dirección.'; return; }
    if(d.principal) next.forEach(x=>x.principal=false); if(idx==null) next.push(d); else next[idx]=d; if(next.length&&!next.some(x=>x.principal)) next[0].principal=true;
    const btn=ev.submitter; if(btn) btn.disabled=true;
    try{ await persistAddresses(next); $('#address-dialog').close(); toast('Dirección guardada.'); }
    catch(e){ $('#address-error').textContent=e.message||'No fue posible guardar la dirección.'; }
    finally{ if(btn) btn.disabled=false; }
  }
  async function deleteAddress(index){
    const d=(profile.direcciones||[])[index]; if(!d||!confirm(`¿Eliminar la dirección “${d.etiqueta}”?`)) return;
    const next=profile.direcciones.filter((_,i)=>i!==index); if(next.length&&!next.some(x=>x.principal)) next[0].principal=true;
    try{ await persistAddresses(next); toast('Dirección eliminada.'); }catch(e){ toast(e.message||'No se pudo eliminar.',true); }
  }
  async function changePassword(ev){
    ev.preventDefault(); const err=$('#password-error'); err.textContent=''; const current=$('#pw-current').value,newPw=$('#pw-new').value,confirmPw=$('#pw-confirm').value;
    if(newPw!==confirmPw){ err.textContent='Las contraseñas nuevas no coinciden.'; return; }
    if(newPw.length<8){ err.textContent='La nueva contraseña debe tener al menos 8 caracteres.'; return; }
    const btn=ev.submitter; if(btn) btn.disabled=true;
    try{ await apiPut('/api/clientes/mi/password',{actual:current,nueva:newPw}); ev.target.reset(); toast('Contraseña actualizada correctamente.'); }
    catch(e){ err.textContent=e.message||'No se pudo actualizar la contraseña.'; }
    finally{ if(btn) btn.disabled=false; }
  }

  function wireEvents(){
    $('#back-store').onclick=()=>goStore(); $('#logout').onclick=logout; $('#profile-notifications').onclick=()=>navigate('pedidos');
    $$('.profile-nav button').forEach(b=>b.onclick=()=>navigate(b.dataset.section));
    $$('[data-jump]').forEach(b=>b.onclick=()=>navigate(b.dataset.jump));
    $('#profile-form').addEventListener('submit',saveProfile); $('#password-form').addEventListener('submit',changePassword);
    $('#add-address').onclick=()=>openAddress(); $('#address-form').addEventListener('submit',saveAddress);
    $('#order-search').addEventListener('input',renderOrders);
    $('#order-filters').addEventListener('click',e=>{ const b=e.target.closest('button[data-status]'); if(!b)return; activeStatus=b.dataset.status; renderOrders(); });
    document.addEventListener('click',e=>{
      const recent=e.target.closest('[data-order-index]'); if(recent) showOrder(orders[Number(recent.dataset.orderIndex)]);
      const card=e.target.closest('[data-order-key]'); if(card&&e.target.closest('.view-order')) showOrder(orderByKey(card.dataset.orderKey));
      const back=e.target.closest('.detail-back'); if(back) navigate('pedidos');
      const visit=e.target.closest('[data-visit-store]'); if(visit) goStore(visit.dataset.visitStore);
      const edit=e.target.closest('[data-edit-address]'); if(edit) openAddress(Number(edit.dataset.editAddress));
      const del=e.target.closest('[data-delete-address]'); if(del) deleteAddress(Number(del.dataset.deleteAddress));
      if(e.target.closest('[data-add-address]')) openAddress();
      if(e.target.closest('[data-back-store]')) goStore();
    });
  }
  async function init(){
    if(!bsToken()||!['cliente','admin'].includes(bsRole())){ showGate(); return; }
    try{
      const [p,h]=await Promise.all([apiGet('/api/clientes/mi'),apiGet('/api/mis-pedidos')]); profile=p; orders=h.pedidos||[];
      $('#access-gate').hidden=true; $('#profile-app').hidden=false; renderIdentity(); renderStats(); renderRecent(); fillProfileForm(); renderOrders(); renderAddresses(); wireEvents();
      const params=new URLSearchParams(location.search),requested=params.get('seccion'); if(['resumen','datos','pedidos','direcciones','seguridad'].includes(requested)) navigate(requested);
      const requestedOrder=params.get('pedido'); if(requestedOrder){const order=orderByKey(requestedOrder);if(order)showOrder(order);}
    }catch(e){ if(e.status===401||e.status===403){ limpiarSesionToken(); showGate(); } else { showGate(); toast(e.message||'No se pudo cargar tu perfil.',true); } }
  }
  init();
})();
