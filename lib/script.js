import { hash8 } from './hash.js';

/**
 * @typedef {{ op: 'mkdirp', path: string[] }
 *   | { op: 'intern', src: string, name: string }
 *   | { op: 'reference', category: string, name: string, path: string, depth: number }} Op
 */

/**
 * @typedef {{ text: string, ref?: { category: string, path: string } }} Line
 * A single lowered script line. `ref` is set only on the lines that realize one
 * `(category, image)` navigational reference (`ln -nfs` / the `.lnk` block),
 * never on headers, `mkdir`, `echo`/`Write-Host`, or the intern move itself.
 */

/**
 * @typedef {{ text: string, lines: Line[] }} Lowered
 * `text` is `lines.map(l => l.text).join('\n')` plus one trailing newline.
 */

/**
 * @typedef {Object} ScriptState
 * @property {string[]} images
 * @property {string[]} folders
 * @property {Map<string, Set<string>>} assignments  keyed by image path
 * @property {Record<string, string>} discovered     image path -> discovered category
 * @property {Set<string>} checkedRefs               "cat\npath" entries
 * @property {string} out                            --out root ('.' by default)
 * @property {string} storeName                      hidden single-store dir name
 * @property {boolean} noSingleStoreUnchanged
 * @property {boolean} [keepUncheckedRefs]            emit reference ops for every
 *   category an interned image is in, not just the checked ones (script view)
 */

/**
 * POSIX shell single-quote a string.
 * @param {string} value
 * @returns {string}
 */
export function shquote(value) {
    return `'${value.split("'").join("'\\''")}'`;
}

/**
 * PowerShell single-quote a string literal ('' escapes a quote).
 * @param {string} value
 * @returns {string}
 */
export function psquote(value) {
    return `'${String(value).split("'").join("''")}'`;
}

/**
 * Key for a (category, image) reference selection.
 * @param {string} cat
 * @param {string} p
 * @returns {string}
 */
export function refKey(cat, p) {
    return `${cat}\n${p}`;
}

/** @param {string} p */
function baseName(p) {
    const parts = p.split('/');
    return parts[parts.length - 1];
}

/** @param {string} cat */
function catSegs(cat) {
    return cat.split('/');
}

/**
 * Join `--out`-relative segments under the out root.
 * @param {string} out
 * @param {string[]} segs
 * @param {string} sep
 * @returns {string}
 */
export function outJoin(out, segs, sep) {
    return (out === '.' ? segs : [out, ...segs]).join(sep);
}

/**
 * Build the abstract op list for the generated script from checklist state.
 * @param {ScriptState} state
 * @returns {Op[]}
 */
export function buildOps(state) {
    const { images, folders, assignments, discovered, checkedRefs, storeName } = state;
    const unchangedSkip = state.noSingleStoreUnchanged;
    // Display mode: still gate intern on a checked ref, but emit a `reference`
    // op for every category an interned image is in (checked or not) so the
    // script view can show the unchecked ones as `# `-commented rows. The
    // copy/download path leaves this off and gets a clean script.
    const keepUncheckedRefs = !!state.keepUncheckedRefs;
    /** @param {string} image */
    const catsOf = image => [...(assignments.get(image) || new Set())];

    /** @type {string[]} */
    const interned = [];
    const internedSet = new Set();
    for (const image of images) {
        const cats = catsOf(image);
        if (
            unchangedSkip &&
            cats.length === 1 &&
            cats[0] === (discovered[image] || 'uncategorized')
        ) {
            continue; // left in place
        }
        const anyChecked = cats.some(cat => checkedRefs.has(refKey(cat, image)));
        if (anyChecked && !internedSet.has(image)) {
            internedSet.add(image);
            interned.push(image);
        }
    }

    if (interned.length === 0) return [];

    const used = new Set();
    /** @type {Record<string, string>} */
    const storeNameFor = {};
    for (const image of interned) {
        let name = baseName(image);
        if (used.has(name)) name = `${hash8(image)}-${baseName(image)}`;
        used.add(name);
        storeNameFor[image] = name;
    }

    /** @type {Op[]} */
    const ops = [{ op: 'mkdirp', path: [storeName] }];
    for (const image of interned) {
        ops.push({ op: 'intern', src: image, name: storeNameFor[image] });
    }

    for (const cat of folders) {
        if (cat === 'trash') continue; // trash: interned, never referenced
        const refs = interned.filter(
            image =>
                catsOf(image).includes(cat) &&
                (keepUncheckedRefs || checkedRefs.has(refKey(cat, image)))
        );
        if (refs.length === 0) continue;
        ops.push({ op: 'mkdirp', path: catSegs(cat) });
        for (const image of refs) {
            ops.push({
                op: 'reference',
                category: cat,
                name: storeNameFor[image],
                path: image,
                depth: catSegs(cat).length,
            });
        }
    }

    return ops;
}

/**
 * Assemble a {@link Lowered} from a list of {@link Line}s.
 * @param {Line[]} lines
 * @returns {Lowered}
 */
function assemble(lines) {
    return { text: lines.map(l => l.text).join('\n') + '\n', lines };
}

/**
 * @param {Op[]} ops
 * @param {{ shebang: string, out: string, storeName: string }} opts
 * @returns {Lowered}
 */
export function lowerPosix(ops, opts) {
    const { shebang, storeName } = opts;
    const out = opts.out || '.';
    /** @param {string[]} segs */
    const P = segs => outJoin(out, segs, '/');
    /** @type {Line[]} */
    const lines = [];
    /** @param {string} text @param {Line['ref']} [ref] */
    const push = (text, ref) => lines.push(ref ? { text, ref } : { text });

    if (ops.length === 0) {
        [shebang, 'set -e', '', '# nothing to do'].forEach(t => push(t));
        return assemble(lines);
    }
    [shebang, 'set -e', ''].forEach(t => push(t));
    for (const o of ops) {
        if (o.op === 'mkdirp') {
            push(`mkdir -p ${shquote(P(o.path))}`);
        } else if (o.op === 'intern') {
            const dst = P([storeName, o.name]);
            push(
                `echo ${shquote(
                    `interning into single store: ./${o.src} -> ${P([storeName])}/${o.name}`
                )}`
            );
            push(`mv -i ${shquote(`./${o.src}`)} ${shquote(dst)}`);
        } else {
            const link = P(catSegs(o.category).concat([o.name]));
            const target = `${'../'.repeat(o.depth)}${storeName}/${o.name}`;
            push(`ln -nfs ${shquote(target)} ${shquote(link)}`, {
                category: o.category,
                path: o.path,
            });
        }
    }
    return assemble(lines);
}

/**
 * @param {Op[]} ops
 * @param {{ out: string, storeName: string }} opts
 * @returns {Lowered}
 */
export function lowerWindows(ops, opts) {
    const { storeName } = opts;
    const out = opts.out || '.';
    /** @param {string[]} segs */
    const W = segs => outJoin(out, segs, '\\');

    const header = ["$ErrorActionPreference = 'Stop'", '$root = (Get-Location).Path', ''];
    /** @type {Line[]} */
    const lines = [];
    /** @param {string} text @param {Line['ref']} [ref] */
    const push = (text, ref) => lines.push(ref ? { text, ref } : { text });

    if (ops.length === 0) {
        [header[0], '', '# nothing to do'].forEach(t => push(t));
        return assemble(lines);
    }
    header.forEach(t => push(t));
    for (const o of ops) {
        if (o.op === 'mkdirp') {
            const p = W(o.path);
            push(`New-Item -ItemType Directory -Force -Path ${psquote(p)} | Out-Null`);
            if (o.path.length === 1 && o.path[0] === storeName) {
                push(`(Get-Item ${psquote(p)}).Attributes += 'Hidden'`);
            }
        } else if (o.op === 'intern') {
            const srcWin = `.\\${o.src.split('/').join('\\')}`;
            const dst = W([storeName, o.name]);
            push(
                `Write-Host ${psquote(
                    `interning into single store: ${srcWin} -> ${W([storeName])}\\${o.name}`
                )}`
            );
            push(`Move-Item -LiteralPath ${psquote(srcWin)} -Destination ${psquote(dst)}`);
        } else {
            const link = W(catSegs(o.category).concat([`${o.name}.lnk`]));
            const targetAbs = W([storeName, o.name]);
            const ref = { category: o.category, path: o.path };
            // All four lines carry the ref so the script view dims / comments
            // the whole `.lnk` block together; the view draws the gutter
            // checkbox only on the first line of the run.
            push('$ws = New-Object -ComObject WScript.Shell', ref);
            push(`$s = $ws.CreateShortcut((Join-Path $root ${psquote(link)}))`, ref);
            push(`$s.TargetPath = (Join-Path $root ${psquote(targetAbs)})`, ref);
            push('$s.Save()', ref);
        }
    }
    return assemble(lines);
}
