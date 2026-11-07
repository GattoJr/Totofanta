// Tema scelto in Impostazioni (automatico, chiaro, scuro): applicato prima che la pagina si disegni,
// così non c'è il lampo del tema sbagliato. "auto" segue l'impostazione del dispositivo.
(function(){
  var t="auto";try{t=localStorage.getItem("totofanta-theme")||"auto"}catch(e){}
  window.applyTheme=function(v){
    var root=document.documentElement;
    if(v==="light"||v==="dark")root.setAttribute("data-theme",v);else root.removeAttribute("data-theme");
    var dark=v==="dark"||(v!=="light"&&window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches);
    var metas=document.querySelectorAll('meta[name="theme-color"]');
    for(var i=0;i<metas.length;i++){if(v==="auto")metas[i].setAttribute("content",metas[i].getAttribute("data-auto")||metas[i].getAttribute("content"));else{if(!metas[i].getAttribute("data-auto"))metas[i].setAttribute("data-auto",metas[i].getAttribute("content"));metas[i].setAttribute("content",dark?"#0A1222":"#F2F5FB")}}
  };
  window.applyTheme(t);
  document.addEventListener("DOMContentLoaded",function(){window.applyTheme(t)});
})();
