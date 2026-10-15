import * as React from 'react';
/** Large circular mic button — the single hero control of the practice screen. */
export interface RecordButtonProps{
  recording?:boolean;
  onToggle?:()=>void;
  /** Diameter px. Default 88. */
  size?:number;
  style?:React.CSSProperties;
}
export function RecordButton(props:RecordButtonProps):JSX.Element;
