import React from 'react';
import { Icon } from '../core/Icon.jsx';
export function RecordButton({recording,onToggle,size=88,style}){
  const [h,setH]=React.useState(false);
  return <button onClick={onToggle} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} aria-label={recording?'Stop recording':'Start recording'}
    style={{width:size,height:size,borderRadius:'50%',border:'none',cursor:'pointer',background:recording?'var(--danger-500)':h?'var(--action-primary-hover)':'var(--action-primary)',color:'var(--white)',display:'inline-flex',alignItems:'center',justifyContent:'center',boxShadow:recording?'0 0 0 8px rgba(214,69,69,.18), 0 0 0 18px rgba(214,69,69,.08)':'0 0 0 8px rgba(14,107,168,.14)',transition:'all var(--dur-base) var(--ease-out)',...style}}>
    {recording?<span style={{width:size*.3,height:size*.3,borderRadius:6,background:'var(--white)'}}></span>:<Icon name="mic" size={Math.round(size*.38)}/>}
  </button>;
}
