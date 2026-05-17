import { useState, KeyboardEvent } from 'react';

interface Props {
  onSubmit: (text: string) => void;
  disabled: boolean;
}

export function TextInput({ onSubmit, disabled }: Props) {
  const [value, setValue] = useState('');

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && value.trim() && !disabled) {
      onSubmit(value.trim());
      setValue('');
    }
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2" style={{ borderTop: '1px solid rgba(0,212,255,0.08)' }}>
      <span className="text-xs text-jarvis-dim flex-shrink-0">›</span>
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKey}
        disabled={disabled}
        placeholder={disabled ? 'Processing...' : 'Type a command or question...'}
        className="flex-1 bg-transparent outline-none text-xs placeholder-jarvis-dim"
        style={{ color: '#7ecfff', caretColor: '#00d4ff' }}
      />
      {value.trim() && (
        <button
          onClick={() => { onSubmit(value.trim()); setValue(''); }}
          disabled={disabled}
          className="text-xs px-2 py-1 rounded"
          style={{ color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)', background: 'rgba(0,212,255,0.05)' }}
        >
          SEND
        </button>
      )}
    </div>
  );
}
