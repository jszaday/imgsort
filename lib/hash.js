/**
 * Tiny synchronous FNV-1a string hash, returned as 8 lowercase hex digits.
 * Shared by the server (image-set hash) and the client (store-name collisions).
 * @param {string} str
 * @returns {string}
 */
export function hash8(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
}
