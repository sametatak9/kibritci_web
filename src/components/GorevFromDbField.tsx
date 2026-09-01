import React from 'react';
import { SmartCatalogField } from './SmartCatalogField';

interface GorevFromDbFieldProps {
  value: string;
  onChange: (value: string) => void;
  extraOptions?: string[];
  label?: string;
  inputClassName?: string;
  disabled?: boolean;
}

/** Personel Yönetimi ile aynı kaynak: programKataloglari/gorevler + kadrodaki görevler. */
export const GorevFromDbField: React.FC<GorevFromDbFieldProps> = ({
  value,
  onChange,
  extraOptions = [],
  label = 'Görevi (yoklama) *',
  inputClassName,
  disabled = false,
}) => (
  <SmartCatalogField
    kind="gorev"
    label={label}
    value={value}
    onChange={onChange}
    extraOptions={extraOptions}
    autoRegisterNew
    disabled={disabled}
    placeholder="Katalogdan seçin — Personel Yönetimi görev listesi"
    hint="Görev DB’den gelir (program katalogu + kadrodaki mevcut görevler). Listeden seçin."
    inputClassName={inputClassName}
  />
);
