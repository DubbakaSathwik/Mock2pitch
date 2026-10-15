import * as React from 'react';
/** Small status pill — report states, file status, counts. */
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>{
  tone?:'neutral'|'info'|'success'|'warning'|'danger'|'violet'|'solid';
  /** Leading status dot */
  dot?:boolean;
  children?:React.ReactNode;
}
export function Badge(props:BadgeProps):JSX.Element;
