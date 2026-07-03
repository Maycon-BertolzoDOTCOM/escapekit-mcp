/**
 * Circular Buffer
 *
 * Fixed-size ring buffer with automatic eviction of oldest entries.
 * Inspired by Claude Code's CircularBuffer in utils/CircularBuffer.ts.
 *
 * Usage:
 *   const buf = new CircularBuffer<string>(100)
 *   buf.add('a')
 *   buf.add('b')
 *   buf.getRecent(2)  // ['a', 'b']
 *   buf.toArray()     // ['a', 'b']
 */

export class CircularBuffer<T> {
  private buffer: (T | undefined)[];
  private head = 0;
  private currentSize = 0;

  constructor(private readonly capacity: number) {
    if (capacity <= 0) {
      throw new Error('Capacity must be positive');
    }
    this.buffer = new Array(capacity);
  }

  /**
   * Add an item. If at capacity, evicts the oldest.
   */
  add(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.currentSize < this.capacity) {
      this.currentSize++;
    }
  }

  /**
   * Add multiple items at once
   */
  addAll(items: T[]): void {
    for (const item of items) {
      this.add(item);
    }
  }

  /**
   * Get the most recent N items (oldest first, newest last)
   */
  getRecent(count: number): T[] {
    const result: T[] = [];
    const available = Math.min(count, this.currentSize);

    for (let i = 0; i < available; i++) {
      // Walk from (head - available) forward
      const index = (this.head - available + i + this.capacity) % this.capacity;
      result.push(this.buffer[index] as T);
    }

    return result;
  }

  /**
   * Convert to array (oldest first)
   */
  toArray(): T[] {
    if (this.currentSize === 0) return [];

    const result: T[] = [];
    for (let i = 0; i < this.currentSize; i++) {
      // When full, oldest is at head position
      // When not full, oldest is at index 0
      const index = (this.head - this.currentSize + i + this.capacity) % this.capacity;
      result.push(this.buffer[index] as T);
    }
    return result;
  }

  /**
   * Get current number of items
   */
  get size(): number {
    return this.currentSize;
  }

  /**
   * Check if buffer is full
   */
  get isFull(): boolean {
    return this.currentSize === this.capacity;
  }

  /**
   * Clear all items
   */
  clear(): void {
    this.buffer = new Array(this.capacity);
    this.head = 0;
    this.currentSize = 0;
  }
}
