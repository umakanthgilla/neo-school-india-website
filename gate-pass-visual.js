(()=>{
'use strict';
if(window.__neoGatePassVisual)return;window.__neoGatePassVisual=true;
const style=document.createElement('style');
style.textContent=`
/* Neo Gate Pass visual polish — prominent title + light multicolor backdrop */
.pass{overflow:hidden!important}
.pass .neo-pass-inner{position:relative;isolation:isolate;background:
  radial-gradient(circle at 12% 12%,rgba(0,185,232,.11),transparent 22%),
  radial-gradient(circle at 88% 16%,rgba(239,59,120,.08),transparent 20%),
  radial-gradient(circle at 84% 86%,rgba(255,122,22,.08),transparent 23%),
  radial-gradient(circle at 14% 88%,rgba(77,187,66,.08),transparent 22%),
  linear-gradient(145deg,rgba(255,255,255,.97),rgba(248,252,255,.93));
}
.pass .neo-pass-inner:before{content:"";position:absolute;inset:0;z-index:-2;pointer-events:none;opacity:.75;background:
  repeating-linear-gradient(112deg,transparent 0 19px,rgba(0,185,232,.055) 19px 21px,transparent 21px 43px,rgba(77,187,66,.045) 43px 45px,transparent 45px 68px,rgba(244,196,0,.045) 68px 70px,transparent 70px 92px,rgba(255,122,22,.04) 92px 94px,transparent 94px 118px,rgba(239,59,120,.04) 118px 120px,transparent 120px 146px);
  transform:skewY(-4deg) scale(1.08);
}
.pass .neo-pass-inner:after{content:"";position:absolute;left:-18%;right:-18%;top:62px;height:155px;z-index:-1;pointer-events:none;opacity:.62;border-radius:50%;background:
  radial-gradient(ellipse at 50% 120%,transparent 0 48%,rgba(0,185,232,.11) 48.5% 50%,transparent 50.5% 57%,rgba(77,187,66,.09) 57.5% 59%,transparent 59.5% 66%,rgba(244,196,0,.08) 66.5% 68%,transparent 68.5% 75%,rgba(255,122,22,.07) 75.5% 77%,transparent 77.5% 84%,rgba(239,59,120,.07) 84.5% 86%,transparent 86.5%);
}
.neo-pass-brand{align-items:center!important;margin-bottom:20px!important}
.neo-pass-brand>div:last-child{min-width:190px;text-align:right}
.neo-pass-type{font-size:clamp(24px,5.8vw,36px)!important;line-height:.98!important;font-weight:950!important;letter-spacing:.055em!important;color:#071b52!important;text-transform:uppercase!important;white-space:nowrap;text-shadow:0 2px 0 rgba(255,255,255,.85);margin:0 0 9px!important}
.neo-pass-status{font-size:12px!important;padding:7px 12px!important;box-shadow:0 4px 12px rgba(0,28,76,.08)}
.neo-pass-main{box-shadow:0 8px 22px rgba(7,27,82,.07);background:rgba(255,255,255,.9)!important}
.neo-pass-code-wrap{box-shadow:0 12px 28px rgba(7,27,82,.2)!important}
@media(max-width:560px){
 .neo-pass-brand{display:grid!important;grid-template-columns:1fr!important;gap:12px!important}
 .neo-pass-brand>div:last-child{min-width:0;text-align:left!important}
 .neo-pass-type{font-size:28px!important;white-space:normal}
 .pass .neo-pass-inner:after{top:100px;height:145px}
}
`;
document.head.append(style);
})();
