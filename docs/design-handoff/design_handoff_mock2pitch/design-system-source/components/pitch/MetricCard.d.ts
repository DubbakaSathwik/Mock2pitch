import * as React from 'react';
/**
 * Report KPI tile: icon, label, big Autour One number, verdict badge.
 * @startingPoint section="Pitch" subtitle="Performance report metric tiles" viewport="700x200"
 */
export interface MetricCardProps{
  /** Lucide icon name */
  icon?:string;
  label:string;
  value:React.ReactNode;
  unit?:string;
  caption?:React.ReactNode;
  status?:string;
  statusTone?:'neutral'|'info'|'success'|'warning'|'danger'|'violet';
  style?:React.CSSProperties;
}
export function MetricCard(props:MetricCardProps):JSX.Element;
