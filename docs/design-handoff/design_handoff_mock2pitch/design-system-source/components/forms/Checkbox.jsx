import React from 'react';
import { Icon } from '../core/Icon.jsx';
export function Checkbox({checked,onChange,label,disabled,style}){
  return <label style={{display:'inline-flex',alignItems:'center',gap:10,cursor:disabled?'not-allowed':'pointer',opacity:disabled?.5:1,fontFamily:'var(--font-body)',fontSize:15,color:'var(--text-body)',...style}}>
    <span onClick={()=>!disabled&&onChange&&onChange(!checked)} style={{width:20,height:20,borderRadius:6,border:'1.5px solid '+(checked?'var(--imperial-blue)':'var(--border-strong)'),background:checked?'var(--imperial-blue)':'var(--white)',display:'inline-flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all var(--dur-fast)'}}>{checked&&<Icon name="check" size={14} color="var(--white)"/>}</span>
    {label}
  </label>;
}
