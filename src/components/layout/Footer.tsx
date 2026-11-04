import { Icon } from '../common/Icon';

export function Footer() {
  return (
    <footer className="site-footer">
      <p className="flex items-center justify-center gap-2 mb-2">
        <Icon name="shield" size={15} />
        Your photo never leaves this device — all processing happens locally in your browser.
      </p>
      <p className="text-xs">
        photoDuck · Passport, ID &amp; visa photos · Not affiliated with any government authority.
      </p>
    </footer>
  );
}
