// Created by spec 19
// === Spec 19: synchronized LRU ===
export class SynchronizedLRU {
  constructor(maxKeys = 1000) {
    this.maxKeys = Math.max(1, maxKeys);
    this.map = new Map();
  }
  _commit() { while (this.map.size > this.maxKeys) this.map.delete(this.map.keys().next().value); }
  get(k) {
    if (!this.map.has(k)) return undefined;
    const v = this.map.get(k); this.map.delete(k); this.map.set(k, v);
    return v;
  }
  set(k, v) {
    if (this.map.has(k)) this.map.delete(k);
    this.map.set(k, v);
    this._commit();
    return v;
  }
  get size() { return this.map.size; }
}

