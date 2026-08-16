(() => {
  'use strict';
  const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let profile=null,items=[],proof='',busy=false;
  const ref=()=>DB?.empresa?.slug||bsEmpresa()||DB?.empresa_id||'';
  const url=file=>`${file}?e=${encodeURIComponent(ref())}`;
  const money=n=>`${DB?.config?.moneda||'L'} ${Number(n||0).toLocaleString('es-HN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  function toast(msg,error=false){const e=$('#commerce-toast');e.textContent=msg;e.classList.toggle('error',error);e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2800)}
  function brand(){const name=DB.config.nombre||DB.empresa?.nombre||'Tienda SIWEPE',logo=DB.config.logo||DB.empresa?.logo||'';$('#store-name').textContent=name;$('#store-logo').innerHTML=logo?`<img src="${esc(logo)}" alt="">`:esc(name[0]);$('#store-link').href=url('tienda.html');$('#back-cart').href=url('carrito.html');$('#gate-cart').href=url('carrito.html');document.title=`Finalizar compra · ${name}`}
  function loadItems(){items=siwepeCart.deEmpresa(DB.empresa_id).map(x=>{const p=(DB.productos||[]).find(y=>Number(y.id)===Number(x.producto_id));if(!p||p.estado!=='activo'||Number(p.stock)<=0)return null;return{...x,nombre:p.nombre,precio:Number(p.precio_venta)||0,imagen:p.imagen||x.imagen||'',stock:Number(p.stock)||0,cantidad:Math.min(Math.max(1,Number(x.cantidad)||1),Number(p.stock)||1)}}).filter(Boolean);const others=siwepeCart.get().filter(x=>Number(x.empresa_id)!==Number(DB.empresa_id));siwepeCart.set([...others,...items])}
  function renderSummary(){const count=items.reduce((n,x)=>n+x.cantidad,0),total=items.reduce((n,x)=>n+x.precio*x.cantidad,0);$('#checkout-count').textContent=`${count} artículo${count!==1?'s':''}`;$('#checkout-subtotal').textContent=$('#checkout-total').textContent=money(total);$('#checkout-items').innerHTML=items.map(x=>`<div class="checkout-item">${x.imagen?`<img src="${esc(x.imagen)}" alt="">`:`<span>${esc(x.nombre[0])}</span>`}<div><h3>${esc(x.nombre)}</h3><p>${x.cantidad} × ${money(x.precio)}</p></div><strong>${money(x.precio*x.cantidad)}</strong></div>`).join('')}
  function fillAddress(d={}){$('#delivery-name').value=d.nombre||profile.nombre||'';$('#delivery-phone').value=d.telefono||profile.telefono||'';$('#delivery-address').value=d.direccion||profile.direccion||'';$('#delivery-city').value=d.ciudad||'';$('#delivery-state').value=d.departamento||''}
  function renderAddresses(){const dirs=profile.direcciones||[],sel=$('#delivery-saved');sel.innerHTML='<option value="">Escribir una dirección</option>'+dirs.map((d,i)=>`<option value="${i}">${esc(d.etiqueta||`Dirección ${i+1}`)}${d.principal?' · principal':''}</option>`).join('');const idx=dirs.findIndex(d=>d.principal);if(idx>=0){sel.value=String(idx);fillAddress(dirs[idx])}else fillAddress()}
  function renderBank(){const p=DB.config.pago||{},fields=[['Banco',p.banco],['Cuenta',p.cuenta],['Titular',p.titular],['Tipo',p.tipo]].filter(x=>x[1]);$('#bank-data').innerHTML=fields.length?fields.map(x=>`<div><span>${esc(x[0])}</span><strong>${esc(x[1])}</strong></div>`).join('')+(p.nota?`<div style="grid-column:1/-1"><span>Indicaciones</span><strong>${esc(p.nota)}</strong></div>`:''):`<p class="bank-empty">Esta tienda todavía no publicó sus datos bancarios. Puedes preparar la orden, pero la tienda tendrá que enviarte la cuenta antes de validar el pago.</p>`}
  function switchPayment(value){$$('.payment-option').forEach(x=>x.classList.toggle('active',x.querySelector('input').value===value));$('#transfer-panel').hidden=value!=='transferencia';$('#card-panel').hidden=value!=='tarjeta'}
  function compress(file){return new Promise((resolve,reject)=>{if(file.size>6*1024*1024)return reject(new Error('El comprobante supera 6 MB.'));const reader=new FileReader();reader.onload=()=>{const img=new Image();img.onload=()=>{let w=img.naturalWidth,h=img.naturalHeight,max=1300;if(Math.max(w,h)>max){const r=max/Math.max(w,h);w=Math.round(w*r);h=Math.round(h*r)}const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);resolve(c.toDataURL('image/jpeg',.76))};img.onerror=()=>reject(new Error('No se pudo leer la imagen.'));img.src=reader.result};reader.onerror=()=>reject(new Error('No se pudo leer el archivo.'));reader.readAsDataURL(file)})}
  function formatCard(){const e=$('#card-number');e.value=e.value.replace(/\D/g,'').slice(0,19).replace(/(.{4})/g,'$1 ').trim()}
  function luhn(v){const d=v.replace(/\D/g,'');if(d.length<13)return false;let s=0,alt=false;for(let i=d.length-1;i>=0;i--){let n=+d[i];if(alt&&(n*=2)>9)n-=9;s+=n;alt=!alt}return s%10===0}
  async function saveAddressIfNeeded(entrega){if(!$('#save-address').checked)return;const dirs=[...(profile.direcciones||[])];dirs.forEach(d=>d.principal=false);dirs.push({id:`dir-${Date.now()}`,etiqueta:'Compra',...entrega,principal:true});await apiPut('/api/clientes/mi',{...profile,direcciones:dirs,direccion:entrega.direccion})}
  function confirmation(order){$('#checkout-main').hidden=true;const c=$('#confirmation');c.hidden=false;c.innerHTML=`<div class="confirmation-hero"><div class="confirmation-check"><svg><use href="#c-check"/></svg></div><h1>¡Pedido confirmado!</h1><p>La orden llegó a ${esc(order.empresa?.nombre||DB.config.nombre)}. Podrás seguir cada avance y recibir mensajes desde tu perfil SIWEPE.</p></div><div class="confirmation-order"><div class="confirmation-order-head"><div><span class="commerce-eyebrow">ORDEN CREADA</span><h2>Pedido #${order.id}</h2></div><span>PENDIENTE</span></div><div class="summary-row"><span>Productos</span><strong>${order.items.length}</strong></div><div class="summary-row"><span>Método de pago</span><strong>${esc(order.metodoPago)}</strong></div><div class="summary-row"><span>Entrega</span><strong>${esc(order.direccionEntrega||'Registrada')}</strong></div><div class="summary-total"><span>Total</span><strong>${money(order.total)}</strong></div></div><div class="confirmation-actions"><a href="perfil.html?seccion=pedidos&pedido=${encodeURIComponent(`${order.empresa?.id||DB.empresa_id}:${order.id}`)}">Ver seguimiento</a><a href="${url('tienda.html')}">Volver a la tienda</a></div>`;window.scrollTo({top:0,behavior:'smooth'})}
  async function submit(ev){
    ev.preventDefault();
    if(busy) return;
    if(!items.length){ toast('Tu carrito está vacío.',true); location.href=url('carrito.html'); return; }
    const entrega={
      nombre:$('#delivery-name').value.trim(),telefono:$('#delivery-phone').value.trim(),
      direccion:$('#delivery-address').value.trim(),ciudad:$('#delivery-city').value.trim(),
      departamento:$('#delivery-state').value.trim()
    };
    if(Object.values(entrega).some(v=>!v)){ toast('Completa todos los datos de entrega.',true); return; }
    const metodo=$('input[name="payment"]:checked').value;
    let detallePago={};
    if(metodo==='transferencia'&&!proof){ toast('Sube el comprobante de la transferencia.',true); return; }
    if(metodo==='tarjeta'){
      const num=$('#card-number').value.replace(/\D/g,'');
      const exp=$('#card-expiry').value.trim(),cvv=$('#card-cvv').value.trim();
      if(!$('#card-name').value.trim()||!luhn(num)||!/^\d{2}\/\d{2}$/.test(exp)||!/^\d{3,4}$/.test(cvv)){
        toast('Revisa los datos de la tarjeta.',true); return;
      }
      detallePago={ultimos4:num.slice(-4),marca:/^4/.test(num)?'Visa':/^5[1-5]/.test(num)?'Mastercard':'Tarjeta',modo:'pendiente_pasarela'};
    }
    busy=true;
    const btn=$('#confirm-order');btn.disabled=true;btn.textContent='Creando pedido…';
    try{
      await saveAddressIfNeeded(entrega);
      const data=await apiPostAuth('/api/pedidos/checkout',{
        items:items.map(x=>({empresa_id:x.empresa_id,producto_id:x.producto_id,cantidad:x.cantidad})),
        nota:$('#order-note').value.trim(),metodoPago:metodo,
        comprobante:metodo==='transferencia'?proof:'',entrega,detallePago
      });
      const order=(data.pedidos||[])[0];
      if(!order) throw new Error('La tienda no devolvió la orden creada.');
      siwepeCart.clearEmpresa(DB.empresa_id);confirmation(order);
    }catch(e){ toast(e.message||'No se pudo crear el pedido.',true); }
    finally{ busy=false;btn.disabled=false;btn.innerHTML='Confirmar pedido <span>→</span>'; }
  }
  async function init(){if(!bsEmpresa()){location.href='index.html';return}if(!bsToken()||!['cliente','admin'].includes(bsRole())){$('#checkout-main').hidden=true;$('#checkout-gate').hidden=false;const target=url('checkout.html');$('#gate-login').onclick=()=>{try{sessionStorage.setItem('siwepe_after_login',target)}catch(e){}location.href=`${url('tienda.html')}&login=1`};return}await bootstrapDB({asBuyer:true});profile=DB.clientes[0];brand();loadItems();if(!items.length){location.href=url('carrito.html');return}renderSummary();renderAddresses();renderBank();$('#delivery-saved').onchange=e=>{const i=e.target.value;fillAddress(i===''?{}:profile.direcciones[Number(i)])};$$('input[name="payment"]').forEach(r=>r.onchange=()=>switchPayment(r.value));$('#proof-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{proof=await compress(file);const u=$('#proof-uploader');u.classList.add('ready');u.innerHTML=`<img src="${proof}" alt="Comprobante"><strong>Comprobante listo</strong><small>${esc(file.name)}</small>`;toast('Comprobante cargado.')}catch(err){toast(err.message,true)}};$('#card-number').oninput=formatCard;$('#card-expiry').oninput=e=>{let v=e.target.value.replace(/\D/g,'').slice(0,4);e.target.value=v.length>2?`${v.slice(0,2)}/${v.slice(2)}`:v};$('#card-cvv').oninput=e=>e.target.value=e.target.value.replace(/\D/g,'').slice(0,4);$('#checkout-form').addEventListener('submit',submit)}
  init().catch(e=>toast(e.message||'No se pudo preparar la compra.',true));
})();
