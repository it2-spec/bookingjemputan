import React, { useRef, useEffect, useState } from 'react';

interface LicensePlateInputProps {
  value: string;
  onChange: (val: string) => void;
  required?: boolean;
  disabled?: boolean;
}

export function parseLicensePlate(val: string): { prefix: string; number: string; suffix: string } {
  if (!val) return { prefix: '', number: '', suffix: '' };
  const parts = val.trim().split(/\s+/);
  if (parts.length >= 2) {
    return {
      prefix: (parts[0] || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2),
      number: (parts[1] || '').replace(/[^0-9]/g, '').slice(0, 4),
      suffix: (parts[2] || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3),
    };
  }
  const cleaned = val.toUpperCase().replace(/[^A-Z0-9]/g, '');
  let p1 = '', p2 = '', p3 = '';
  let i = 0;
  while (i < cleaned.length && /[A-Z]/.test(cleaned[i]) && p1.length < 2) p1 += cleaned[i++];
  while (i < cleaned.length && /[0-9]/.test(cleaned[i]) && p2.length < 4) p2 += cleaned[i++];
  while (i < cleaned.length && /[A-Z]/.test(cleaned[i]) && p3.length < 3) p3 += cleaned[i++];
  return { prefix: p1, number: p2, suffix: p3 };
}

export function LicensePlateInput({
  value,
  onChange,
  required = false,
  disabled = false,
}: LicensePlateInputProps) {
  const [prefix, setPrefix] = useState('');
  const [number, setNumber] = useState('');
  const [suffix, setSuffix] = useState('');

  const prefixRef = useRef<HTMLInputElement>(null);
  const numberRef = useRef<HTMLInputElement>(null);
  const suffixRef = useRef<HTMLInputElement>(null);

  // Sync state when external value changes
  useEffect(() => {
    const parsed = parseLicensePlate(value || '');
    setPrefix(parsed.prefix);
    setNumber(parsed.number);
    setSuffix(parsed.suffix);
  }, [value]);

  const updateCombined = (newP: string, newN: string, newS: string) => {
    setPrefix(newP);
    setNumber(newN);
    setSuffix(newS);
    const combined = [newP, newN, newS].filter(Boolean).join(' ');
    onChange(combined);
  };

  const handlePrefixChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
    if (val.length > 2) val = val.slice(0, 2);

    updateCombined(val, number, suffix);

    // Auto-advance to number if 2 letters entered
    if (val.length === 2) {
      numberRef.current?.focus();
    }
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/[^0-9]/g, '');
    if (val.length > 4) val = val.slice(0, 4);

    updateCombined(prefix, val, suffix);

    // Auto-advance to suffix if 4 digits entered
    if (val.length === 4) {
      suffixRef.current?.focus();
    }
  };

  const handleSuffixChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
    if (val.length > 3) val = val.slice(0, 3);

    updateCombined(prefix, number, val);
  };

  const handlePrefixKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
      e.preventDefault();
      numberRef.current?.focus();
    }
  };

  const handleNumberKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
      e.preventDefault();
      suffixRef.current?.focus();
    } else if (e.key === 'Backspace' && number === '') {
      e.preventDefault();
      prefixRef.current?.focus();
    } else if (e.key === 'ArrowLeft') {
      prefixRef.current?.focus();
    }
  };

  const handleSuffixKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && suffix === '') {
      e.preventDefault();
      numberRef.current?.focus();
    } else if (e.key === 'ArrowLeft') {
      numberRef.current?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    const parsed = parseLicensePlate(pasted);
    updateCombined(parsed.prefix, parsed.number, parsed.suffix);
  };

  const fullPlate = [prefix, number, suffix].filter(Boolean).join(' ');

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {/* Prefix: 1-2 letters */}
        <div className="w-20">
          <input
            ref={prefixRef}
            type="text"
            required={required}
            disabled={disabled}
            value={prefix}
            onChange={handlePrefixChange}
            onKeyDown={handlePrefixKeyDown}
            onPaste={handlePaste}
            placeholder="__"
            maxLength={2}
            className="w-full text-center px-2 py-2 text-base font-extrabold uppercase font-mono bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 tracking-wider placeholder:text-slate-300"
          />
          <span className="block text-[10px] text-center text-slate-400 mt-0.5">
            1-2 Huruf
          </span>
        </div>

        <span className="text-slate-300 font-bold text-lg mb-4">-</span>

        {/* Number: 1-4 digits */}
        <div className="w-28">
          <input
            ref={numberRef}
            type="text"
            inputMode="numeric"
            required={required}
            disabled={disabled}
            value={number}
            onChange={handleNumberChange}
            onKeyDown={handleNumberKeyDown}
            onPaste={handlePaste}
            placeholder="____"
            maxLength={4}
            className="w-full text-center px-2 py-2 text-base font-extrabold font-mono bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 tracking-wider placeholder:text-slate-300"
          />
          <span className="block text-[10px] text-center text-slate-400 mt-0.5">
            1-4 Angka
          </span>
        </div>

        <span className="text-slate-300 font-bold text-lg mb-4">-</span>

        {/* Suffix: 1-3 letters */}
        <div className="w-24">
          <input
            ref={suffixRef}
            type="text"
            required={required}
            disabled={disabled}
            value={suffix}
            onChange={handleSuffixChange}
            onKeyDown={handleSuffixKeyDown}
            onPaste={handlePaste}
            placeholder="___"
            maxLength={3}
            className="w-full text-center px-2 py-2 text-base font-extrabold uppercase font-mono bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 tracking-wider placeholder:text-slate-300"
          />
          <span className="block text-[10px] text-center text-slate-400 mt-0.5">
            1-3 Huruf
          </span>
        </div>

        {/* Plate Preview Badge */}
        {fullPlate && (
          <div className="hidden sm:flex items-center ml-2 mb-4">
            <div className="px-2.5 py-1 bg-slate-900 border-2 border-slate-700 text-white font-mono font-bold text-xs rounded-md shadow-xs tracking-wider">
              {fullPlate}
            </div>
          </div>
        )}
      </div>

      <div className="text-[11px] text-slate-500 flex items-center justify-between">
        <span>Format: <b>KODE WILAYAH</b> (AB/B/T) • <b>NOMOR</b> (1-4 digit) • <b>SERI</b> (BCA/A/AB)</span>
        {fullPlate && (
          <span className="sm:hidden font-mono font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">
            {fullPlate}
          </span>
        )}
      </div>
    </div>
  );
}
