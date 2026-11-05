import { render } from '@testing-library/react';
import { MapScene } from './MapScene';
import { artNames } from './art';

afterEach(() => vi.restoreAllMocks());

describe('MapScene', () => {
  it('renders nothing and does not warn when there is no scene name (optional centerArt)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = render(<MapScene name={undefined} size="center" />);
    expect(container).toBeEmptyDOMElement();
    expect(warn).not.toHaveBeenCalled();
  });

  it('renders nothing and warns once with the name for an unknown scene', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container, rerender } = render(<MapScene name="cena-que-nao-existe" size="card" />);
    expect(container.querySelector('img')).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('cena-que-nao-existe'));
    rerender(<MapScene name="cena-que-nao-existe" size="card" />);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('renders a decorative lazy image for a real scene, with distinct sizes', () => {
    const name = artNames()[0] as string;
    const { container, rerender } = render(<MapScene name={name} size="card" />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('alt', '');
    expect(img).toHaveAttribute('aria-hidden', 'true');
    expect(img).toHaveAttribute('width', '96');
    rerender(<MapScene name={name} size="center" />);
    expect(container.querySelector('img')).toHaveAttribute('width', '112');
  });

  it('treats an empty string name as missing (no empty src)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = render(<MapScene name="" size="card" />);
    expect(container.querySelector('img')).toBeNull();
  });
});
