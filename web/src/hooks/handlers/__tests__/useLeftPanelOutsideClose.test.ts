import { renderHook } from "@testing-library/react";
import {
  shouldCloseLeftPanelOnOutsideClick,
  useLeftPanelOutsideClose
} from "../useLeftPanelOutsideClose";
import { LEFT_PANEL_TOP_LEVEL } from "../../../config/quickAccessCategories";

const pressOn = (element: Element) => {
  element.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
};

const mount = (markup: string): HTMLElement => {
  const host = document.createElement("div");
  host.innerHTML = markup;
  document.body.appendChild(host);
  return host;
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("shouldCloseLeftPanelOnOutsideClick", () => {
  const open = {
    isVisible: true,
    isMobile: false,
    activeView: "workflows",
    activeTabType: "workflow"
  };

  it("is on for an open drawer over a workflow tab", () => {
    expect(shouldCloseLeftPanelOnOutsideClick(open)).toBe(true);
  });

  it("is off while the drawer is closed", () => {
    expect(
      shouldCloseLeftPanelOnOutsideClick({ ...open, isVisible: false })
    ).toBe(false);
  });

  it("is off on mobile, where the bottom sheet owns dismissal", () => {
    expect(shouldCloseLeftPanelOnOutsideClick({ ...open, isMobile: true })).toBe(
      false
    );
  });

  it("is off for the node library, which is dragged onto the canvas", () => {
    expect(
      shouldCloseLeftPanelOnOutsideClick({ ...open, activeView: "nodes" })
    ).toBe(false);
  });

  it("is off on a timeline tab, which reserves the drawer's width", () => {
    expect(
      shouldCloseLeftPanelOnOutsideClick({ ...open, activeTabType: "timeline" })
    ).toBe(false);
  });

  // Derived from the rail's own list, so a view added later is covered here
  // without anyone remembering to extend this test.
  it("stays on for every rail view except the node library", () => {
    const views = LEFT_PANEL_TOP_LEVEL.map((category) => category.id);
    expect(views).toContain("nodes");
    expect(views.length).toBeGreaterThan(1);

    for (const activeView of views) {
      expect(shouldCloseLeftPanelOnOutsideClick({ ...open, activeView })).toBe(
        activeView !== "nodes"
      );
    }
  });

  it("separates the timelines list view from an open timeline tab", () => {
    expect(
      shouldCloseLeftPanelOnOutsideClick({
        ...open,
        activeView: "timelines",
        activeTabType: "workflow"
      })
    ).toBe(true);
    expect(
      shouldCloseLeftPanelOnOutsideClick({
        ...open,
        activeView: "timelines",
        activeTabType: "timeline"
      })
    ).toBe(false);
  });
});

describe("useLeftPanelOutsideClose", () => {
  it("closes when the press lands outside the panel", () => {
    const close = jest.fn();
    const host = mount(`
      <div class="panel-left-container"><div class="drawer-content"></div></div>
      <div class="reactflow-pane"></div>
    `);
    renderHook(() => useLeftPanelOutsideClose(true, close));

    pressOn(host.querySelector(".reactflow-pane")!);

    expect(close).toHaveBeenCalledTimes(1);
  });

  it("keeps the panel open when the press lands inside it", () => {
    const close = jest.fn();
    const host = mount(`
      <div class="panel-left-container">
        <div class="vertical-toolbar"><button id="rail-button"></button></div>
        <div class="drawer-content"><button id="row"></button></div>
      </div>
    `);
    renderHook(() => useLeftPanelOutsideClose(true, close));

    pressOn(host.querySelector("#row")!);
    pressOn(host.querySelector("#rail-button")!);

    expect(close).not.toHaveBeenCalled();
  });

  it("keeps the panel open for portalled menus and dialogs", () => {
    const close = jest.fn();
    const host = mount(`
      <div class="panel-left-container"></div>
      <div class="MuiModal-root"><div id="dialog-button"></div></div>
      <div role="menu"><div id="menu-item"></div></div>
    `);
    renderHook(() => useLeftPanelOutsideClose(true, close));

    pressOn(host.querySelector("#dialog-button")!);
    pressOn(host.querySelector("#menu-item")!);

    expect(close).not.toHaveBeenCalled();
  });

  it("fires even when an inner handler stops propagation", () => {
    const close = jest.fn();
    const host = mount(`
      <div class="panel-left-container"></div>
      <div id="pane"><div id="child"></div></div>
    `);
    host
      .querySelector("#pane")!
      .addEventListener("pointerdown", (event) => event.stopPropagation());
    renderHook(() => useLeftPanelOutsideClose(true, close));

    pressOn(host.querySelector("#child")!);

    expect(close).toHaveBeenCalledTimes(1);
  });

  it("does nothing while disabled", () => {
    const close = jest.fn();
    const host = mount(`<div class="reactflow-pane"></div>`);
    renderHook(() => useLeftPanelOutsideClose(false, close));

    pressOn(host.querySelector(".reactflow-pane")!);

    expect(close).not.toHaveBeenCalled();
  });

  it("detaches the listener on unmount", () => {
    const close = jest.fn();
    const host = mount(`<div class="reactflow-pane"></div>`);
    const { unmount } = renderHook(() => useLeftPanelOutsideClose(true, close));

    unmount();
    pressOn(host.querySelector(".reactflow-pane")!);

    expect(close).not.toHaveBeenCalled();
  });
});
