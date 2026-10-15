import * as React from 'react';
/** Single radio option. Group several with a shared value in parent state. */
export interface RadioProps{
  checked?:boolean;
  onChange?:(value:string)=>void;
  label?:React.ReactNode;
  name?:string;
  value:string;
  disabled?:boolean;
  style?:React.CSSProperties;
}
export function Radio(props:RadioProps):JSX.Element;
