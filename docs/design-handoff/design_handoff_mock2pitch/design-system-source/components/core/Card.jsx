import React from 'react';
export function Card({variant='default',padding=24,interactive,children,style,...rest}){
  const [h,setH]=React.useState(false);
  const base={default:{background:'var(--surface-card)',border:'1px solid var(--border-subtle)',boxShadow:'var(--shadow-sm)'},sunken:{background:'var(--surface-sunken)',border:'1px solid transparent',boxShadow:'none'},inverse:{background:'var(--surface-inverse)',border:'1px solid transparent',boxShadow:'none',color:'var(--text-on-inverse)'},accent:{background:'var(--surface-accent-soft)',border:'1px solid var(--marine-100)',boxShadow:'none'}}[variant];
  return <div onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} style={{borderRadius:'var(--radius-lg)',padding,...base,...(interactive&&h?{boxShadow:'var(--shadow-md)',transform:'translateY(-1px)',cursor:'pointer'}:{}),transition:'box-shadow var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out)',...style}} {...rest}>{children}</div>;
}
