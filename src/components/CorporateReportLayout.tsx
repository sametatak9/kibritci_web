import React from 'react';
import { CORPORATE_COMPANY } from '../lib/corporateReportHtml';
import {
  KIBRITCI_REPORT_HEADER_DATA_URL,
  KIBRITCI_REPORT_WATERMARK_DATA_URL,
} from '../lib/reportBrandAssets';

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
      <img
        src={KIBRITCI_REPORT_WATERMARK_DATA_URL}
        alt=""
        aria-hidden
        draggable={false}
        className="corporate-report-watermark-img"
      />

      <header className="corporate-report-header">
        <img
          src={KIBRITCI_REPORT_HEADER_DATA_URL}
          alt="Kibritçi İnşaat"
          draggable={false}
          className="corporate-report-logo-img"
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
