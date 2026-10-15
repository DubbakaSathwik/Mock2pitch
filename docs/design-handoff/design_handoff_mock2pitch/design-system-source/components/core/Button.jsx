import React from 'react';
import { Icon } from './Icon.jsx';
const SIZES={sm:{h:36,px:14,fs:14,ic:16},md:{h:44,px:20,fs:15,ic:18},lg:{h:52,px:26,fs:17,ic:20}};
const V={
  primary:{bg:'var(--action-primary)',hover:'var(--action-primary-hover)',press:'var(--action-primary-press)',fg:'var(--white)',bd:'transparent'},
  accent:{bg:'var(--action-accent)',hover:'var(--action-accent-hover)',press:'var(--marine-700)',fg:'var(--white)',bd:'transparent'},
  secondary:{bg:'var(--white)',hover:'var(--marine-50)',press:'var(--marine-100)',fg:'var(--imperial-blue)',bd:'var(--border-strong)'},
  ghost:{bg:'transparent',hover:'var(--ink-100)',press:'var(--ink-200)',fg:'var(--imperial-blue)',bd:'transparent'},
  record:{bg:'var(--danger-500)',hover:'#C03A3A',press:'#A93232',fg:'var(--white)',bd:'transparent'},
  inverse:{bg:'var(--icy-blue)',hover:'#C4ECFC',press:'#8FD5F3',fg:'var(--prussian-blue)',bd:'transparent'}
};
export function Button({variant='primary',size='md',iconLeft,iconRight,fullWidth,disabled,children,style,...rest}){
  const [h,setH]=React.useState(false);const [p,setP]=React.useState(false);
  const v=V[variant]||V.primary;const s=SIZES[size]||SIZES.md;
  const bg=disabled?'var(--ink-200)':p?v.press:h?v.hover:v.bg;
  return <button disabled={disabled} onMouseEnter={()=>setH(true)} onMouseLeave={()=>{setH(false);setP(false)}} onMouseDown={()=>setP(true)} onMouseUp={()=>setP(false)}
    style={{display:fullWidth?'flex':'inline-flex',width:fullWidth?'100%':undefined,alignItems:'center',justifyContent:'center',gap:8,height:s.h,padding:'0 '+s.px+'px',borderRadius:'var(--radius-pill)',border:'1px solid '+(disabled?'transparent':v.bd),background:bg,color:disabled?'var(--ink-400)':v.fg,fontFamily:'var(--font-display)',fontSize:s.fs,letterSpacing:'.01em',cursor:disabled?'not-allowed':'pointer',transform:p&&!disabled?'scale(.97)':'none',transition:'background var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out)',whiteSpace:'nowrap',...style}} {...rest}>
    {iconLeft&&<Icon name={iconLeft} size={s.ic}/>}{children}{iconRight&&<Icon name={iconRight} size={s.ic}/>}
  </button>;
}
