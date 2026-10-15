import React from 'react';
export function Radio({checked,onChange,label,name,value,disabled,style}){
  return <label style={{display:'inline-flex',alignItems:'center',gap:10,cursor:disabled?'not-allowed':'pointer',opacity:disabled?.5:1,fontFamily:'var(--font-body)',fontSize:15,color:'var(--text-body)',...style}}>
    <span onClick={()=>!disabled&&onChange&&onChange(value)} style={{width:20,height:20,borderRadius:10,border:'1.5px solid '+(checked?'var(--imperial-blue)':'var(--border-strong)'),background:'var(--white)',display:'inline-flex',alignItems:'center',justifyContent:'center'}}>{checked&&<span style={{width:10,height:10,borderRadius:5,background:'var(--imperial-blue)'}}></span>}</span>
    {label}
  </label>;
}
