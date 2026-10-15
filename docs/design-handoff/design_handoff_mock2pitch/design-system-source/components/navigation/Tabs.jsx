import React from 'react';
export function Tabs({items=[],value,onChange,variant='segmented',style}){
  if(variant==='underline'){
    return <div role="tablist" style={{display:'flex',gap:24,borderBottom:'1px solid var(--border-subtle)',...style}}>
      {items.map(it=>{const id=it.value||it;const on=id===value;return <button key={id} role="tab" aria-selected={on} onClick={()=>onChange&&onChange(id)} style={{border:'none',background:'transparent',padding:'10px 0',marginBottom:-1,borderBottom:'2px solid '+(on?'var(--bright-marine)':'transparent'),color:on?'var(--text-strong)':'var(--text-muted)',fontFamily:'var(--font-display)',fontSize:15,cursor:'pointer'}}>{it.label||it}</button>})}
    </div>;
  }
  return <div role="tablist" style={{display:'inline-flex',gap:4,padding:4,borderRadius:'var(--radius-pill)',background:'var(--ink-100)',...style}}>
    {items.map(it=>{const id=it.value||it;const on=id===value;return <button key={id} role="tab" aria-selected={on} onClick={()=>onChange&&onChange(id)} style={{border:'none',height:36,padding:'0 16px',borderRadius:'var(--radius-pill)',background:on?'var(--white)':'transparent',boxShadow:on?'var(--shadow-sm)':'none',color:on?'var(--text-strong)':'var(--text-muted)',fontFamily:'var(--font-display)',fontSize:14,cursor:'pointer',transition:'all var(--dur-fast)'}}>{it.label||it}</button>})}
  </div>;
}
