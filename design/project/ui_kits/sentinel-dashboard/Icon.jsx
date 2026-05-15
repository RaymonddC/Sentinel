// Icon.jsx — Lucide wrapper. Renders <i data-lucide="name"> and re-creates icons on mount.

const Icon = ({ name, size = 16, color, style, className }) => {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (window.lucide && ref.current) {
      // createIcons replaces the <i> with an <svg>. Scope to our element.
      window.lucide.createIcons({ icons: window.lucide.icons, nameAttr: "data-lucide" });
    }
  });
  return (
    <i
      ref={ref}
      data-lucide={name}
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        display: "inline-flex",
        color: color || "currentColor",
        strokeWidth: 1.5,
        flexShrink: 0,
        ...style,
      }}
      className={className}
    />
  );
};

window.Icon = Icon;
