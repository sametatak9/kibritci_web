import React from 'react';
import { KIBRITCI_LOGO_PATH } from '../lib/kibritciBrand';

interface KibritciLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Eski uyumluluk — yeni logo zaten metin içerir, varsayılan false */
  showText?: boolean;
}

export const KibritciLogo: React.FC<KibritciLogoProps> = ({
  className = '',
  size = 'md',
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
        className="h-full w-auto object-contain"
        style={{ background: 'transparent' }}
        draggable={false}
      />
    </div>
  );
};

export default KibritciLogo;
