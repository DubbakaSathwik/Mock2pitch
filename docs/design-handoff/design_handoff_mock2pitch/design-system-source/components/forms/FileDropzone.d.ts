import * as React from 'react';
/**
 * Slide upload target (PDF/PPTX). Shows a file row once a file is chosen.
 * @startingPoint section="Forms" subtitle="Slide upload dropzone" viewport="700x320"
 */
export interface FileDropzoneProps{
  title?:string;
  hint?:string;
  /** When set, renders the uploaded-file row instead of the drop target */
  file?:{name:string;meta?:string}|null;
  onSelect?:(file:File)=>void;
  onClear?:()=>void;
  style?:React.CSSProperties;
}
export function FileDropzone(props:FileDropzoneProps):JSX.Element;
