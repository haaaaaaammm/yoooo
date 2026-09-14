"use client";

import { useState } from "react";

export default function LinkPreviewImage({
  alt,
  className,
  src,
}: {
  alt: string;
  className: string;
  src: string;
}) {
  const [failed, setFailed] = useState(false);

  return failed ? null : (
    // Arbitrary preview hosts cannot be safely enumerated for next/image.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setFailed(true)}
      referrerPolicy="no-referrer"
      src={src}
    />
  );
}
