import { useEffect } from "react";

/**
 * Chrome that renders into a portal — outside the panel's DOM subtree, but
 * logically part of it. A context menu opened from a list row, a confirm
 * dialog, a select popup: pressing one of those must not dismiss the panel
 * underneath it.
 */
const PORTAL_SELECTOR = [
  ".MuiModal-root",
  ".MuiPopover-root",
  ".MuiMenu-root",
  ".MuiTooltip-popper",
  ".MuiAutocomplete-popper",
  "[role='menu']",
  "[role='dialog']",
  "[role='listbox']"
].join(",");

export interface LeftPanelOutsideCloseContext {
  isVisible: boolean;
  /** Mobile renders a bottom sheet, which brings its own backdrop. */
  isMobile: boolean;
  activeView: string;
  activeTabType: string | null;
}

/**
 * Whether an outside press should dismiss the panel in the current context.
 *
 * Two surfaces opt out. The node library is dragged onto the canvas over and
 * over, so a stray canvas click must not put it away. A timeline tab reserves
 * the drawer's width (WorkspaceShell) rather than being covered by it, so
 * there is nothing hidden to reveal.
 */
export function shouldCloseLeftPanelOnOutsideClick({
  isVisible,
  isMobile,
  activeView,
  activeTabType
}: LeftPanelOutsideCloseContext): boolean {
  return (
    isVisible &&
    !isMobile &&
    activeView !== "nodes" &&
    activeTabType !== "timeline"
  );
}

/**
 * Dismiss the left panel when the pointer goes down anywhere outside it.
 *
 * The panel is `position: fixed` and floats over the content (see
 * WorkspaceShell), so it hides whatever it covers until something closes it.
 * Callers decide when that applies — the node library stays pinned because its
 * whole job is dragging nodes onto the canvas, and the timeline reserves the
 * drawer's width instead of being covered by it.
 *
 * A drag that starts inside the panel and ends on the canvas keeps the panel
 * open: only the press location is tested, and that one is inside.
 */
export function useLeftPanelOutsideClose(enabled: boolean, close: () => void) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (target.closest(".panel-left-container")) {
        return;
      }
      if (target.closest(PORTAL_SELECTOR)) {
        return;
      }
      close();
    };

    // Capture phase: the ReactFlow pane and several widgets stop propagation
    // on pointer events, which would keep a bubbling listener from ever firing.
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [enabled, close]);
}

export default useLeftPanelOutsideClose;
