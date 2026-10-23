/**
 * Cross-browser full screen helper utility.
 * Guarantees cross-browser vendor prefix execution within user gestures.
 */

export function enterFullScreen(): Promise<void> {
  const docEl = document.documentElement as any;
  if (!docEl) return Promise.resolve();

  try {
    if (docEl.requestFullscreen) {
      return docEl.requestFullscreen().catch(() => {});
    } else if (docEl.webkitRequestFullscreen) {
      return docEl.webkitRequestFullscreen().catch(() => {});
    } else if (docEl.mozRequestFullScreen) {
      return docEl.mozRequestFullScreen().catch(() => {});
    } else if (docEl.msRequestFullscreen) {
      return docEl.msRequestFullscreen().catch(() => {});
    }
  } catch {
    // Graceful fallback
  }
  return Promise.resolve();
}

export function exitFullScreen(): Promise<void> {
  const doc = document as any;
  if (!doc) return Promise.resolve();

  try {
    if (doc.exitFullscreen) {
      return doc.exitFullscreen().catch(() => {});
    } else if (doc.webkitExitFullscreen) {
      return doc.webkitExitFullscreen().catch(() => {});
    } else if (doc.mozCancelFullScreen) {
      return doc.mozCancelFullScreen().catch(() => {});
    } else if (doc.msExitFullscreen) {
      return doc.msExitFullscreen().catch(() => {});
    }
  } catch {
    // Graceful fallback
  }
  return Promise.resolve();
}

export function isFullScreen(): boolean {
  const doc = document as any;
  if (!doc) return false;
  return !!(
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement
  );
}
