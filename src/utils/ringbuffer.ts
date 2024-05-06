const ring_buffer_error_full = new Error("Buffer full");
const ring_buffer_error_empty = new Error("Buffer empty");
const ring_buffer_error_out_of_range = new Error("Index out of range");

export class RingBuffer<T> {
    private start: number;
    private end: number;
    private buffer: Array<T>;

    static get ErrorFull() {
        return ring_buffer_error_full;
    }
    static get ErrorEmpty() {
        return ring_buffer_error_empty;
    }
    static get ErrorOutOfRange() {
        return ring_buffer_error_out_of_range;
    }

    constructor(max_size: number) {
        this.buffer = new Array<T>(max_size);
    }

    get length(): number {
        return this.end - this.start;
    }

    at(index: number): T {
        if (Math.abs(index) >= this.length) {
            throw RingBuffer.ErrorOutOfRange;
        }

        if (index < 0) {
            index = this.end + index;
        } else {
            index = this.start + index;
        }

        index = index % this.buffer.length;
        return this.buffer[index];
    }

    push_front(element: T) {
        if (this.length >= this.buffer.length) {
            throw RingBuffer.ErrorFull;
        }

        this.start = (this.start - 1) % this.buffer.length;
        this.buffer[this.start] = element;
    }

    push_back(element: T) {
        if (this.length >= this.buffer.length) {
            throw RingBuffer.ErrorFull;
        }

        this.buffer[this.end] = element;
        this.end = (this.end + 1) % this.buffer.length;
    }

    pop_front(): T {
        if (this.length <= 0) {
            throw RingBuffer.ErrorEmpty;
        }

        const res = this.buffer[this.start];
        this.start = (this.start + 1) % this.buffer.length;
        return res;
    }

    pop_back(): T {
        if (this.length <= 0) {
            throw RingBuffer.ErrorEmpty;
        }

        this.end = (this.end - 1) % this.buffer.length;
        const res = this.buffer[this.end];
        return res;
    }

    reset(): void {
        this.start = 0;
        this.end = 0;
    }

    /**
     * if count is positive this.start will be moved forward by count
     * if count is negative this.end will be moved back by cound
     */
    shrink(count: number): void {
        if (Math.abs(count) >= this.length) {
            throw RingBuffer.ErrorOutOfRange;
        }

        if (count < 0) {
            this.end = (this.end + count) % this.buffer.length;
        } else {
            this.start = (this.start + count) % this.buffer.length;
        }
    }

    slice(start: number, end: number, out: Array<T> | null = null): Array<T> {
        start = start < 0 ? this.length + start : start;
        end = end < 0 ? this.length + end : end;

        const length = end - start;
        if (length > this.length) throw RingBuffer.ErrorOutOfRange;

        if (!out) {
            out = new Array<T>(length);
        } else {
            if (out.length < length) throw RingBuffer.ErrorOutOfRange;
        }

        for (let i = 0; i < length; i++) {
            out[i] = this.at(start + i);
        }

        return out;
    }
}
