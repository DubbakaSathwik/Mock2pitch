import React from 'react';
const T={neutral:['var(--ink-100)','var(--ink-700)'],info:['var(--marine-50)','var(--marine-600)'],success:['var(--success-50)','var(--success-500)'],warning:['var(--warning-50)','#9A6106'],danger:['var(--danger-50)','var(--danger-500)'],violet:['var(--pitch-violet-soft)','#5B30D9'],solid:['var(--imperial-blue)','var(--white)']};
export function Badge({tone='neutral',dot,children,style,...rest}){
  const [bg,fg]=T[tone]||T.neutral;
  return <span style={{display:'inline-flex',alignItems:'center',gap:6,height:24,padding:'0 10px',borderRadius:'var(--radius-pill)',background:bg,color:fg,fontFamily:'var(--font-body)',fontWeight:700,fontSize:12.5,whiteSpace:'nowrap',...style}} {...rest}>
    {dot&&<span style={{width:6,height:6,borderRadius:3,background:'currentColor'}}></span>}{children}
  </span>;
}
