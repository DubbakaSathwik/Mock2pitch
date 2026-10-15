import * as React from 'react';
/**
 * Rounded 16px container — the main grouping surface.
 * @startingPoint section="Core" subtitle="Default, sunken, accent and inverse cards" viewport="700x300"
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement>{
  variant?:'default'|'sunken'|'inverse'|'accent';
  /** Inner padding px. Default 24. */
  padding?:number;
  /** Lift on hover */
  interactive?:boolean;
  children?:React.ReactNode;
}
export function Card(props:CardProps):JSX.Element;
