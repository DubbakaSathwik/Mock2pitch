import * as React from 'react';
/** Rounded linear progress / meter. */
export interface ProgressBarProps{
  value:number;
  max?:number;
  tone?:'marine'|'success'|'warning'|'danger'|'navy';
  /** Track height px. Default 8. */
  height?:number;
  label?:React.ReactNode;
  valueLabel?:React.ReactNode;
  style?:React.CSSProperties;
}
export function ProgressBar(props:ProgressBarProps):JSX.Element;
