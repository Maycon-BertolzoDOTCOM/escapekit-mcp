/**
 * Bounded Set
 *
 * FIFO-bounded set backed by a circular buffer. O(1) add/has operations.
 * When capacity is reached, the oldest entry is evicted.
 *
 * Inspired by Claude Code's BoundedUUIDSet in bridge/bridgeMessaging.ts.
 *
 * Usage:
 *   const seen = new BoundedSet<string>(1000)
 *   seen.add('item-1')
 *   seen.has('item-1')  // true
 *   // After 1000 items, oldest is evicted
 */

export class BoundedSet<T> {
  private readonly capacity: number;
  private readonly buffer: T[];
  private head = 0;
  private size = 0;
  private readonly index = new Set<T>();

  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error('Capacity must be positive');
    }
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  /**
   * Add an item. If at capacity, evicts the oldest.
   * @returns true if item was new, false if already present
   */
  add(item: T): boolean {
    if (this.index.has(item)) {
      return false;
    }

    if (this.size === this.capacity) {
      // Evict oldest
      const evicted = this.buffer[this.head];
      this.index.delete(evicted);
      this.size--;
    }

    this.buffer[this.head] = item;
    this.index.add(item);
    this.head = (this.head + 1) % this.capacity;
    this.size++;
    return true;
  }

  /**
   * Check if item exists in the set
   */
  has(item: T): boolean {
    return this.index.has(item);
  }

  /**
   * Remove an item
   */
  delete(item: T): boolean {
    if (!this.index.has(item)) {
      return false;
    }
    this.index.delete(item);
    this.size--;
    return true;
  }

  /**
   * Get current number of items
   */
  get length(): number {
    return this.size;
  }

  /**
   * Clear all items
   */
  clear(): void {
    this.index.clear();
    this.size = 0;
    this.head = 0;
  }

  /**
   * Convert to array (oldest first)
   */
  toArray(): T[] {
    const result: T[] = [];
    for (let i = 0; i < this.size; i++) {
      const idx = (this.head - this.size + i + this.capacity) % this.capacity;
      result.push(this.buffer[idx]);
    }
    return result;
  }
}
