import * as React from 'react';
/** Circular overall score (0–100). Echoes the logo's open arc. */
export interface ScoreRingProps{
  value:number;
  size?:number;
  stroke?:number;
  label?:string;
  color?:string;
  track?:string;
  textColor?:string;
  style?:React.CSSProperties;
}
export function ScoreRing(props:ScoreRingProps):JSX.Element;
