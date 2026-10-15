import React from 'react';
const HREF='https://unpkg.com/lucide-static@0.452.0/font/lucide.css';
function ensure(){if(typeof document==='undefined')return;if(document.querySelector('link[data-m2p-icons]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href=HREF;l.setAttribute('data-m2p-icons','');document.head.appendChild(l);}
export function Icon({name,size=20,color='currentColor',style,...rest}){
  ensure();
  return <i className={'icon-'+name} aria-hidden="true" style={{fontSize:size,lineHeight:1,color,display:'inline-flex',width:size,height:size,alignItems:'center',justifyContent:'center',fontStyle:'normal',flexShrink:0,...style}} {...rest}></i>;
}
