import React from 'react';
import { Icon } from '../core/Icon.jsx';
const T={info:['info','var(--bright-marine)'],success:['circle-check','var(--success-500)'],warning:['triangle-alert','var(--warning-500)'],danger:['circle-x','var(--danger-500)']};
export function Toast({tone='info',title,children,onClose,style}){
  const [ic,c]=T[tone]||T.info;
  return <div role="status" style={{display:'flex',gap:12,alignItems:'flex-start',width:360,maxWidth:'100%',padding:'14px 16px',borderRadius:'var(--radius-md)',background:'var(--prussian-blue)',color:'var(--white)',boxShadow:'var(--shadow-lg)',fontFamily:'var(--font-body)',...style}}>
    <Icon name={ic} size={20} color={tone==='info'?'var(--icy-blue)':c} style={{marginTop:2}}/>
    <div style={{flex:1,display:'flex',flexDirection:'column',gap:2}}>{title&&<span style={{fontWeight:700,fontSize:15}}>{title}</span>}{children&&<span style={{fontSize:14,color:'var(--icy-blue)'}}>{children}</span>}</div>
    {onClose&&<button onClick={onClose} aria-label="Dismiss" style={{border:'none',background:'transparent',color:'var(--ink-300)',cursor:'pointer',padding:2}}><Icon name="x" size={16}/></button>}
  </div>;
}
