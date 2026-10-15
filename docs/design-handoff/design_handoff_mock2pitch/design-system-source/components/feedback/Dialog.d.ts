import * as React from 'react';
/** Modal dialog with navy-tinted blurred scrim. */
export interface DialogProps{
  open?:boolean;
  title:React.ReactNode;
  children?:React.ReactNode;
  /** Buttons, right-aligned */
  actions?:React.ReactNode;
  onClose?:()=>void;
  width?:number;
  /** Render the panel without the fixed scrim (for docs/previews) */
  inline?:boolean;
  style?:React.CSSProperties;
}
export function Dialog(props:DialogProps):JSX.Element;
