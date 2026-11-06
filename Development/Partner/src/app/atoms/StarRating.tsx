import { Star } from '@phosphor-icons/react'

interface StarRatingProps {
  /** How many of the five stars to fill. Clamped, so a bad value cannot overflow. */
  rating: number
  size?: number
  /**
   * Accessible label, e.g. `"Rated 5 out of 5"`. Without it the row of icons is
   * announced as nothing at all — the stars carry the rating and no adjacent text
   * repeats it.
   */
  label?: string
}

/**
 * The five-star rating display.
 *
 * Promoted to an atom by J6G. It previously lived in
 * `modules/restaurants/restaurantDetail.utils.tsx` — written and tested, but never
 * used in production, while the same `[1,2,3,4,5].map` block was hand-rolled six
 * times across the restaurants and minglers prototypes. Those copies are left alone;
 * new surfaces use this.
 *
 * ## Why `weight` and not just colour (MET-1312)
 *
 * Phosphor's default `regular` weight is a **single outline path** — the outer star
 * boundary followed by an inner cut-out — so painting it with the rating colour draws
 * an amber *ring*, and the whole column reads as empty however high the rating is.
 * `weight="fill"` is the only weight whose path is the solid star. The empty state is
 * the opposite trick: `regular` painted grey is already the conventional hollow star,
 * so it needs no `fill="none"`/`stroke` pair (which only traced both boundaries at the
 * default 1px stroke-width, making empty and "filled" all but indistinguishable).
 */
export function StarRating({ rating, size = 14, label }: StarRatingProps) {
  const filled = Math.min(5, Math.max(0, Math.round(rating)))

  return (
    <span
      className="inline-flex gap-[2px]"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const isFilled = star <= filled

        return (
          <Star
            key={star}
            size={size}
            className="shrink-0"
            // The weight is what makes a star look filled — not the colour (MET-1312).
            weight={isFilled ? 'fill' : 'regular'}
            fill={isFilled ? 'var(--color-rating)' : 'var(--color-border-strong)'}
          />
        )
      })}
    </span>
  )
}
