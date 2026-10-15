import React from 'react';
import { Icon } from '../core/Icon.jsx';
import { Badge } from '../core/Badge.jsx';
export function MetricCard({icon,label,value,unit,caption,status,statusTone='neutral',style}){
  return <div style={{background:'var(--surface-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-lg)',boxShadow:'var(--shadow-sm)',padding:20,display:'flex',flexDirection:'column',gap:12,fontFamily:'var(--font-body)',minWidth:0,...style}}>
    <div style={{display:'flex',alignItems:'center',gap:10}}>
      {icon&&<span style={{width:32,height:32,borderRadius:10,background:'var(--marine-50)',display:'inline-flex',alignItems:'center',justifyContent:'center'}}><Icon name={icon} size={17} color="var(--bright-marine)"/></span>}
      <span style={{flex:1,fontSize:14,fontWeight:700,color:'var(--text-body)'}}>{label}</span>
      {status&&<Badge tone={statusTone}>{status}</Badge>}
    </div>
    <div style={{display:'flex',alignItems:'baseline',gap:6}}><span style={{fontFamily:'var(--font-display)',fontSize:'var(--text-metric)',lineHeight:1,color:'var(--text-strong)'}}>{value}</span>{unit&&<span style={{fontSize:15,color:'var(--text-muted)'}}>{unit}</span>}</div>
    {caption&&<span style={{fontSize:14,color:'var(--text-muted)'}}>{caption}</span>}
  </div>;
}
