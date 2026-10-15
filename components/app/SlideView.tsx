"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import styles from "./SlideView.module.css";

export type SlideViewProps = {
  src?: string | null; alt: string; loading?: boolean;
  /** Called once when the image fails (e.g. an expired signed URL) so the caller can refetch fresh URLs. */
  onRefetch?: () => void; flat?: boolean; style?: CSSProperties; radius?: number;
};

/** Real slide image in a 16:9 frame (letterboxed), with skeleton and broken/expired-URL fallback that refetches once. */
export function SlideView({ src, alt, loading, onRefetch, flat, style, radius = 8 }: SlideViewProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const retried = useRef(false);
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    setFailed(false);
    // An image that finished loading before hydration never fires onLoad again.
    const el = imgRef.current;
    setLoaded(!!el && el.complete && el.naturalWidth > 0);
  }, [src]);
  const showSkeleton = (!src && !failed) || (!!src && !loaded && !failed) || !!loading;
  return (
    <div className={`${styles.frame} ${flat ? styles.flat : ""}`} style={{ borderRadius: radius, ...style }} data-testid="slide-view">
      {src && !failed && (
        <img ref={imgRef} src={src} alt={alt} className={`${styles.img} ${loaded ? styles.in : ""}`} onLoad={() => setLoaded(true)} draggable={false}
          onError={() => { if (!retried.current && onRefetch) { retried.current = true; onRefetch(); } else setFailed(true); }} />
      )}
      {showSkeleton && !failed && <div className={styles.skeleton} aria-hidden="true" />}
      {failed && <div className={styles.fail} role="img" aria-label={`${alt} (image unavailable)`}>Slide image unavailable</div>}
    </div>
  );
}
