(()=>{
'use strict';
if(window.__neoGatePassVisual)return;window.__neoGatePassVisual=true;
document.body.classList.add('neo-public-gate');
if(!document.querySelector('link[data-neo-public-theme]')){const link=document.createElement('link');link.rel='stylesheet';link.href='/neo-public-theme.css?v=20261001-public1';link.dataset.neoPublicTheme='true';document.head.append(link)}
const style=document.createElement('style');
style.textContent=`
/* Neo Gate Pass — final clean framed pass */
.pass{overflow:hidden!important;background:#fff!important;border:1.5px solid rgba(11,57,127,.55)!important;box-shadow:0 22px 52px rgba(7,27,82,.18)!important}
.pass .neo-pass-inner{position:relative;isolation:isolate;background:linear-gradient(180deg,#fff 0%,#fbfdff 100%)!important}

/* Kingdom-blue premium header */
.neo-pass-brand{position:relative;overflow:hidden;display:block!important;margin:-24px -22px 22px!important;padding:27px 22px 22px!important;background:linear-gradient(135deg,#061b52 0%,#0a3478 52%,#1054a1 100%)!important;box-shadow:0 10px 24px rgba(7,27,82,.16)}
.neo-pass-brand:after{content:"";position:absolute;inset:auto -8% -42px 22%;height:92px;border-radius:50%;border:1px solid rgba(255,255,255,.16);box-shadow:0 -14px 0 rgba(0,185,232,.07),0 -28px 0 rgba(77,187,66,.05),0 -42px 0 rgba(244,196,0,.045);transform:rotate(-5deg);pointer-events:none}
.neo-pass-school,.neo-pass-brand>div:last-child{position:relative;z-index:2}
.neo-pass-school{justify-content:flex-start!important}
.neo-pass-school-name{color:#fff!important}.neo-pass-school-city{color:#dbe9ff!important}.neo-pass-school img{box-shadow:0 8px 20px rgba(0,0,0,.16)!important}
.neo-pass-brand>div:last-child{min-width:0!important;text-align:center!important;margin-top:14px!important}
.neo-pass-type{font-size:clamp(24px,5vw,32px)!important;line-height:1!important;font-weight:950!important;letter-spacing:.07em!important;color:#fff!important;text-transform:uppercase!important;white-space:nowrap;text-shadow:0 2px 8px rgba(0,0,0,.14);margin:0 0 9px!important;text-align:center!important}
.neo-pass-status{font-size:11px!important;padding:7px 12px!important;background:rgba(255,255,255,.92)!important;color:#176b3a!important;box-shadow:0 5px 14px rgba(0,0,0,.12)}
.pass.pending .neo-pass-status{color:#775600!important}.pass.rejected .neo-pass-status{color:#a72b2b!important}

/* White body with soft Neo-color wave/line artwork at about 30% opacity */
.pass .neo-pass-inner:before{content:"";position:absolute;z-index:-2;left:-18%;right:-18%;top:118px;height:430px;pointer-events:none;opacity:.30;transform:rotate(-7deg);background:
 radial-gradient(ellipse at 50% 13%,transparent 0 42%,rgba(0,185,232,.62) 42.5% 44%,transparent 44.5% 49%,rgba(77,187,66,.58) 49.5% 51%,transparent 51.5% 56%,rgba(244,196,0,.54) 56.5% 58%,transparent 58.5% 63%,rgba(255,122,22,.52) 63.5% 65%,transparent 65.5% 70%,rgba(239,59,120,.50) 70.5% 72%,transparent 72.5%),
 radial-gradient(circle at 83% 72%,rgba(0,185,232,.15),transparent 25%),
 radial-gradient(circle at 16% 80%,rgba(239,59,120,.12),transparent 24%)}
.pass .neo-pass-inner:after{content:"";position:absolute;z-index:-1;left:-10%;right:-10%;bottom:80px;height:210px;pointer-events:none;opacity:.24;transform:skewY(-5deg);background:repeating-linear-gradient(112deg,transparent 0 28px,rgba(0,185,232,.22) 29px 31px,transparent 32px 59px,rgba(77,187,66,.20) 60px 62px,transparent 63px 90px,rgba(244,196,0,.18) 91px 93px,transparent 94px 121px,rgba(255,122,22,.17) 122px 124px,transparent 125px 152px,rgba(239,59,120,.17) 153px 155px,transparent 156px 184px)}

/* Keep content clean and readable over the artwork */
.neo-pass-main{position:relative;background:rgba(255,255,255,.88)!important;border:1px solid rgba(11,57,127,.16)!important;box-shadow:0 9px 24px rgba(7,27,82,.08)!important;backdrop-filter:blur(5px)}
.neo-pass-main:before{content:"";position:absolute;inset:0;border-radius:20px;padding:1px;background:linear-gradient(120deg,rgba(0,185,232,.48),rgba(77,187,66,.38),rgba(244,196,0,.34),rgba(255,122,22,.32),rgba(239,59,120,.38));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none}

/* Photo gets a visible premium Neo-color border */
.neo-pass-main .pass-photo{margin:0!important;padding:4px;border-radius:50%;background:linear-gradient(135deg,#00b9e8 0%,#4dbb42 27%,#f4c400 52%,#ff7a16 75%,#ef3b78 100%);box-shadow:0 8px 20px rgba(7,27,82,.16)}
.neo-pass-main .pass-photo img{border:4px solid #fff!important;box-shadow:none!important;background:#fff!important}

.neo-pass-code-wrap{box-shadow:0 12px 27px rgba(7,27,82,.19)!important}
.neo-pass-footer{position:relative;z-index:1}
.neo-pass-watermark{opacity:.018!important}

@media(max-width:560px){
 .neo-pass-brand{display:block!important;margin:-20px -16px 18px!important;padding:24px 16px 20px!important}
 .neo-pass-brand>div:last-child{min-width:0;text-align:center!important;margin-top:13px!important}
 .neo-pass-type{font-size:27px!important;white-space:normal;text-align:center!important}
 .pass .neo-pass-inner:before{top:155px;height:390px;opacity:.28}
 .pass .neo-pass-inner:after{bottom:110px;opacity:.21}
 .neo-pass-main .pass-photo{padding:3px}
}
`;
document.head.append(style);
})();
