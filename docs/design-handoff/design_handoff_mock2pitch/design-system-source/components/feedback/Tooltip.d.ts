import * as React from 'react';
/** Hover/focus tooltip on Prussian Blue. */
export interface TooltipProps{
  content:React.ReactNode;
  placement?:'top'|'bottom';
  children:React.ReactNode;
}
export function Tooltip(props:TooltipProps):JSX.Element;
