import React from 'react';
import { Icon } from '../core/Icon.jsx';
export function Input({label,hint,error,icon,id,style,...rest}){
  const [f,setF]=React.useState(false);const iid=id||React.useId();
  return <label htmlFor={iid} style={{display:'flex',flexDirection:'column',gap:6,fontFamily:'var(--font-body)',...style}}>
    {label&&<span style={{fontSize:14,fontWeight:700,color:'var(--text-strong)'}}>{label}</span>}
    <span style={{display:'flex',alignItems:'center',gap:8,height:44,padding:'0 14px',borderRadius:'var(--radius-md)',background:'var(--white)',border:'1px solid '+(error?'var(--danger-500)':f?'var(--border-focus)':'var(--border-strong)'),boxShadow:f?(error?'0 0 0 3px rgba(214,69,69,.2)':'var(--focus-ring)'):'none',transition:'box-shadow var(--dur-fast), border-color var(--dur-fast)'}}>
      {icon&&<Icon name={icon} size={18} color="var(--ink-500)"/>}
      <input id={iid} onFocus={()=>setF(true)} onBlur={()=>setF(false)} style={{flex:1,minWidth:0,border:'none',outline:'none',background:'transparent',fontFamily:'var(--font-body)',fontSize:16,color:'var(--text-strong)'}} {...rest}/>
    </span>
    {(error||hint)&&<span style={{fontSize:13,color:error?'var(--danger-500)':'var(--text-muted)'}}>{error||hint}</span>}
  </label>;
}
