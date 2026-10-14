import * as React from 'react';
/** On/off toggle, Bright Marine when on. */
export interface SwitchProps{
  checked?:boolean;
  onChange?:(checked:boolean)=>void;
  label?:React.ReactNode;
  disabled?:boolean;
  style?:React.CSSProperties;
}
export function Switch(props:SwitchProps):JSX.Element;
