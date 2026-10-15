import * as React from 'react';
/** Labeled text field with optional leading icon, hint and error. */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement>{
  label?:string;
  hint?:string;
  error?:string;
  /** Lucide icon name */
  icon?:string;
}
export function Input(props:InputProps):JSX.Element;
