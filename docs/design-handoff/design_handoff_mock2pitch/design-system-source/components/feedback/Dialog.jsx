import React from 'react';
import { IconButton } from '../core/IconButton.jsx';
export function Dialog({open=true,title,children,actions,onClose,width=480,inline,style}){
  if(!open)return null;
  const panel=<div role="dialog" aria-modal="true" style={{width,maxWidth:'100%',background:'var(--white)',borderRadius:'var(--radius-xl)',boxShadow:'var(--shadow-lg)',padding:28,display:'flex',flexDirection:'column',gap:16,fontFamily:'var(--font-body)',...style}}>
    <div style={{display:'flex',alignItems:'flex-start',gap:12}}><h3 style={{flex:1,margin:0,fontFamily:'var(--font-display)',fontWeight:400,fontSize:22,color:'var(--text-strong)'}}>{title}</h3>{onClose&&<IconButton icon="x" label="Close" size={32} onClick={onClose}/>}</div>
    <div style={{color:'var(--text-body)',fontSize:16,lineHeight:1.6}}>{children}</div>
    {actions&&<div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:4}}>{actions}</div>}
  </div>;
  if(inline)return panel;
  return <div onClick={e=>{if(e.target===e.currentTarget&&onClose)onClose()}} style={{position:'fixed',inset:0,background:'rgba(0,7,45,.45)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',padding:24,zIndex:100}}>{panel}</div>;
}
