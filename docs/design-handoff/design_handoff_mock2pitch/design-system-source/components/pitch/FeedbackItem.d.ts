import * as React from 'react';
/** One coaching note in the report: strength, tip, or fix. */
export interface FeedbackItemProps{
  kind?:'good'|'tip'|'fix';
  title:React.ReactNode;
  children?:React.ReactNode;
  /** Timestamp or slide ref, e.g. "02:14 · Slide 5" */
  meta?:string;
  style?:React.CSSProperties;
}
export function FeedbackItem(props:FeedbackItemProps):JSX.Element;
