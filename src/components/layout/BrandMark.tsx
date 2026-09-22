/**
 * The SKY LAB mark, painted through the logo as a mask so it takes the
 * theme's colour: the file's own pink all but disappears on the light theme.
 */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 bg-(--logo)"
      style={{
        width: size,
        height: size,
        mask: 'url(/skylab.svg) center / contain no-repeat',
        WebkitMask: 'url(/skylab.svg) center / contain no-repeat',
      }}
    />
  );
}
