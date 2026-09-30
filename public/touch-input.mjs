// Activate a deliberate touch release immediately. Some Chromium touch paths
// suppress the compatibility click following a captured SVG drawing gesture.
// Keep native click activation for keyboard and mouse, and discard only the
// duplicate trusted touch click following our immediate activation.
let pressed = null;
let activation = null;
document.addEventListener('pointerdown', event => {
  if (event.pointerType !== 'touch' || !event.isPrimary) return;
  const button = event.target.closest?.('button,[role="button"]');
  pressed = button && !button.disabled
    ? { button, id: event.pointerId, x: event.clientX, y: event.clientY }
    : null;
}, true);
document.addEventListener('pointercancel', () => { pressed = null; }, true);
document.addEventListener('pointerup', event => {
  if (event.pointerType !== 'touch' || !pressed || event.pointerId !== pressed.id) return;
  const { button, x, y } = pressed;
  pressed = null;
  if (!button.isConnected || button.disabled || Math.hypot(event.clientX - x, event.clientY - y) > 12) return;
  const box = button.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) return;
  activation = { x: event.clientX, y: event.clientY, at: performance.now() };
  button.focus({ preventScroll: true });
  if (typeof button.click === 'function') button.click();
  else button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}, true);
document.addEventListener('click', event => {
  const fromTouch = event.pointerType === 'touch' || event.sourceCapabilities?.firesTouchEvents;
  if (event.isTrusted && fromTouch && activation && performance.now() - activation.at < 700 && Math.hypot(event.clientX - activation.x, event.clientY - activation.y) < 8) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}, true);
