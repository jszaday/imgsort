/**
 * Fuzzy subsequence score of `query` against `str` (case-insensitive).
 * Rewards consecutive runs, word-boundary starts (after `/ - _` space),
 * earliness, and prefix / exact matches. Returns -1 if `query` is not a
 * subsequence of `str`. Empty query scores 0.
 * @param {string} query
 * @param {string} str
 * @returns {number}
 */
export function fuzzyScore(query, str) {
    const q = query.toLowerCase();
    const s = str.toLowerCase();
    if (q === '') return 0;
    const isBoundary = (/** @type {number} */ i) => i === 0 || '/-_ '.includes(s[i - 1]);
    let si = 0;
    let score = 0;
    let run = 0;
    let first = -1;
    for (let qi = 0; qi < q.length; qi++) {
        let found = -1;
        for (let k = si; k < s.length; k++) {
            if (s[k] === q[qi]) {
                found = k;
                break;
            }
        }
        if (found === -1) return -1;
        if (first === -1) first = found;
        if (qi > 0 && found === si) {
            run += 1;
            score += 5 + run * 3;
        } else {
            run = 0;
        }
        if (isBoundary(found)) score += 10;
        si = found + 1;
    }
    score += Math.max(0, 20 - first);
    if (s === q) score += 100;
    else if (s.startsWith(q)) score += 30;
    return score;
}
