import { ACCENT_STYLES, ToolAccent } from '@/app/data/pdf-tools';

interface ToolIconProps {
  toolId: string;
  accent: ToolAccent;
  size?: 'sm' | 'md' | 'lg';
}

function DualConvertBadge({
  softHex,
  primaryHex,
  direction,
  formatSymbol,
  sizeClass,
}: {
  softHex: string;
  primaryHex: string;
  direction: 'to-pdf' | 'from-pdf';
  formatSymbol: 'jpg' | 'word' | 'ppt' | 'excel' | 'html' | 'pdfa';
  sizeClass: string;
}) {
  const renderSymbol = (color: string) => {
    switch (formatSymbol) {
      case 'jpg':
        return (
          <g>
            <circle cx="6.2" cy="5.6" r="1.35" fill={color} />
            <path
              d="M3.2 12.2L6.6 8.6L9.1 11.1L10.8 9.4L13.2 12.2H3.2Z"
              fill={color}
            />
          </g>
        );
      case 'word':
        return (
          <text
            x="8"
            y="11.3"
            textAnchor="middle"
            fill={color}
            fontSize="8.8"
            fontWeight="800"
            fontFamily="system-ui, sans-serif"
          >
            W
          </text>
        );
      case 'ppt':
        return (
          <text
            x="8"
            y="11.3"
            textAnchor="middle"
            fill={color}
            fontSize="8.8"
            fontWeight="800"
            fontFamily="system-ui, sans-serif"
          >
            P
          </text>
        );
      case 'excel':
        return (
          <text
            x="8"
            y="11.3"
            textAnchor="middle"
            fill={color}
            fontSize="8.8"
            fontWeight="800"
            fontFamily="system-ui, sans-serif"
          >
            X
          </text>
        );
      case 'html':
        return (
          <g stroke={color} strokeWidth="1.25" fill="none">
            <circle cx="8" cy="8" r="4.4" />
            <ellipse cx="8" cy="8" rx="2.1" ry="4.4" />
            <line x1="3.8" y1="8" x2="12.2" y2="8" />
          </g>
        );
      case 'pdfa':
        return (
          <text
            x="8"
            y="11"
            textAnchor="middle"
            fill={color}
            fontSize="7.5"
            fontWeight="800"
            fontFamily="ui-monospace, monospace"
          >
            /A
          </text>
        );
    }
  };

  const renderArrow = (color: string) => (
    <path
      d="M5.2 5.2L10.8 10.8M10.8 10.8V6.4M10.8 10.8H6.4"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  );

  return (
    <svg viewBox="0 0 28 28" className={sizeClass} aria-hidden="true">
      {/* Top-Left Soft Tile */}
      <rect x="2" y="2" width="16" height="16" rx="3.2" fill={softHex} />
      {/* Bottom-Right Solid Tile */}
      <rect
        x="10"
        y="10"
        width="16"
        height="16"
        rx="3.2"
        fill={primaryHex}
        stroke="#FFFFFF"
        strokeWidth="1.2"
      />
      {direction === 'to-pdf' ? (
        <>
          <g transform="translate(2, 2)">{renderSymbol(primaryHex)}</g>
          <g transform="translate(10, 10)">{renderArrow('#FFFFFF')}</g>
        </>
      ) : (
        <>
          <g transform="translate(2, 2)">{renderArrow(primaryHex)}</g>
          <g transform="translate(10, 10)">{renderSymbol('#FFFFFF')}</g>
        </>
      )}
    </svg>
  );
}

export function ToolIcon({ toolId, accent, size = 'md' }: ToolIconProps) {
  const palette = ACCENT_STYLES[accent];
  const sizeClass =
    size === 'sm'
      ? 'h-6 w-6'
      : size === 'lg'
        ? 'h-13 w-13'
        : 'h-11 w-11';

  // Convert To / From PDF use the signature dual-overlapping tile icon motif
  const convertMap: Record<
    string,
    {
      direction: 'to-pdf' | 'from-pdf';
      symbol: 'jpg' | 'word' | 'ppt' | 'excel' | 'html' | 'pdfa';
    }
  > = {
    'jpg-to-pdf': { direction: 'to-pdf', symbol: 'jpg' },
    'word-to-pdf': { direction: 'to-pdf', symbol: 'word' },
    'powerpoint-to-pdf': { direction: 'to-pdf', symbol: 'ppt' },
    'excel-to-pdf': { direction: 'to-pdf', symbol: 'excel' },
    'html-to-pdf': { direction: 'to-pdf', symbol: 'html' },
    'pdf-to-jpg': { direction: 'from-pdf', symbol: 'jpg' },
    'pdf-to-word': { direction: 'from-pdf', symbol: 'word' },
    'pdf-to-powerpoint': { direction: 'from-pdf', symbol: 'ppt' },
    'pdf-to-excel': { direction: 'from-pdf', symbol: 'excel' },
    'pdf-to-pdfa': { direction: 'from-pdf', symbol: 'pdfa' },
  };

  if (convertMap[toolId]) {
    const cfg = convertMap[toolId];
    return (
      <DualConvertBadge
        softHex={palette.softHex}
        primaryHex={palette.primaryHex}
        direction={cfg.direction}
        formatSymbol={cfg.symbol}
        sizeClass={sizeClass}
      />
    );
  }

  // Standard solid rounded badge with crisp white vector glyph
  const renderGlyph = () => {
    switch (toolId) {
      case 'merge-pdf':
        return (
          <g
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          >
            <path d="M7 8L12 13L7 18" />
            <path d="M21 8L16 13L21 18" />
            <path d="M12 13H6" />
            <path d="M16 13H22" />
            <circle cx="14" cy="21" r="1.4" fill="#FFFFFF" stroke="none" />
          </g>
        );
      case 'split-pdf':
        return (
          <g
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          >
            <path d="M14 6V22" strokeDasharray="2.5 2.5" />
            <path d="M10 10L6 14L10 18" />
            <path d="M18 10L22 14L18 18" />
          </g>
        );
      case 'remove-pages':
        return (
          <g
            stroke="#FFFFFF"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          >
            <path d="M9 9L19 19" />
            <path d="M19 9L9 19" />
          </g>
        );
      case 'extract-pages':
        return (
          <g
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          >
            <path d="M8 10V20H18" />
            <path d="M12 16L21 7" />
            <path d="M15 7H21V13" />
          </g>
        );
      case 'organize-pdf':
        return (
          <g fill="#FFFFFF">
            <rect x="6" y="6" width="6.5" height="6.5" rx="1.4" />
            <rect x="15.5" y="6" width="6.5" height="6.5" rx="1.4" opacity="0.72" />
            <rect x="6" y="15.5" width="6.5" height="6.5" rx="1.4" opacity="0.72" />
            <rect x="15.5" y="15.5" width="6.5" height="6.5" rx="1.4" />
          </g>
        );
      case 'scan-to-pdf':
        return (
          <g
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          >
            <path d="M6 10V7H9" />
            <path d="M19 7H22V10" />
            <path d="M22 18V21H19" />
            <path d="M9 21H6V18" />
            <line x1="7" y1="14" x2="21" y2="14" />
          </g>
        );
      case 'compress-pdf':
        return (
          <g
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          >
            <path d="M6 6L11 11M11 11V7M11 11H7" />
            <path d="M22 6L17 11M17 11V7M17 11H21" />
            <path d="M6 22L11 17M11 17V21M11 17H7" />
            <path d="M22 22L17 17M17 17V21M17 17H21" />
          </g>
        );
      case 'repair-pdf':
        return (
          <path
            d="M17.5 6.5C15.5 6.5 14 8 14 10C14 10.6 14.1 11.1 14.3 11.6L7.5 18.4C6.8 19.1 6.8 20.2 7.5 20.9C8.2 21.6 9.3 21.6 10 20.9L16.8 14.1C17.3 14.3 17.8 14.4 18.4 14.4C20.4 14.4 21.9 12.9 21.9 10.9C21.9 10.2 21.7 9.6 21.4 9.1L19 11.5L16.9 9.4L19.3 7C18.8 6.7 18.2 6.5 17.5 6.5Z"
            fill="#FFFFFF"
          />
        );
      case 'ocr-pdf':
        return (
          <g
            stroke="#FFFFFF"
            strokeWidth="1.9"
            strokeLinecap="round"
            fill="none"
          >
            <path d="M6 10V7H9M19 7H22V10M22 18V21H19M9 21H6V18" />
            <line x1="9.5" y1="11.5" x2="18.5" y2="11.5" />
            <line x1="9.5" y1="14.5" x2="16.5" y2="14.5" />
            <line x1="9.5" y1="17.5" x2="14.5" y2="17.5" />
          </g>
        );
      case 'rotate-pdf':
        return (
          <g
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          >
            <path d="M20.5 11A7 7 0 1 0 19.5 17.5" />
            <path d="M21 6.5V11.5H16" />
          </g>
        );
      case 'add-page-numbers':
        return (
          <g fill="#FFFFFF" fontFamily="ui-monospace, monospace" fontWeight="800">
            <text x="8" y="13" fontSize="6.8">1</text>
            <text x="16" y="13" fontSize="6.8" opacity="0.78">2</text>
            <text x="8" y="20.5" fontSize="6.8" opacity="0.78">3</text>
            <text x="16" y="20.5" fontSize="6.8">4</text>
          </g>
        );
      case 'add-watermark':
        return (
          <g fill="#FFFFFF">
            <rect x="9" y="16" width="10" height="3.2" rx="1" />
            <path d="M12 16V12.5C12 11 11 10 11 8.8C11 7.2 12.3 6 14 6C15.7 6 17 7.2 17 8.8C17 10 16 11 16 12.5V16H12Z" />
            <rect x="7" y="20.2" width="14" height="1.8" rx="0.9" opacity="0.8" />
          </g>
        );
      case 'crop-pdf':
        return (
          <g
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          >
            <path d="M9 6V19H22" />
            <path d="M6 9H19V22" />
          </g>
        );
      case 'edit-pdf':
        return (
          <path
            d="M17.8 7.2L20.8 10.2L11 20H8V17L17.8 7.2Z"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        );
      case 'pdf-forms':
        return (
          <g fill="#FFFFFF">
            <rect x="6" y="8" width="16" height="4.5" rx="1.5" />
            <rect x="6" y="15.5" width="10" height="4.5" rx="1.5" opacity="0.82" />
            <circle cx="19.5" cy="17.7" r="2.2" />
          </g>
        );
      case 'unlock-pdf':
        return (
          <g
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          >
            <rect x="7.5" y="13" width="13" height="8.5" rx="2" />
            <path d="M10.5 13V9.8A3.5 3.5 0 0 1 17 8.2" />
          </g>
        );
      case 'protect-pdf':
        return (
          <g
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          >
            <path d="M14 5.5L20.5 8.2V13.6C20.5 17.8 17.7 21.1 14 22.4C10.3 21.1 7.5 17.8 7.5 13.6V8.2L14 5.5Z" />
            <circle cx="14" cy="13.5" r="1.5" fill="#FFFFFF" stroke="none" />
          </g>
        );
      case 'sign-pdf':
        return (
          <g
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          >
            <path d="M7 19.5C9.5 15.5 11.5 15.5 13 18.2C14.3 20.5 15.8 16.5 17.5 18.5H21" />
            <path d="M16.5 7L19.5 10L12.5 17H9.5V14L16.5 7Z" />
          </g>
        );
      case 'redact-pdf':
        return (
          <g fill="#FFFFFF">
            <rect x="6.5" y="7.5" width="15" height="3.2" rx="1" />
            <rect x="6.5" y="12.5" width="11" height="3.2" rx="1" opacity="0.55" />
            <rect x="6.5" y="17.5" width="15" height="3.2" rx="1" />
          </g>
        );
      case 'compare-pdf':
        return (
          <g
            stroke="#FFFFFF"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          >
            <rect x="5.5" y="7" width="6.5" height="14" rx="1.2" />
            <rect x="16" y="7" width="6.5" height="14" rx="1.2" />
            <line x1="14" y1="6" x2="14" y2="22" strokeDasharray="2 2" />
          </g>
        );
      case 'ai-summarizer':
        return (
          <g fill="#FFFFFF">
            <path d="M18.5 5.5L19.6 8.4L22.5 9.5L19.6 10.6L18.5 13.5L17.4 10.6L14.5 9.5L17.4 8.4L18.5 5.5Z" />
            <rect x="6" y="9" width="7.5" height="2.2" rx="1.1" />
            <rect x="6" y="13.5" width="12" height="2.2" rx="1.1" />
            <rect x="6" y="18" width="9.5" height="2.2" rx="1.1" />
          </g>
        );
      case 'translate-pdf':
        return (
          <g
            stroke="#FFFFFF"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          >
            <path d="M6.5 9H14.5M10.5 7V9M13 9C12.2 12.2 10 14.5 7 15.8" />
            <path d="M8.5 11.5C9.5 13.2 11 14.6 12.8 15.5" />
            <path d="M15.2 21L18.2 13L21.2 21M16.2 18.5H20.2" />
          </g>
        );
      case 'pdf-to-markdown':
      default:
        return (
          <g fill="#FFFFFF" fontFamily="ui-monospace, monospace" fontWeight="800">
            <text x="14" y="17.5" textAnchor="middle" fontSize="11.5">
              #M
            </text>
          </g>
        );
    }
  };

  return (
    <svg viewBox="0 0 28 28" className={sizeClass} aria-hidden="true">
      <rect
        x="2"
        y="2"
        width="24"
        height="24"
        rx="6"
        fill={palette.primaryHex}
      />
      {/* Subtle top inner gloss for modern tactile finish */}
      <rect
        x="2.5"
        y="2.5"
        width="23"
        height="11"
        rx="5.5"
        fill="#FFFFFF"
        fillOpacity="0.12"
      />
      {renderGlyph()}
    </svg>
  );
}

