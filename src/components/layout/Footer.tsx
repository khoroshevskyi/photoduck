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
      <p className="site-footer__links">
        <a
          className="site-footer__link"
          href="https://molfar.dev"
          target="_blank"
          rel="noopener noreferrer"
        >
          Project by molfar.dev
        </a>
        <a
          className="site-footer__link"
          href="https://github.com/khoroshevskyi/photoduck"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon name="github" size={14} />
          GitHub
        </a>
      </p>
    </footer>
  );
}
