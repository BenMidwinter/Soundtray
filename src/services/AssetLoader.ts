import { ASSET_MANIFEST, ASSET_MAP } from '../assets/assetManifest';

export interface AssetLoadStatus {
  loaded: number;
  failed: number;
  total: number;
  backgroundReady: boolean;
}

type StatusListener = (status: AssetLoadStatus) => void;

/**
 * Non-blocking image loader for local cleaned PNG assets and their custom
 * silhouette-matched contact shadows.
 */
class AssetLoaderService {
  private cache = new Map<string, HTMLImageElement>();
  private shadowCache = new Map<string, HTMLImageElement>();
  private inFlight = new Map<string, Promise<HTMLImageElement | null>>();
  private shadowInFlight = new Map<string, Promise<HTMLImageElement | null>>();
  private failed = new Set<string>();
  private listeners = new Set<StatusListener>();

  public get(assetId: string): HTMLImageElement | null {
    const img = this.cache.get(assetId);
    if (img && img.complete && img.naturalWidth > 0) {
      return img;
    }
    return null;
  }

  public getShadow(assetId: string): HTMLImageElement | null {
    const img = this.shadowCache.get(assetId);
    if (img && img.complete && img.naturalWidth > 0) {
      return img;
    }
    return null;
  }

  public isFailed(assetId: string): boolean {
    return this.failed.has(assetId);
  }

  public getStatus(): AssetLoadStatus {
    return {
      loaded: this.cache.size,
      failed: this.failed.size,
      total: ASSET_MANIFEST.length,
      backgroundReady: this.get('background') !== null,
    };
  }

  public subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    const status = this.getStatus();
    this.listeners.forEach((cb) => cb(status));
  }

  private loadShadow(assetId: string, url: string): Promise<HTMLImageElement | null> {
    const cached = this.getShadow(assetId);
    if (cached) return Promise.resolve(cached);

    const existing = this.shadowInFlight.get(assetId);
    if (existing) return existing;

    const promise = new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        this.shadowCache.set(assetId, img);
        this.shadowInFlight.delete(assetId);
        resolve(img);
      };
      img.onerror = () => {
        this.shadowInFlight.delete(assetId);
        resolve(null);
      };
      img.src = url;
    });

    this.shadowInFlight.set(assetId, promise);
    return promise;
  }

  public loadOne(assetId: string): Promise<HTMLImageElement | null> {
    const def = ASSET_MAP[assetId];
    if (!def) return Promise.resolve(null);

    if (def.shadowUrl) {
      void this.loadShadow(assetId, def.shadowUrl);
    }

    const cached = this.get(assetId);
    if (cached) return Promise.resolve(cached);

    const existing = this.inFlight.get(assetId);
    if (existing) return existing;

    const promise = new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.decoding = 'async';

      img.onload = () => {
        this.cache.set(assetId, img);
        this.failed.delete(assetId);
        this.inFlight.delete(assetId);
        this.emit();
        resolve(img);
      };

      img.onerror = () => {
        console.warn(`[AssetLoader] Failed to load "${assetId}" from ${def.url}`);
        this.failed.add(assetId);
        this.inFlight.delete(assetId);
        this.emit();
        resolve(null);
      };

      img.src = def.url;
    });

    this.inFlight.set(assetId, promise);
    return promise;
  }

  public async preloadPriority(priorityIds: string[]): Promise<void> {
    await Promise.all([this.loadOne('background'), this.loadOne('background_window_mask')]);

    const uniquePriority = Array.from(
      new Set(priorityIds.filter((id) => id !== 'background' && id !== 'background_window_mask'))
    );
    await Promise.all(uniquePriority.map((id) => this.loadOne(id)));

    const remaining = ASSET_MANIFEST.map((a) => a.id).filter(
      (id) =>
        id !== 'background' &&
        id !== 'background_window_mask' &&
        !uniquePriority.includes(id)
    );
    void this.loadInBatches(remaining, 6);
  }

  private async loadInBatches(ids: string[], batchSize: number): Promise<void> {
    for (let i = 0; i < ids.length; i += batchSize) {
      const slice = ids.slice(i, i + batchSize);
      await Promise.all(slice.map((id) => this.loadOne(id)));
    }
  }
}

export const assetLoader = new AssetLoaderService();
