import * as React from 'react';
/** Square checkbox with 6px radius. Controlled. */
export interface CheckboxProps{
  checked?:boolean;
  onChange?:(checked:boolean)=>void;
  label?:React.ReactNode;
  disabled?:boolean;
  style?:React.CSSProperties;
}
export function Checkbox(props:CheckboxProps):JSX.Element;
