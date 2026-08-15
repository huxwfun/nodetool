import { act, renderHook, waitFor } from "@testing-library/react";

const useQueryMock = jest.fn();

jest.mock("../../../trpc/client", () => ({
  trpc: {
    assets: {
      localPath: {
        useQuery: (...args: unknown[]) => useQueryMock(...args)
      }
    }
  }
}));

import { useAssetLocationCopy } from "../useAssetLocationCopy";

const writeText = jest.fn().mockResolvedValue(undefined);

beforeAll(() => {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true
  });
});

beforeEach(() => {
  jest.useFakeTimers();
  writeText.mockClear();
  useQueryMock.mockReset();
  useQueryMock.mockReturnValue({ data: undefined });
});

afterEach(() => {
  jest.useRealTimers();
});

const asset = (over: Record<string, unknown> = {}) =>
  ({
    id: "asset-1",
    content_type: "image/png",
    get_url: "/api/storage/user-1/asset-1.png",
    ...over
  }) as never;

describe("useAssetLocationCopy", () => {
  it("copies the server file path when there is one", async () => {
    useQueryMock.mockReturnValue({
      data: { path: "/Users/me/.local/share/nodetool/assets/user-1/asset-1.png" }
    });
    const { result } = renderHook(() =>
      useAssetLocationCopy({ asset: asset() })
    );

    expect(result.current.kind).toBe("path");
    await act(async () => {
      await result.current.copyLocation();
    });

    expect(writeText).toHaveBeenCalledWith(
      "/Users/me/.local/share/nodetool/assets/user-1/asset-1.png"
    );
  });

  it("falls back to an absolute URL when the path is null", async () => {
    useQueryMock.mockReturnValue({ data: { path: null } });
    const { result } = renderHook(() =>
      useAssetLocationCopy({ asset: asset() })
    );

    expect(result.current.kind).toBe("url");
    await act(async () => {
      await result.current.copyLocation();
    });

    // Relative on the wire, absolute on the clipboard — a bare path is not
    // something the recipient can open.
    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/api/storage/user-1/asset-1.png`
    );
  });

  it("leaves an already-absolute URL alone", async () => {
    useQueryMock.mockReturnValue({ data: { path: null } });
    const { result } = renderHook(() =>
      useAssetLocationCopy({
        asset: asset({ get_url: "https://cdn.example.com/a.png" })
      })
    );

    await act(async () => {
      await result.current.copyLocation();
    });

    expect(writeText).toHaveBeenCalledWith("https://cdn.example.com/a.png");
  });

  it("reports no location when there is neither a path nor a URL", () => {
    useQueryMock.mockReturnValue({ data: { path: null } });
    const { result } = renderHook(() =>
      useAssetLocationCopy({ asset: asset({ get_url: null }) })
    );

    expect(result.current.kind).toBeNull();
    expect(result.current.location).toBeNull();
  });

  it("does not query for a folder", () => {
    renderHook(() =>
      useAssetLocationCopy({ asset: asset({ content_type: "folder" }) })
    );

    expect(useQueryMock).toHaveBeenCalledWith(
      { id: "asset-1" },
      expect.objectContaining({ enabled: false })
    );
  });

  it("does not query while the viewer is closed", () => {
    renderHook(() => useAssetLocationCopy({ asset: asset(), enabled: false }));

    expect(useQueryMock).toHaveBeenCalledWith(
      { id: "asset-1" },
      expect.objectContaining({ enabled: false })
    );
  });

  it("shows copied feedback and clears it", async () => {
    useQueryMock.mockReturnValue({ data: { path: "/tmp/a.png" } });
    const { result } = renderHook(() =>
      useAssetLocationCopy({ asset: asset() })
    );

    await act(async () => {
      await result.current.copyLocation();
    });
    expect(result.current.copied).toBe(true);

    act(() => {
      jest.advanceTimersByTime(2000);
    });
    await waitFor(() => expect(result.current.copied).toBe(false));
  });

  it("survives a clipboard rejection without flagging success", async () => {
    useQueryMock.mockReturnValue({ data: { path: "/tmp/a.png" } });
    writeText.mockRejectedValueOnce(new Error("denied"));
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const { result } = renderHook(() =>
      useAssetLocationCopy({ asset: asset() })
    );
    await act(async () => {
      await result.current.copyLocation();
    });

    expect(result.current.copied).toBe(false);
    consoleError.mockRestore();
  });
});
