export default function LazyImage({ src, thumb, alt = '', className, ...props }) {
  return (
    <img
      src={thumb || src}
      srcSet={thumb && src && thumb !== src ? `${thumb} 480w, ${src} 1600w` : undefined}
      sizes="(max-width: 640px) 480px, 1600px"
      loading="lazy"
      decoding="async"
      alt={alt}
      className={className}
      {...props}
    />
  );
}
