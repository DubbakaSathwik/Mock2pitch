import React from 'react';
export function LevelMeter({levels=[],active=true,color='var(--bright-marine)',height=48,barWidth=4,gap=3,style}){
  return <div aria-hidden="true" style={{display:'flex',alignItems:'center',gap,height,...style}}>
    {levels.map((l,i)=><span key={i} style={{width:barWidth,height:Math.max(barWidth,l*height),borderRadius:barWidth,background:active?color:'var(--ink-300)',transition:'height 90ms linear'}}></span>)}
  </div>;
}
