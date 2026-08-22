/*! SIWEPE · aviso de acceso para pantallas de autenticación. */
/*
  Este control sólo evita aperturas accidentales mediante atajos dentro de los
  formularios de acceso. No se considera una frontera de seguridad: permisos,
  datos y roles siempre se validan en el backend.
*/
(function activarAvisoDeAcceso(){
  'use strict';

  const ATAJOS_BLOQUEADOS = new Set(['i','j','c','k']);
  let aviso = null;
  let temporizador = 0;

  function mostrarAviso(){
    if(!document.body) return;
    if(!aviso){
      aviso=document.createElement('div');
      aviso.id='siwepe-access-guard';
      aviso.setAttribute('role','status');
      aviso.setAttribute('aria-live','polite');
      aviso.innerHTML='<span aria-hidden="true">!</span><div><strong>Acción bloqueada en esta pantalla</strong><small>Continúa con el inicio de sesión para acceder de forma segura.</small></div>';
      const estilo=document.createElement('style');
      estilo.textContent='#siwepe-access-guard{position:fixed;top:max(18px,env(safe-area-inset-top));left:50%;z-index:2147483647;display:flex;align-items:center;gap:11px;width:min(92vw,430px);padding:13px 16px;border:1px solid rgba(120,159,204,.5);border-radius:15px;background:rgba(7,31,70,.96);color:#fff;box-shadow:0 18px 55px rgba(0,18,55,.3);font:600 13px/1.35 Manrope,system-ui,sans-serif;opacity:0;transform:translate(-50%,-18px);pointer-events:none;transition:opacity .2s ease,transform .2s ease}#siwepe-access-guard.show{opacity:1;transform:translate(-50%,0)}#siwepe-access-guard>span{display:grid;place-items:center;width:29px;height:29px;border-radius:9px;background:#19a8e2;font-weight:900;flex:0 0 auto}#siwepe-access-guard strong,#siwepe-access-guard small{display:block}#siwepe-access-guard small{margin-top:2px;color:rgba(255,255,255,.68);font-size:11px;font-weight:500}@media(prefers-reduced-motion:reduce){#siwepe-access-guard{transition:none}}';
      document.head.appendChild(estilo);
      document.body.appendChild(aviso);
    }
    clearTimeout(temporizador);
    aviso.classList.add('show');
    temporizador=setTimeout(()=>aviso.classList.remove('show'),2600);
  }

  function esAtajoBloqueado(evento){
    const tecla=String(evento.key||'').toLowerCase();
    if(tecla==='f12') return true;
    if((evento.ctrlKey||evento.metaKey)&&evento.shiftKey&&ATAJOS_BLOQUEADOS.has(tecla)) return true;
    return (evento.ctrlKey||evento.metaKey)&&tecla==='u';
  }

  addEventListener('keydown',evento=>{
    if(!esAtajoBloqueado(evento)) return;
    evento.preventDefault();
    evento.stopImmediatePropagation();
    mostrarAviso();
  },true);
})();
