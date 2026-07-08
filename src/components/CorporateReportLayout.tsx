import React from 'react';
import antetliPng from '../assets/kibritci-antetli.png';
import { CORPORATE_COMPANY } from '../lib/corporateReportHtml';

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
      {/* Hologram filigran — antetli şablondaki soluk K logosu */}
      <div className="corporate-report-watermark" aria-hidden="true">
        <div className="corporate-report-watermark-clip">
          <img src={antetliPng} alt="" draggable={false} />
        </div>
      </div>

      <header className="corporate-report-header">
        <div className="corporate-report-logo-clip">
          <img src={antetliPng} alt="Kibritçi İnşaat" draggable={false} />
        </div>
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
            <p className="corporate-report-footer-legal">{CORPORATE_COMPANY.legalName}</p>
            <p className="corporate-report-footer-address">{CORPORATE_COMPANY.address}</p>
          </div>
          <div className="corporate-report-footer-col corporate-report-footer-contact">
            <p>{CORPORATE_COMPANY.phone}</p>
            <p>@: {CORPORATE_COMPANY.email}</p>
          </div>
          <div className="corporate-report-footer-col corporate-report-footer-web">
            <p>{CORPORATE_COMPANY.website}</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default CorporateReportLayout;
