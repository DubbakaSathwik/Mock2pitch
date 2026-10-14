import React from 'react';
import { Icon } from '../core/Icon.jsx';
const T={good:['circle-check','var(--success-500)','var(--success-50)'],tip:['lightbulb','var(--bright-marine)','var(--marine-50)'],fix:['triangle-alert','var(--warning-500)','var(--warning-50)']};
export function FeedbackItem({kind='tip',title,children,meta,style}){
  const [ic,c,bg]=T[kind]||T.tip;
  return <div style={{display:'flex',gap:14,padding:'14px 0',fontFamily:'var(--font-body)',...style}}>
    <span style={{width:36,height:36,flexShrink:0,borderRadius:18,background:bg,display:'inline-flex',alignItems:'center',justifyContent:'center'}}><Icon name={ic} size={18} color={c}/></span>
    <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',gap:4}}>
      <div style={{display:'flex',gap:10,alignItems:'baseline',flexWrap:'wrap'}}><span style={{fontWeight:700,fontSize:16,color:'var(--text-strong)'}}>{title}</span>{meta&&<span style={{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--text-muted)'}}>{meta}</span>}</div>
      {children&&<span style={{fontSize:15,lineHeight:1.55,color:'var(--text-body)'}}>{children}</span>}
    </div>
  </div>;
}
