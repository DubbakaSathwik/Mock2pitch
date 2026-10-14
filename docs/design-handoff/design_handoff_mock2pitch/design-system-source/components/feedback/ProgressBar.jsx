import React from 'react';
const C={marine:'var(--bright-marine)',success:'var(--success-500)',warning:'var(--warning-500)',danger:'var(--danger-500)',navy:'var(--imperial-blue)'};
export function ProgressBar({value=0,max=100,tone='marine',height=8,label,valueLabel,style}){
  const pct=Math.max(0,Math.min(100,value/max*100));
  return <div style={{display:'flex',flexDirection:'column',gap:6,fontFamily:'var(--font-body)',...style}}>
    {(label||valueLabel)&&<div style={{display:'flex',justifyContent:'space-between',fontSize:14}}><span style={{color:'var(--text-body)'}}>{label}</span><span style={{fontWeight:700,color:'var(--text-strong)'}}>{valueLabel}</span></div>}
    <div style={{height,borderRadius:height,background:'var(--ink-100)',overflow:'hidden'}}><div style={{width:pct+'%',height:'100%',borderRadius:height,background:C[tone]||tone,transition:'width var(--dur-slow) var(--ease-out)'}}></div></div>
  </div>;
}
