import { useId } from 'react';

interface ScorpioLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showOwnerLine?: boolean;
}

function ScorpioO({ gradId }: { gradId: string }) {
  return (
    <span className="relative -mx-[0.015em] inline-flex items-baseline align-baseline">
      <span className="sr-only">o</span>
      <svg
        viewBox="0 0 34 36"
        fill="none"
        aria-hidden="true"
        className="-mb-[0.115em] h-[1.06em] w-[0.98em] shrink-0 drop-shadow-[0_2px_6px_rgba(225,29,72,0.28)]"
      >
        <defs>
          <linearGradient
            id={gradId}
            x1="6"
            y1="5"
            x2="29"
            y2="34"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#FB7185" />
            <stop offset="46%" stopColor="#E11D48" />
            <stop offset="100%" stopColor="#9F1239" />
          </linearGradient>
        </defs>

        {/* Capit Kiri membentuk lengkung kiri-atas huruf o */}
        <path
          d="M10.4 22.0C7.8 19.6 7.4 15.2 10.1 12.5C11.9 10.7 14.6 10.3 16.4 11.4C14.5 11.9 13.3 13.0 13.1 14.5C14.3 13.8 15.7 14.0 16.5 15.1C14.6 15.8 13.0 17.5 12.9 20.6Z"
          fill={`url(#${gradId})`}
        />

        {/* 3 Kaki Geometris melingkar rapi di sisi luar kiri-bawah */}
        <path
          d="M10.8 23.0L7.4 22.2L6.8 24.3L8.5 24.7L8.9 23.6L10.7 24.0Z"
          fill={`url(#${gradId})`}
        />
        <path
          d="M11.3 26.2L7.7 26.6L7.6 28.9L9.3 28.8L9.5 27.6L11.7 27.5Z"
          fill={`url(#${gradId})`}
        />
        <path
          d="M13.1 29.3L10.1 31.1L10.9 33.2L12.4 32.4L12.0 31.4L14.0 30.4Z"
          fill={`url(#${gradId})`}
        />

        {/* Tubuh Utama melengkung halus di bagian bawah huruf o */}
        <path
          d="M10.3 21.6C9.7 26.8 12.8 32.8 17.6 33.3C20.9 33.6 23.5 32.1 25.1 29.9C23.2 30.1 20.9 29.8 18.7 28.8C15.9 27.5 14.3 25.1 14.1 22.3C14.0 20.8 14.6 19.6 15.4 18.8C13.0 18.8 10.6 19.8 10.3 21.6Z"
          fill={`url(#${gradId})`}
        />

        {/* Segmen Ekor 1 (kanan bawah) */}
        <path
          d="M24.3 30.1C27.0 28.8 28.7 26.4 29.1 23.6L25.7 23.1C25.3 25.1 24.2 26.7 22.6 27.7Z"
          fill={`url(#${gradId})`}
        />

        {/* Segmen Ekor 2 (kanan tengah) */}
        <path
          d="M29.3 22.2C29.7 19.2 28.8 16.3 27.1 13.9L24.2 15.6C25.4 17.4 25.9 19.5 25.8 21.7Z"
          fill={`url(#${gradId})`}
        />

        {/* Segmen Ekor 3 (kanan atas menuju mahkota) */}
        <path
          d="M26.2 12.7C24.5 10.5 22.1 9.1 19.4 8.7L19.0 11.9C20.9 12.2 22.5 13.2 23.6 14.7Z"
          fill={`url(#${gradId})`}
        />

        {/* Telson & Sengat Scorpio Runcing Melengkung di Puncak Huruf o */}
        <path
          d="M18.2 8.7C17.0 6.1 14.6 5.6 12.5 8.3C14.2 7.8 15.6 8.3 16.4 9.7C16.9 10.6 17.6 11.3 18.1 11.7C18.5 10.7 18.6 9.6 18.2 8.7Z"
          fill={`url(#${gradId})`}
        />
      </svg>
    </span>
  );
}

export function ScorpioLogo({
  size = 'md',
  showOwnerLine = true,
}: ScorpioLogoProps) {
  const uid = useId().replace(/:/g, '');
  const gradId = `scorpio-o-grad-${uid}`;

  return (
    <span className="inline-flex flex-col leading-none select-none">
      {showOwnerLine && (
        <span className="mb-1 flex items-center gap-1.5 font-sans text-[9.5px] font-bold tracking-[0.23em] text-slate-500 uppercase">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-500" />
          <span>Deyafa Arsetya</span>
        </span>
      )}
      <span
        className={`font-display inline-flex items-baseline tracking-[-0.025em] ${
          size === 'sm'
            ? 'text-[19.5px]'
            : size === 'lg'
              ? 'text-[28px]'
              : 'text-[23.5px]'
        }`}
      >
        <span className="font-extrabold text-slate-950">Sc</span>
        <ScorpioO gradId={gradId} />
        <span className="font-extrabold text-slate-950">rpio</span>
        <span className="bg-gradient-to-r from-rose-600 to-rose-500 bg-clip-text font-extrabold text-transparent">
          PDF
        </span>
      </span>
    </span>
  );
}
