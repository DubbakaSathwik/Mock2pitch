import * as React from 'react';
/** Lucide icon (CDN icon font, lucide-static@0.452.0). 2px stroke, rounded caps. */
export interface IconProps extends React.HTMLAttributes<HTMLElement>{
  /** Lucide icon name in kebab-case, e.g. "mic", "presentation", "timer". */
  name:string;
  /** Pixel size. Default 20. */
  size?:number;
  color?:string;
}
export function Icon(props:IconProps):JSX.Element;
