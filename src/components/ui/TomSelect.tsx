// ============================================================
// TomSelect Component (React Wrapper)
// Searchable & clean select dropdown powered by TomSelect
// Includes inline creation support for new items (e.g. drivers)
// ============================================================

import { useEffect, useRef } from 'react';
import TomSelectCore from 'tom-select';
import 'tom-select/dist/css/tom-select.default.css';

export interface TomSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  disabled?: boolean;
}

interface TomSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: TomSelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  allowEmpty?: boolean;
  onCreate?: (query: string) => void;
  createLabel?: string;
}

export function TomSelect({
  value,
  onChange,
  options,
  placeholder = '',
  className = '',
  disabled = false,
  allowEmpty = true,
  onCreate,
  createLabel = 'Daftarkan Supir Baru',
}: TomSelectProps) {
  const selectRef = useRef<HTMLSelectElement | null>(null);
  const tomSelectRef = useRef<TomSelectCore | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const onCreateRef = useRef(onCreate);
  onCreateRef.current = onCreate;

  const canCreate = Boolean(onCreate);

  // Initialize TomSelect once on mount
  useEffect(() => {
    if (!selectRef.current) return;

    // Destroy existing instance if any
    if (tomSelectRef.current) {
      tomSelectRef.current.destroy();
      tomSelectRef.current = null;
    }

    const formattedOptions = options.map((opt) => ({
      value: opt.value,
      text: opt.label,
      label: opt.label,
      sublabel: opt.sublabel,
      disabled: opt.disabled,
    }));

    const ts = new TomSelectCore(selectRef.current, {
      plugins: ['clear_button'],
      create: canCreate
        ? function (input: string) {
            const query = input.trim();
            if (query && onCreateRef.current) {
              onCreateRef.current(query);
            }
            return false;
          }
        : false,
      createOnBlur: false,
      allowEmptyOption: allowEmpty,
      placeholder: placeholder,
      hidePlaceholder: true,
      maxItems: 1,
      options: formattedOptions,
      items: value ? [value] : [],
      controlInput: '<input>',

      render: {
        option: function (data: any, escape: (str: string) => string) {
          if (!data.value && !data.text && !data.label) {
            return '<div style="display:none"></div>';
          }
          const sub = data.sublabel
            ? `<span class="text-[11px] text-slate-400 block">${escape(data.sublabel)}</span>`
            : '';
          const isDisabled = data.disabled;
          return `<div class="py-1.5 px-2 text-xs font-semibold ${
            isDisabled
              ? 'opacity-40 bg-slate-100 text-slate-400 cursor-not-allowed pointer-events-none select-none'
              : 'text-slate-800 hover:bg-blue-50'
          }">
            <div>${escape(data.text || data.label || '')}</div>
            ${sub}
          </div>`;
        },

        item: function (data: any, escape: (str: string) => string) {
          return `<div class="text-xs font-bold text-slate-900 truncate">${escape(
            data.text || data.label || ''
          )}</div>`;
        },

        option_create: function (data: any, escape: (str: string) => string) {
          return `<div class="create py-2 px-3 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border-t border-blue-100 flex items-center gap-1.5 cursor-pointer transition-colors">
            <span class="text-sm">➕</span>
            <span>${escape(createLabel)}: "<strong>${escape(data.input)}</strong>"</span>
          </div>`;
        },

        no_results: function (data: any, escape: (str: string) => string) {
          if (canCreate && data.input) {
            return `<div class="no-results p-3 text-xs text-slate-600 space-y-2">
              <p>Tidak ditemukan untuk "<strong>${escape(data.input)}</strong>"</p>
              <button type="button" class="btn-create-item w-full py-1.5 px-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-lg font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer">
                <span>➕</span>
                <span>${escape(createLabel)} "${escape(data.input)}"</span>
              </button>
            </div>`;
          }
          return `<div class="no-results py-2 px-3 text-xs text-slate-400 italic">Tidak ada opsi ditemukan</div>`;
        },
      },
      onChange: (val: string) => {
        onChangeRef.current(val);
      },
    });

    // Delegate click handler for the no_results create button
    ts.dropdown.addEventListener('click', (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const btn = target?.closest('.btn-create-item');
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        const query = ts.control_input.value || '';
        ts.close();
        if (query.trim() && onCreateRef.current) {
          onCreateRef.current(query.trim());
        }
      }
    });

    tomSelectRef.current = ts;

    if (value) {
      ts.setValue(value, true);
    }

    return () => {
      if (tomSelectRef.current) {
        tomSelectRef.current.destroy();
        tomSelectRef.current = null;
      }
    };
  }, []); // Run once on mount

  // Dynamically sync options whenever `options` prop changes
  useEffect(() => {
    if (!tomSelectRef.current) return;
    const ts = tomSelectRef.current;

    // Preserve current value
    const currentVal = value || ts.getValue();

    ts.clearOptions();
    options.forEach((opt) => {
      ts.addOption({
        value: opt.value,
        text: opt.label,
        label: opt.label,
        sublabel: opt.sublabel,
        disabled: opt.disabled,
      });
    });

    ts.refreshOptions(false);

    if (currentVal) {
      ts.setValue(currentVal, true);
    }
  }, [options]);

  // Sync external value changes
  useEffect(() => {
    if (tomSelectRef.current && tomSelectRef.current.getValue() !== value) {
      tomSelectRef.current.setValue(value || '', true);
    }
  }, [value]);

  // Sync disabled state
  useEffect(() => {
    if (tomSelectRef.current) {
      if (disabled) {
        tomSelectRef.current.disable();
      } else {
        tomSelectRef.current.enable();
      }
    }
  }, [disabled]);

  return (
    <div className={`ts-wrapper-custom ${className}`}>
      <select
        ref={selectRef}
        defaultValue={value}
        className="w-full text-xs"
      >
        <option value="" data-placeholder="true"></option>
      </select>
    </div>
  );
}
