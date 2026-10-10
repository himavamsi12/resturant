import type { CSSProperties } from 'react';

/** Four-sided soft fade so the photo melts into the grey canvas like a product shot. */
const FADE = 'linear-gradient(to right, transparent 0%, #000 16%, #000 82%, transparent 100%), linear-gradient(to bottom, transparent 0%, #000 22%, #000 76%, transparent 100%)';

export const photoFadeStyle: CSSProperties = {
  filter: 'saturate(.8) contrast(1.02)',
  WebkitMaskImage: FADE, maskImage: FADE, WebkitMaskComposite: 'source-in', maskComposite: 'intersect',
};

/** Restaurant hero photo — Declan Sun / Unsplash (Unsplash License). */
export default function RestaurantPhoto({ className }: { className?: string }) {
  return (
    <img src={`${import.meta.env.BASE_URL}hero-restaurant.jpg`} alt="DineFlow restaurant terrace"
      className={`pointer-events-none aspect-[16/9] object-cover ${className || ''}`} style={photoFadeStyle} />
  );
}
