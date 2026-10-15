import * as React from 'react';
/** Circular icon-only button. Always pass a label for accessibility. */
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>{
  /** Lucide icon name */
  icon:string;
  label:string;
  variant?:'ghost'|'secondary'|'primary'|'inverse';
  /** Diameter in px. Default 40. */
  size?:number;
}
export function IconButton(props:IconButtonProps):JSX.Element;
