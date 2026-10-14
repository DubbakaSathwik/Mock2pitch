import React from 'react';
import { Icon } from '../core/Icon.jsx';
export function Select({label,options=[],value,onChange,id,style,...rest}){
  const iid=id||React.useId();
  return <label htmlFor={iid} style={{display:'flex',flexDirection:'column',gap:6,fontFamily:'var(--font-body)',...style}}>
    {label&&<span style={{fontSize:14,fontWeight:700,color:'var(--text-strong)'}}>{label}</span>}
    <span style={{position:'relative',display:'flex'}}>
      <select id={iid} value={value} onChange={onChange} style={{appearance:'none',WebkitAppearance:'none',width:'100%',height:44,padding:'0 40px 0 14px',borderRadius:'var(--radius-md)',border:'1px solid var(--border-strong)',background:'var(--white)',fontFamily:'var(--font-body)',fontSize:16,color:'var(--text-strong)',cursor:'pointer'}} {...rest}>
        {options.map(o=>typeof o==='string'?<option key={o} value={o}>{o}</option>:<option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <Icon name="chevron-down" size={18} color="var(--ink-500)" style={{position:'absolute',right:14,top:13,pointerEvents:'none'}}/>
    </span>
  </label>;
}
