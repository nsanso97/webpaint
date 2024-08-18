export function assert(condition: any, message = ""): asserts condition {
    if (!condition) {
        let msg = `Assertion failed: ${condition}`;
        if (message) {
            msg += "\n" + message;
        }
        throw new Error(msg);
    }
}
