import React from 'react';
export function Tooltip({content,placement='top',children}){
  const [o,setO]=React.useState(false);
  const pos=placement==='bottom'?{top:'calc(100% + 8px)'}:{bottom:'calc(100% + 8px)'};
  return <span onMouseEnter={()=>setO(true)} onMouseLeave={()=>setO(false)} onFocus={()=>setO(true)} onBlur={()=>setO(false)} style={{position:'relative',display:'inline-flex'}}>
    {children}
    <span role="tooltip" style={{position:'absolute',left:'50%',transform:'translateX(-50%) translateY('+(o?0:4)+'px)',...pos,opacity:o?1:0,pointerEvents:'none',transition:'opacity var(--dur-fast), transform var(--dur-fast) var(--ease-out)',background:'var(--prussian-blue)',color:'var(--white)',fontFamily:'var(--font-body)',fontSize:13,lineHeight:1.4,padding:'6px 10px',borderRadius:8,whiteSpace:'nowrap',boxShadow:'var(--shadow-md)',zIndex:20}}>{content}</span>
  </span>;
}
