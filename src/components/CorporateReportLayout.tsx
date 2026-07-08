import React from 'react';
import letterheadImg from '../assets/kibritci-antetli.png';

const COMPANY = {
  legalName: 'KİBRİTÇİ İNŞAAT TAAHHÜT TURİZM SANAYİ VE TİCARET LİMİTED ŞİRKETİ',
  address: 'Rüzgarlıbahçe Mah. Cumhuriyet Cad. Gülsan Plaza No: 22 /1 Kat: 3 Kavacık - Beykoz / İstanbul',
  phone: 'T: +90 212 213 77 61 - 66 - 68',
  email: 'info@kibritciinsaat.com.tr',
  website: 'kibritciinsaat.com.tr',
};

export interface CorporateReportLayoutProps {
  children: React.ReactNode;
  docCode?: string;
  printDate?: string;
  orientation?: 'portrait' | 'landscape';
  className?: string;
}

export const CorporateReportLayout: React.FC<CorporateReportLayoutProps> = ({
  children,
  docCode,
  printDate,
  orientation = 'landscape',
  className = '',
}) => {
  const printDateStr =
    printDate ??
    `${new Date().toLocaleDateString('tr-TR')} ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;

  return (
    <div
      className={`corporate-report corporate-report--${orientation} ${className}`}
      data-orientation={orientation}
    >
      <div className="corporate-report-watermark" aria-hidden="true">
        <img src={letterheadImg} alt="" draggable={false} />
      </div>

      <header className="corporate-report-header">
        <div
          className="corporate-report-logo"
          style={{ backgroundImage: `url(${letterheadImg})` }}
          role="img"
          aria-label="Kibritçi İnşaat"
        />
        {docCode && (
          <div className="corporate-report-meta">
            <span className="corporate-report-doc-code">{docCode}</span>
            <span className="corporate-report-date">Baskı: {printDateStr}</span>
          </div>
        )}
      </header>

      <main className="corporate-report-body">{children}</main>

      <footer className="corporate-report-footer">
        <div className="corporate-report-footer-line" />
        <div className="corporate-report-footer-grid">
          <div className="corporate-report-footer-col">
            <p className="corporate-report-footer-legal">{COMPANY.legalName}</p>
            <p className="corporate-report-footer-address">{COMPANY.address}</p>
          </div>
          <div className="corporate-report-footer-col corporate-report-footer-contact">
            <p>{COMPANY.phone}</p>
            <p>@: {COMPANY.email}</p>
          </div>
          <div className="corporate-report-footer-col corporate-report-footer-web">
            <p>{COMPANY.website}</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default CorporateReportLayout;
