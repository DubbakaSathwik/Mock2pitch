import * as React from 'react';
/** Vertical-bar audio level meter. Pass live levels (0–1) from the mic analyser. */
export interface LevelMeterProps{
  /** Values 0–1, one per bar */
  levels:number[];
  active?:boolean;
  color?:string;
  height?:number;
  barWidth?:number;
  gap?:number;
  style?:React.CSSProperties;
}
export function LevelMeter(props:LevelMeterProps):JSX.Element;
