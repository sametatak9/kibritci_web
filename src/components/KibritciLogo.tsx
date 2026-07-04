import React from 'react';
import { KIBRITCI_LOGO_PATH } from '../lib/kibritciBrand';

interface KibritciLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

export const KibritciLogo: React.FC<KibritciLogoProps> = ({
  className = '',
  size = 'md',
  showText = false,
}) => {
  const sizes = {
    sm: 'h-6',
    md: 'h-10',
    lg: 'h-14',
    xl: 'h-20',
  };

  const heightClass = className.includes('h-') ? '' : sizes[size];

  return (
    <div className={`flex items-center select-none shrink-0 ${heightClass} ${className}`}>
      <img
        src={KIBRITCI_LOGO_PATH}
        alt="Kibritçi İnşaat"
        className="h-full w-auto object-contain bg-transparent"
        style={{ background: 'transparent' }}
      />
      {showText && (
        <div className="flex flex-col leading-none ml-2">
          <span className="text-[#1E4E78] font-black tracking-wider text-xs sm:text-sm">KİBRİTÇİ</span>
          <span className="text-[#8B1E1E] font-black tracking-widest text-[8px] sm:text-[9px] mt-0.5">İNŞAAT</span>
        </div>
      )}
    </div>
  );
};

export default KibritciLogo;
