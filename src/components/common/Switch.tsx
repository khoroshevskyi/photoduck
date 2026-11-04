interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

export function Switch({ checked, onChange, label }: SwitchProps) {
  return (
    <button
      type="button"
      className={`switch ${checked ? 'switch--on' : ''}`}
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
    >
      <span className="switch__track">
        <span className="switch__thumb" />
      </span>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
