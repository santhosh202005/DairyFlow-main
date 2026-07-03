import { type InputHTMLAttributes } from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  autoFocus?: boolean;
  inputProps?: Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'value' | 'onChange' | 'type' | 'placeholder' | 'id' | 'autoFocus'
  >;
}

export default function SearchBar({
  value,
  onChange,
  placeholder = 'Search...',
  className = '',
  id,
  autoFocus = false,
  inputProps,
}: SearchBarProps) {
  return (
    <div className={`search-bar ${className}`.trim()}>
      <Search className="search-icon text-slate-400 shrink-0" />
      <input
        id={id}
        type="text"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="search-input"
        {...inputProps}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="search-clear-button"
          aria-label="Clear search"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
