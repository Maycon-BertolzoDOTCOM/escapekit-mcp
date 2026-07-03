const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const INTERVAL_MS = 80;
const ANSI_CLEAR = '\r\x1b[K';

export class Spinner {
  private intervalId: NodeJS.Timeout | null = null;
  private frameIndex = 0;
  private currentMessage = '';

  start(message: string): void {
    this.currentMessage = message;

    // If already running, just update the message without creating a new interval
    if (this.intervalId !== null) {
      return;
    }

    process.stdout.write(`${message} `);

    this.intervalId = setInterval(() => {
      process.stdout.write(ANSI_CLEAR);
      process.stdout.write(`${this.currentMessage} ${FRAMES[this.frameIndex]}`);
      this.frameIndex = (this.frameIndex + 1) % FRAMES.length;
    }, INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      process.stdout.write(ANSI_CLEAR);
    }
  }
}