import React from 'react';
import { Icon } from '../core/Icon.jsx';
export function FileDropzone({title='Drop your slides here',hint='PDF or PPTX, up to 50 MB',file,onSelect,onClear,style}){
  const [over,setOver]=React.useState(false);const ref=React.useRef(null);
  if(file){return <div style={{display:'flex',alignItems:'center',gap:14,padding:16,borderRadius:'var(--radius-lg)',border:'1px solid var(--border-subtle)',background:'var(--white)',...style}}>
    <span style={{width:44,height:44,borderRadius:12,background:'var(--marine-50)',display:'flex',alignItems:'center',justifyContent:'center'}}><Icon name="file-text" size={22} color="var(--bright-marine)"/></span>
    <span style={{flex:1,minWidth:0,display:'flex',flexDirection:'column'}}><span style={{fontWeight:700,color:'var(--text-strong)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{file.name}</span><span style={{fontSize:13,color:'var(--text-muted)'}}>{file.meta}</span></span>
    {onClear&&<button onClick={onClear} aria-label="Remove file" style={{border:'none',background:'transparent',cursor:'pointer',color:'var(--ink-500)',padding:6}}><Icon name="x" size={18}/></button>}
  </div>;}
  return <div onClick={()=>ref.current&&ref.current.click()} onDragOver={e=>{e.preventDefault();setOver(true)}} onDragLeave={()=>setOver(false)} onDrop={e=>{e.preventDefault();setOver(false);const f=e.dataTransfer.files[0];f&&onSelect&&onSelect(f)}}
    style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10,padding:'36px 24px',borderRadius:'var(--radius-lg)',border:'2px dashed '+(over?'var(--bright-marine)':'var(--marine-200)'),background:over?'var(--marine-100)':'var(--marine-50)',cursor:'pointer',textAlign:'center',transition:'all var(--dur-base) var(--ease-out)',fontFamily:'var(--font-body)',...style}}>
    <span style={{width:52,height:52,borderRadius:26,background:'var(--white)',boxShadow:'var(--shadow-sm)',display:'flex',alignItems:'center',justifyContent:'center'}}><Icon name="upload" size={24} color="var(--bright-marine)"/></span>
    <span style={{fontFamily:'var(--font-display)',fontSize:17,color:'var(--text-strong)'}}>{title}</span>
    <span style={{fontSize:14,color:'var(--text-muted)'}}>{hint}</span>
    <input ref={ref} type="file" accept=".pdf,.ppt,.pptx" hidden onChange={e=>{const f=e.target.files[0];f&&onSelect&&onSelect(f)}}/>
  </div>;
}
