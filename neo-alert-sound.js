/* A short in-app chime for a newly increased alert count. Audio starts after a user gesture. */
(()=>{
 const counts=new Map();let audio=null,armed=false;
 function unlock(){try{audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume().then(()=>{armed=audio.state==='running'}).catch(()=>{})}catch{}}
 document.addEventListener('pointerdown',unlock,{capture:true,once:true});
 document.addEventListener('keydown',unlock,{capture:true,once:true});
 function play(){if(!armed||document.hidden||!audio)return;try{audio.resume().then(()=>{if(audio.state!=='running')return;const start=audio.currentTime;for(const [offset,frequency] of [[0,784],[.14,1047]]){const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.type='sine';oscillator.frequency.value=frequency;gain.gain.setValueAtTime(.0001,start+offset);gain.gain.exponentialRampToValueAtTime(.045,start+offset+.025);gain.gain.exponentialRampToValueAtTime(.0001,start+offset+.19);oscillator.connect(gain).connect(audio.destination);oscillator.start(start+offset);oscillator.stop(start+offset+.2)}}).catch(()=>{})}catch{}}
 window.NeoAlertSound={count(key,value){const number=Math.max(0,Number(value)||0),previous=counts.get(key);counts.set(key,number);if(previous!==undefined&&number>previous)play()}};
})();