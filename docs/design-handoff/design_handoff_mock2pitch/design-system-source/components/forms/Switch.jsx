import React from 'react';
export function Switch({checked,onChange,label,disabled,style}){
  return <label style={{display:'inline-flex',alignItems:'center',gap:10,cursor:disabled?'not-allowed':'pointer',opacity:disabled?.5:1,fontFamily:'var(--font-body)',fontSize:15,color:'var(--text-body)',...style}}>
    <span role="switch" aria-checked={!!checked} onClick={()=>!disabled&&onChange&&onChange(!checked)} style={{width:40,height:24,borderRadius:12,background:checked?'var(--bright-marine)':'var(--ink-300)',position:'relative',transition:'background var(--dur-base) var(--ease-out)'}}>
      <span style={{position:'absolute',top:3,left:checked?19:3,width:18,height:18,borderRadius:9,background:'var(--white)',boxShadow:'var(--shadow-sm)',transition:'left var(--dur-base) var(--ease-out)'}}></span>
    </span>
    {label}
  </label>;
}
