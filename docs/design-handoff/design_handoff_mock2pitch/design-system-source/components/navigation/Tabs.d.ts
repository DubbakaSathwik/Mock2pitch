import * as React from 'react';
/** Tab switcher: segmented pill (default) or underline. Controlled. */
export interface TabsProps{
  items:(string|{value:string;label:React.ReactNode})[];
  value:string;
  onChange?:(value:string)=>void;
  variant?:'segmented'|'underline';
  style?:React.CSSProperties;
}
export function Tabs(props:TabsProps):JSX.Element;
