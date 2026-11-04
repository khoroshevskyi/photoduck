import { useEditor } from '../../store/editorStore';
import { Icon } from '../common/Icon';

export function Header() {
  const reset = useEditor((s) => s.reset);

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <button
          type="button"
          className="brand"
          onClick={reset}
          aria-label="photoDuck — start a new photo"
        >
          <span className="brand__mark">
            <Icon name="duck" size={22} />
          </span>
          <span className="brand__name">
            photo<span>Duck</span>
          </span>
        </button>
      </div>
    </header>
  );
}
