(() => {
  'use strict';
  const $=s=>document.querySelector(s), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let items=[];
  const ref=()=>DB?.empresa?.slug||bsEmpresa()||DB?.empresa_id||'';
  const money=n=>`${DB?.config?.moneda||'L'} ${Number(n||0).toLocaleString('es-HN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  function url(file){return `${file}?e=${encodeURIComponent(ref())}`}
  function toast(msg,error=false){const e=$('#commerce-toast');e.textContent=msg;e.classList.toggle('error',error);e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2600)}
  function applyBrand(){const name=DB.config.nombre||DB.empresa?.nombre||'Tienda SIWEPE',logo=DB.config.logo||DB.empresa?.logo||'';$('#store-name').textContent=name;$('#store-logo').innerHTML=logo?`<img src="${esc(logo)}" alt="">`:esc(name[0]);['#store-link','#back-store','#crumb-store','#continue-store'].forEach(id=>$(id).href=url('tienda.html'));document.title=`Carrito · ${name}`}
  function sync(){
    /* Identidad de la tienda robusta: id numérico si lo tenemos, si no el slug.
       Buscamos por id O por slug (deEmpresa acepta ambos), así el carrito no
       "sale vacío" aunque DB.empresa_id llegue en 0. Soporta variantes. */
    const eid=Number(DB.empresa_id)||Number(DB.empresa&&DB.empresa.id)||0;
    const slug=String(DB.empresa?.slug||bsEmpresa()||'');
    const clave=eid||slug;
    if(!clave){ items=[]; return; }
    items=siwepeCart.deEmpresa(clave).map(x=>{
      const p=(DB.productos||[]).find(y=>Number(y.id)===Number(x.producto_id));
      if(!p||p.estado!=='activo')return null;
      const vs=(p.variantes||[]).filter(v=>v.activo!==false),v=vs.find(v=>String(v.id)===String(x.variante_id||''));
      if(vs.length&&!v)return null;
      const stock=Number(v?v.stock:p.stock)||0; if(stock<=0)return null;
      return{...x,empresa_id:eid||Number(x.empresa_id)||0,empresa_slug:slug||x.empresa_slug||'',empresa_nombre:DB.config.nombre,nombre:p.nombre,variante_id:v?String(v.id):'',variante_nombre:v?Object.values(v.atributos||{}).filter(Boolean).join(' · '):'',precio:Number(v?v.precioVenta:p.precio_venta)||0,imagen:p.imagen||x.imagen||'',stock,cantidad:Math.min(Math.max(1,Number(x.cantidad)||1),stock)};
    }).filter(Boolean);
    if((DB.productos||[]).length){
      const esMio=x=>(eid&&Number(x.empresa_id)===eid)||(slug&&x.empresa_slug===slug);
      const others=siwepeCart.get().filter(x=>!esMio(x));
      siwepeCart.set([...others,...items]);
    }
  }
  function render(){const list=$('#cart-list'),summary=$('#cart-summary'),count=items.reduce((n,x)=>n+x.cantidad,0),total=items.reduce((n,x)=>n+x.precio*x.cantidad,0);if(!items.length){list.innerHTML=`<div class="cart-empty"><div><svg><use href="#c-bag"/></svg><h2>Tu carrito está vacío</h2><p>Explorá el catálogo y agrega los productos que te gusten.</p><a class="commerce-primary" href="${url('tienda.html')}#catalogo">Ver catálogo</a></div></div>`;summary.hidden=true;return}summary.hidden=false;list.innerHTML=items.map((x,i)=>`<article class="cart-item" data-index="${i}">${x.imagen?`<img class="cart-image" src="${esc(x.imagen)}" alt="">`:`<span class="cart-image-placeholder">${esc(x.nombre[0])}</span>`}<div class="cart-copy"><h2>${esc(x.nombre)}</h2>${x.variante_nombre?`<p><strong>${esc(x.variante_nombre)}</strong></p>`:''}<p>${money(x.precio)} c/u · ${x.stock} disponibles</p><button data-remove><svg><use href="#c-trash"/></svg>Eliminar</button></div><div class="qty-control"><button data-delta="-1" aria-label="Restar">−</button><span>${x.cantidad}</span><button data-delta="1" aria-label="Sumar">+</button></div><strong class="cart-price">${money(x.precio*x.cantidad)}</strong></article>`).join('');$('#summary-count').textContent=`${count} artículo${count!==1?'s':''}`;$('#summary-subtotal').textContent=$('#summary-total').textContent=money(total)}
  function change(index,delta){const x=items[index];if(!x)return;const next=x.cantidad+delta;if(next>x.stock){toast('Llegaste al máximo disponible');return}siwepeCart.update(x.empresa_id,x.producto_id,next,x.variante_id);sync();render()}
  async function init(){if(!bsEmpresa()){location.href='index.html';return}await bootstrapDB({asBuyer:true});applyBrand();sync();render();$('#cart-list').addEventListener('click',e=>{const card=e.target.closest('[data-index]');if(!card)return;const index=Number(card.dataset.index);if(e.target.closest('[data-remove]'))change(index,-999);const d=e.target.closest('[data-delta]');if(d)change(index,Number(d.dataset.delta))});$('#go-checkout').onclick=()=>{if(!items.length)return;if(!bsToken()||!['cliente','admin'].includes(bsRole())){try{sessionStorage.setItem('siwepe_after_login',url('checkout.html'))}catch(e){}location.href=`${url('tienda.html')}&login=1`;return}location.href=url('checkout.html')}}
  init().catch(e=>{toast(e.message||'No se pudo cargar el carrito.',true)});
})();
