import React from 'react';
import { Icon } from './Icon.jsx';
export function IconButton({icon,label,variant='ghost',size=40,disabled,style,...rest}){
  const [h,setH]=React.useState(false);
  const map={ghost:['transparent','var(--ink-100)','var(--ink-700)','transparent'],secondary:['var(--white)','var(--marine-50)','var(--imperial-blue)','var(--border-strong)'],primary:['var(--action-primary)','var(--action-primary-hover)','var(--white)','transparent'],inverse:['rgba(166,225,250,.12)','rgba(166,225,250,.22)','var(--icy-blue)','transparent']};
  const [bg,hv,fg,bd]=map[variant]||map.ghost;
  return <button aria-label={label} title={label} disabled={disabled} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
    style={{width:size,height:size,borderRadius:'var(--radius-pill)',border:'1px solid '+bd,background:h&&!disabled?hv:bg,color:disabled?'var(--ink-400)':fg,display:'inline-flex',alignItems:'center',justifyContent:'center',cursor:disabled?'not-allowed':'pointer',transition:'background var(--dur-fast) var(--ease-out)',padding:0,...style}} {...rest}>
    <Icon name={icon} size={Math.round(size*0.48)}/>
  </button>;
}
