import * as React from 'react';
/**
 * Pill-shaped action button set in Autour One.
 * @startingPoint section="Core" subtitle="Primary, accent, secondary, ghost, record buttons" viewport="700x260"
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>{
  variant?:'primary'|'accent'|'secondary'|'ghost'|'record'|'inverse';
  size?:'sm'|'md'|'lg';
  /** Lucide icon name before the label */
  iconLeft?:string;
  iconRight?:string;
  fullWidth?:boolean;
  children?:React.ReactNode;
}
export function Button(props:ButtonProps):JSX.Element;
