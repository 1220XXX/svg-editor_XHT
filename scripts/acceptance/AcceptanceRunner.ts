import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, cpSync, rmSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative, dirname, isAbsolute, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { inflateSync } from 'node:zlib';

type Check = { kind: string; id?: string; path?: string; value?: string; attributes?: Record<string, string>; absentAttributes?: string[]; parent?: string; children?: string[]; text?: string };
type Visual = { pixel?: number[]; color?: string; pixels?: (number | string)[][] };
type Snapshot = { name: string; afterStep: number; checks: Check[]; visual?: Visual };
type FileCheck = { path: string; absentFile?: boolean; checks?: Check[]; visual?: Visual };
type Scenario = { name: string; steps: { input: string; expected: string }[]; fixtures: Record<string, string>; snapshots: Snapshot[]; files: FileCheck[] };
type Case = { id: string; title: string; requirements: string; objective: string; preconditions: string; entries: string[]; modes: string[]; scenarios: Scenario[] };
type Assertion = { name: string; passed: boolean; expected: unknown; actual: unknown };
type Execution = { case: string; entry: string; mode: string; assertions: Assertion[]; passed: boolean; evidence: string[]; scenarios: number; commands: number };

/** Black-box acceptance only: imports no business classes. All CLI children run in isolated directories. */
class AcceptanceRunner {
  private readonly root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  private readonly temp = mkdtempSync(join(tmpdir(), 'svg-phase1-acceptance-'));
  private readonly project = join(this.temp, 'project');
  private readonly evidence = join(this.temp, 'evidence');
  private readonly executions: Execution[] = [];
  private readonly snapshotRuns: Record<string, number> = {};
  private readonly checks: { command: string; passed: boolean; log: string }[] = [];
  private automatedTests: { files: number; tests: number } | undefined;
  private readonly record = process.argv.includes('--record');
  private readonly keep = process.argv.includes('--keep-temp');
  private chrome: string | undefined;
  private chromeVersion = '';
  private parser!: { parseFromString: (xml: string, mime: string) => any };
  private cases!: Case[];
  private baseline: Record<string, unknown> = {};

  private run(command: string, args: string[], cwd: string, input?: string, timeout = 180000) {
    return spawnSync(command, args, { cwd, ...(input === undefined ? {} : { input }), encoding: 'utf8', timeout, maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, npm_config_cache: join(this.temp, 'npm-cache'), npm_config_update_notifier: 'false' } });
  }
  private git(...args: string[]): string {
    const r = this.run('git', args, this.root);
    if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
    return r.stdout.trim();
  }
  private hash(data: string | Buffer): string { return createHash('sha256').update(data).digest('hex'); }
  private put(path: string, data: string | object): void {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n');
  }
  private safe(base: string, path: string): string {
    const result = resolve(base, path);
    if (isAbsolute(path) || result === base || !result.startsWith(base + sep)) throw new Error(`unsafe relative path: ${path}`);
    return result;
  }
  private assert(out: Assertion[], name: string, expected: unknown, actual: unknown): void {
    out.push({ name, passed: JSON.stringify(actual) === JSON.stringify(expected), expected, actual });
  }
  private expected(s: Scenario, end = s.steps.length): string {
    return s.steps.slice(0, end).filter(x => x.expected !== '').map(x => x.expected + '\n').join('');
  }
  private input(s: Scenario, end = s.steps.length): string { return s.steps.slice(0, end).map(x => x.input).join('\n') + '\n'; }
  private seed(directory: string, s: Scenario): void {
    mkdirSync(directory, { recursive: true });
    for (const [path, content] of Object.entries(s.fixtures)) this.put(this.safe(directory, path), content);
  }
  private cli(entry: string, mode: string, directory: string, input: string) {
    const args = entry === 'source' ? ['--import', join(this.project, 'node_modules/tsx/dist/loader.mjs'), join(this.project, 'src/bootstrap/Main.ts')] : [join(this.project, 'dist/bootstrap/Main.js')];
    if (mode === 'preserve-style') args.push('--preserve-style');
    return this.run(process.execPath, args, directory, input, 30000);
  }
  private children(node: any): any[] { return Array.from(node.childNodes ?? []).filter((c: any) => c.nodeType === 1); }
  private fileChecks(directory: string, file: string, checks: Check[], assertions: Assertion[], label: string): void {
    const path = this.safe(directory, file);
    this.assert(assertions, label + ':exists', true, existsSync(path) && statSync(path).isFile());
    if (!existsSync(path) || !statSync(path).isFile()) return;
    const content = readFileSync(path, 'utf8');
    let xml: any;
    try {
      xml = this.parser.parseFromString(content, 'application/xml');
      this.assert(assertions, label + ':svg-root', 'svg', xml.documentElement?.localName);
      this.assert(assertions, label + ':namespace', 'http://www.w3.org/2000/svg', xml.documentElement?.namespaceURI);
      const ids = Array.from(xml.getElementsByTagName('*')).slice(1).map((n: any) => n.getAttribute('id'));
      this.assert(assertions, label + ':all-shape-ids-present-unique', true, ids.every(Boolean) && new Set(ids).size === ids.length);
    } catch (e) { this.assert(assertions, label + ':valid-xml', true, String(e)); return; }
    const find = (id: string): any => Array.from(xml.getElementsByTagName('*')).find((n: any) => n.getAttribute('id') === id);
    for (const [index, check] of checks.entries()) {
      const name = `${label}:${index}:${check.kind}${check.id ? ':' + check.id : ''}`;
      if (check.kind === 'contains' || check.kind === 'notContains') {
        this.assert(assertions, name, check.kind === 'contains', content.includes(check.value!)); continue;
      }
      if (check.kind === 'equalFile') {
        this.assert(assertions, name, readFileSync(this.safe(directory, check.path!), 'utf8'), content); continue;
      }
      if (!['node', 'root'].includes(check.kind)) throw new Error(`unknown check: ${check.kind}`);
      const element = check.kind === 'root' ? xml.documentElement : find(check.id!);
      this.assert(assertions, name + ':present', true, Boolean(element));
      if (!element) continue;
      for (const [key, value] of Object.entries(check.attributes ?? {})) this.assert(assertions, name + ':attribute:' + key, value, element.getAttribute(key));
      for (const key of check.absentAttributes ?? []) this.assert(assertions, name + ':omitted:' + key, false, element.hasAttribute(key));
      if (check.children) this.assert(assertions, name + ':children', check.children, this.children(element).map(c => c.getAttribute('id')));
      if (check.parent) this.assert(assertions, name + ':parent', check.parent, element.parentNode === xml.documentElement ? 'svg' : element.parentNode?.getAttribute('id'));
      if (check.text !== undefined) this.assert(assertions, name + ':text', check.text, element.textContent);
    }
  }

  // Decode actual browser PNG pixels; supports non-interlaced 8-bit RGB/RGBA with every PNG row filter.
  private pixels(path: string, points: number[][]): number[][] {
    const b = readFileSync(path); let width = 0, height = 0, channels = 0; const idat: Buffer[] = [];
    if (b.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('invalid PNG signature');
    for (let p = 8; p < b.length;) {
      const length = b.readUInt32BE(p), type = b.toString('ascii', p + 4, p + 8), data = b.subarray(p + 8, p + 8 + length);
      if (type === 'IHDR') {
        width = data.readUInt32BE(0); height = data.readUInt32BE(4); channels = data[9] === 6 ? 4 : data[9] === 2 ? 3 : 0;
        if (data[8] !== 8 || data[12] !== 0 || !channels) throw new Error('unsupported PNG format');
      }
      if (type === 'IDAT') idat.push(data);
      p += length + 12;
    }
    const raw = inflateSync(Buffer.concat(idat)), stride = width * channels, rows = Buffer.alloc(stride * height);
    if (raw.length !== (stride + 1) * height) throw new Error('invalid PNG dimensions');
    for (let y = 0; y < height; y++) {
      const filter = raw[y * (stride + 1)]!;
      if (filter > 4) throw new Error('unknown PNG filter');
      for (let x = 0; x < stride; x++) {
        const a = x >= channels ? rows[y * stride + x - channels]! : 0, up = y ? rows[(y - 1) * stride + x]! : 0, c = y && x >= channels ? rows[(y - 1) * stride + x - channels]! : 0;
        const p = a + up - c, pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - c);
        const predictor = [0, a, up, Math.floor((a + up) / 2), pa <= pb && pa <= pc ? a : pb <= pc ? up : c][filter]!;
        rows[y * stride + x] = (raw[y * (stride + 1) + 1 + x]! + predictor) & 255;
      }
    }
    return points.map(([x, y]) => {
      if (x === undefined || y === undefined || x < 0 || y < 0 || x >= width || y >= height) throw new Error('sample outside PNG');
      const p = (y * width + x) * channels; return [...rows.subarray(p, p + 3)];
    });
  }
  private render(svgPath: string, pngPath: string, visual: Visual, assertions: Assertion[], label: string): boolean {
    if (!this.chrome) {
      this.assert(assertions, label + ':visual-renderer', 'Chrome/Chromium installed or ACCEPTANCE_CHROME', 'unavailable'); return false;
    }
    const html = join(this.temp, 'render-' + this.hash(svgPath).slice(0, 16) + '.html');
    this.put(html, '<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:white}</style>' + readFileSync(svgPath, 'utf8').replace(/^<\?xml[^>]*>\s*/, ''));
    const r = this.run(this.chrome, ['--headless', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--hide-scrollbars', '--force-device-scale-factor=1', '--user-data-dir=' + join(this.temp, 'chrome-profile'), '--window-size=800,650', '--screenshot=' + pngPath, pathToFileURL(html).href], this.temp, undefined, 30000);
    this.assert(assertions, label + ':render-exit', 0, r.status);
    if (!existsSync(pngPath)) { this.assert(assertions, label + ':png-exists', true, false); return false; }
    const samples = visual.pixels ?? [[...(visual.pixel ?? []), visual.color!]];
    const points = samples.map(p => [Number(p[0]), Number(p[1])]);
    const actual = this.pixels(pngPath, points);
    samples.forEach((sample, i) => this.assert(assertions, label + `:pixel(${sample[0]},${sample[1]})`, String(sample[2]).toLowerCase(), '#' + actual[i]!.map(n => n.toString(16).padStart(2, '0')).join('')));
    return true;
  }

  private execute(c: Case, entry: string, mode: string): void {
    const key = entry + '-' + mode, outdir = join(this.evidence, 'results', c.id, key);
    const assertions: Assertion[] = [], paths: string[] = [];
    let actual = '', commandCount = 0;
    for (const s of c.scenarios) {
      const directory = join(this.temp, 'sessions', c.id, key, s.name);
      this.seed(directory, s);
      const r = this.cli(entry, mode, directory, this.input(s)); commandCount += s.steps.length;
      actual += `# scenario: ${s.name}\n${r.stdout ?? ''}`;
      this.assert(assertions, s.name + ':exit', 0, r.status);
      this.assert(assertions, s.name + ':stderr', '', r.stderr);
      this.assert(assertions, s.name + ':stdout-exact', this.expected(s), r.stdout?.replace(/\r\n/g, '\n'));
      if (r.error) this.assert(assertions, s.name + ':process-error', null, String(r.error));
      for (const file of s.files) {
        if (file.absentFile) {
          const p = this.safe(directory, file.path);
          this.assert(assertions, s.name + ':' + file.path + ':not-a-file', true, !existsSync(p) || !statSync(p).isFile()); continue;
        }
        this.fileChecks(directory, file.path, file.checks ?? [], assertions, s.name + ':' + file.path);
        const source = this.safe(directory, file.path), target = this.safe(outdir, (c.scenarios.length > 1 ? s.name + '/' : '') + 'files/' + file.path);
        if (existsSync(source) && statSync(source).isFile()) {
          mkdirSync(dirname(target), { recursive: true }); cpSync(source, target); paths.push(relative(outdir, target));
          if (file.visual && entry === 'build' && this.render(source, target.replace(/\.svg$/, '.png'), file.visual, assertions, s.name + ':visual')) paths.push(relative(outdir, target.replace(/\.svg$/, '.png')));
        }
      }
      for (const snapshot of s.snapshots) {
        const replay = join(directory, 'independent-' + snapshot.name.replace('.svg', ''));
        this.seed(replay, s);
        const expectedSave = `saved to acceptance-snapshot.svg (`;
        const replayInput = this.input(s, snapshot.afterStep) + 'save acceptance-snapshot.svg\n';
        const rr = this.cli(entry, mode, replay, replayInput);
        this.snapshotRuns[key] = (this.snapshotRuns[key] ?? 0) + 1;
        const prefix = this.expected(s, snapshot.afterStep);
        this.assert(assertions, s.name + ':' + snapshot.name + ':replay-exit', 0, rr.status);
        this.assert(assertions, s.name + ':' + snapshot.name + ':replay-stderr', '', rr.stderr);
        const suffix = rr.stdout?.slice(prefix.length) ?? '';
        this.assert(assertions, s.name + ':' + snapshot.name + ':replay-prefix', prefix, rr.stdout?.slice(0, prefix.length));
        this.assert(assertions, s.name + ':' + snapshot.name + ':save-response', true, suffix.startsWith(expectedSave) && /^saved to acceptance-snapshot\.svg \(\d+ elements\)\n$/.test(suffix));
        this.fileChecks(replay, 'acceptance-snapshot.svg', snapshot.checks, assertions, s.name + ':' + snapshot.name);
        const source = join(replay, 'acceptance-snapshot.svg'), target = join(outdir, ...(c.scenarios.length > 1 ? [s.name] : []), snapshot.name);
        if (existsSync(source)) {
          mkdirSync(dirname(target), { recursive: true }); cpSync(source, target); paths.push(relative(outdir, target));
          this.put(target.replace('.svg', '.replay.cli'), replayInput); paths.push(relative(outdir, target.replace('.svg', '.replay.cli')));
          if (snapshot.visual && entry === 'build') {
            const png = join(dirname(target), snapshot.name === 'after.svg' ? 'preview.png' : snapshot.name.replace('.svg', '.png'));
            if (this.render(source, png, snapshot.visual, assertions, s.name + ':' + snapshot.name + ':visual')) paths.push(relative(outdir, png));
          }
        }
      }
    }
    this.put(join(outdir, 'actual.txt'), actual);
    const result: Execution = { case: c.id, entry, mode, scenarios: c.scenarios.length, commands: commandCount, assertions, passed: assertions.every(a => a.passed), evidence: ['actual.txt', ...paths] };
    this.put(join(outdir, 'result.json'), result); this.executions.push(result);
    const failures = assertions.filter(a => !a.passed);
    console.log(`${result.passed ? 'PASS' : 'FAIL'} ${c.id} ${key} (${assertions.length} assertions)`);
    for (const fail of failures) console.log(JSON.stringify(fail));
  }

  private terminal(entry: string, mode: string): Execution {
    const args = entry === 'source' ? ['--import', join(this.project, 'node_modules/tsx/dist/loader.mjs'), join(this.project, 'src/bootstrap/Main.ts')] : [join(this.project, 'dist/bootstrap/Main.js')];
    if (mode === 'preserve-style') args.push('--preserve-style');
    const script = String.raw`import os,pty,select,subprocess,sys,time,json,errno
master,slave=pty.openpty()
p=subprocess.Popen(json.loads(sys.argv[1]),stdin=slave,stdout=slave,stderr=slave,cwd=sys.argv[2])
os.close(slave)
data=b''
def until_prompt():
 global data
 start=len(data); deadline=time.monotonic()+15
 while time.monotonic()<deadline:
  if select.select([master],[],[],0.1)[0]:
   try: chunk=os.read(master,65536)
   except OSError as e:
    if e.errno==errno.EIO: return
    raise
   if not chunk:return
   data+=chunk
   if b'svg> ' in data[start:]:return
 raise RuntimeError('prompt timeout')
try:
 until_prompt()
 for command in ['init 200 160','invalid','create g recovered','tree']:
  os.write(master,(command+'\n').encode());until_prompt()
 os.write(master,b'\x04')
 deadline=time.monotonic()+10
 while p.poll() is None and time.monotonic()<deadline:
  if select.select([master],[],[],0.1)[0]:
   try:data+=os.read(master,65536)
   except OSError:break
 status=p.wait(timeout=5)
 sys.stdout.write(json.dumps({'status':status,'raw':data.decode('utf-8')}))
finally:
 if p.poll() is None:p.kill();p.wait()
 os.close(master)
`;
    const directory = join(this.temp, 'terminal', entry + '-' + mode); mkdirSync(directory, { recursive: true });
    const r = this.run('python3', ['-c', script, JSON.stringify([process.execPath, ...args]), directory], directory, undefined, 60000);
    const assertions: Assertion[] = [];
    this.assert(assertions, 'pty-driver-exit', 0, r.status);
    let raw = '', status: unknown = null;
    try { const parsed = JSON.parse(r.stdout); raw = parsed.raw; status = parsed.status; } catch { raw = r.stdout + r.stderr; }
    this.assert(assertions, 'CLI-EOF-exit', 0, status);
    const normalized = raw.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/\r/g, '');
    let offset = 0;
    for (const text of ["svg-editor 0.1 — type 'help' for commands", 'svg> ', 'canvas 200x160 created', 'error: unknown command: invalid', 'g#recovered created', 'svg (200x160)', '└── g#recovered']) {
      const found = normalized.indexOf(text, offset); this.assert(assertions, 'ordered:' + text, true, found >= offset); if (found >= 0) offset = found + text.length;
    }
    this.assert(assertions, 'continuous-prompts', true, (normalized.match(/svg> /g) ?? []).length >= 5);
    const result: Execution = { case: 'terminal', entry, mode, assertions, passed: assertions.every(a => a.passed), evidence: ['raw.txt', 'actual.txt'], scenarios: 1, commands: 4 };
    const dir = join(this.evidence, 'terminal', entry + '-' + mode);
    this.put(join(dir, 'raw.txt'), raw); this.put(join(dir, 'actual.txt'), normalized); this.put(join(dir, 'result.json'), result);
    console.log(`${result.passed ? 'PASS' : 'FAIL'} interactive ${entry}-${mode}`);
    return result;
  }
  private stage(command: string, args: string[], name: string): boolean {
    console.log(`Running isolated ${command} ${args.join(' ')}`);
    const r = this.run(command, args, this.project, undefined, 300000);
    const log = `validation/${name}.txt`;
    this.put(join(this.evidence, log), `$ ${command} ${args.join(' ')}\n${r.stdout}${r.stderr}\nexit=${r.status}\n`);
    this.checks.push({ command: `${command} ${args.join(' ')}`, passed: r.status === 0, log });
    if (name === 'check' && r.status === 0) {
      const output = r.stdout.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '');
      const files = /\bTest Files\s+(\d+)\s+passed/.exec(output);
      const tests = /\bTests\s+(\d+)\s+passed/.exec(output);
      if (!files || !tests) throw new Error('cannot determine actual automated test counts from check output');
      this.automatedTests = { files: Number(files[1]), tests: Number(tests[1]) };
    }
    if (r.status !== 0) console.log((r.stdout + r.stderr).slice(-12000));
    return r.status === 0;
  }
  private validateCases(): void {
    if (this.cases.length !== 40 || new Set(this.cases.map(c => c.id)).size !== 40) throw new Error('exactly 40 distinct main cases required');
    for (const [i, c] of this.cases.entries()) {
      if (!c.id.startsWith(`F${String(i + 1).padStart(2, '0')}-`) || !c.objective || !c.requirements || !c.scenarios.length) throw new Error('invalid case definition');
      if (new Set(c.scenarios.map(s => s.name)).size !== c.scenarios.length) throw new Error('duplicate scenario');
      for (const e of c.entries) if (!['source', 'build'].includes(e)) throw new Error('invalid entry');
      for (const m of c.modes) if (!['default', 'preserve-style'].includes(m)) throw new Error('invalid mode');
      for (const s of c.scenarios) {
        this.safe(this.temp, c.id + '/' + s.name);
        if (!s.steps.length || s.steps.some(x => typeof x.input !== 'string' || typeof x.expected !== 'string' || /[\r\n]/.test(x.input))) throw new Error('invalid steps');
        for (const snap of s.snapshots) if (!snap.name.endsWith('.svg') || snap.afterStep < 1 || snap.afterStep > s.steps.length || !snap.checks.length) throw new Error('invalid snapshot');
      }
    }
    // Guard the comparison itself: a deliberately changed numeric value MUST fail.
    const probe: Assertion[] = []; this.assert(probe, 'negative-control', 'cx=100', 'cx=101');
    if (probe[0]!.passed) throw new Error('comparison negative control failed');
  }

  private document(summary: any): string {
    const lines = ['# Phase 1 功能测试与结果记录', '', '## 目的与范围', '',
      '本轮补充黑盒验收与交付证据，不开发业务功能。覆盖任务书必做的六类图形、19 条命令及已实现的 transform、基础样式保留；box 仅验证未知类型错误，动态插件与完整 SVG/CSS 未实施。任务书为 [phase_cli_1.md](../phase_cli_1.md)，使用说明为 [USER_GUIDE.md](../USER_GUIDE.md)。', '',
      '## 基线、环境和隔离', '',
      `- 被测代码提交：\`${summary.baseline.codeCommit}\`；分支：\`${summary.baseline.branch}\`。`,
      `- 验收采集时的 final 提交：\`${summary.baseline.finalCommit}\`；当时标签对象：\`${summary.baseline.finalTagObject}\`。验收脚本不修改标签；这些字段记录采集时状态，最终交付标签说明见 [正式报告](../README.md#1-项目完成情况)。`,
      `- Node：\`${summary.environment.node}\`；npm：\`${summary.environment.npm}\`；平台：\`${process.platform}/${process.arch}\`。`,
      '- 依赖：`@xmldom/xmldom 0.9.12`、`@types/node 26.6.5`、`tsx 4.23.15`、`typescript 7.0.2`、`vitest 5.0.5`、`@vitest/coverage-v8 5.0.5`；锁文件 SHA-256 与实际 npm ls 见 [summary.json](summary.json)。',
      '- 业务代码与提交一致；已有未提交文件仅作为工作区清单记录，均不参与测试。使用 git archive 导出确认后的提交，叠加本轮脚本、用例及唯一新增 npm 命令；依赖、npm 缓存、dist、coverage、CLI 产物和路径实验全在临时目录。原目录 demo.svg 未被读取为用例或覆盖。',
      '- 源码入口：`node --import <隔离目录>/node_modules/tsx/dist/loader.mjs <隔离目录>/src/bootstrap/Main.ts`；构建：`npm run build`（包含在 check 中）；生产入口：`node <隔离目录>/dist/bootstrap/Main.js`。两者均以各自场景目录为 cwd。',
      '- default 为普通模式；preserve-style 仅在启动参数追加 `--preserve-style`。F20/F25/F28/F31/F36 额外在增强模式运行，覆盖结构、历史、屏障、持久化和综合用例。',
      '- 预期输出在 cases.json 中预先定义，不由实际输出生成。每个主会话完整 stdout 精确比较，只统一 CRLF；错误、数值和顺序均不滤除。退出码与 stderr 另行断言。SVG 使用 XML DOM 检查真实保存文件的属性、文本、父级、顺序与省略项。',
      '- 每个 snapshots.afterStep 表示主场景执行完第 N 条输入后的状态（空行/注释也计入输入索引）。中间 SVG 在全新目录重放前缀后另行 save；对应 .replay.cli 是精确回放输入。原主会话不插入证据保存，保留原 undo/redo 序列。', '',
      '## 重新执行', '', '需要项目声明的 Node 环境、npm、git、tar 和 Python 3（标准库 PTY）；精选视觉断言需要已安装 Chrome/Chromium。未找到浏览器时明确失败并保留材料，不能宣称视觉检查通过。可通过 `ACCEPTANCE_CHROME=/absolute/path/to/chrome` 指定浏览器，不新增 npm 依赖。', '',
      '从项目根目录运行（仅入口加载使用现有 tsx；如尚未安装项目依赖，可先在自行建立的临时副本 npm ci）：', '',
      '```sh', 'nvm use', 'npm run test:acceptance', 'npm run test:acceptance -- --record', '```', '',
      '默认模式临时执行 npm ci → npm run check → 实际功能验收 → npm run test:coverage，返回 0/1；不覆盖已提交证据。--record 在运行与结果检查结束后仅更新 doc/acceptance/results、terminal、validation、summary.json 和本报告，即使失败也如实记录并返回 1。用例 cases.json 不被记录器改写。失败保留临时目录；通过默认清理，--keep-temp 可保留用于诊断。原目录其他文件和运行产物不被脚本写入。', '',
      '最终还在干净临时副本重新执行默认命令，并以证据目录前后哈希确认未覆盖证据。命令输出提示临时目录；所有已提交日志使用仓库路径占位符代替随机临时前缀，文件路径测试仍比较原始相对路径。', '',
      '## 用例、步骤、预期与实际', '', '40 个主用例共 ' + summary.counts.definedScenarios + ' 个独立子场景。各用例的预置输入文件内容、执行顺序、每条预期、文件断言和模式在 [cases.json](cases.json) 完整定义。下表 input.cli 与 expected.txt 按 # scenario 分节；复现每个分节须新建进程，并按 cases.json 的 fixtures 建立前置文件。直接串接多个分节不会自动重启进程，应使用上述 runner。result.json 的每条断言同时保存 expected、actual 和 passed。', '',
      '| 用例 | 任务书/范围 | 目标和预期 | 输入与预期 | 实际结果与证据 |', '|---|---|---|---|---|'];
    for (const c of this.cases) {
      const results = this.executions.filter(e => e.case === c.id);
      lines.push(`| ${c.id} ${c.title} | ${c.requirements} | ${c.objective.replace(/。$/, '')}；${c.scenarios.length} 个子场景 | [输入](results/${c.id}/input.cli) · [预期](results/${c.id}/expected.txt) | ${results.length === c.entries.length * c.modes.length && results.every(r => r.passed) ? '通过' : '**失败或未执行**'}：` + results.map(r => `[${r.entry}-${r.mode}](results/${c.id}/${r.entry}-${r.mode}/result.json)`).join(' · ') + ' |');
    }
    lines.push('', '## 各用例前置条件、步骤和逐步预期', '', '本节全部内容来自预先编写的 cases.json；实际输出见各模式 actual.txt，完整比较判定见同目录 result.json。相同编号在两种入口各执行一次，注明额外增强模式的还会另执行一次。', '');
    const cell = (s: string): string => s === '' ? '（无输出）' : s.split('\n').map(line => '<code>' + line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\|/g, '&#124;') + '</code>').join('<br>');
    for (const c of this.cases) {
      lines.push(`### ${c.id} ${c.title}`, '', c.preconditions, '', `模式：${c.modes.join('、')}；入口：${c.entries.join('、')}。${c.objective}`, '');
      for (const s of c.scenarios) {
        lines.push(`**子场景：${s.name}**。前置文件：${Object.keys(s.fixtures).length ? Object.keys(s.fixtures).map(p => '`' + p + '`').join('、') + '（完整内容见 cases.json 的 fixtures）' : '无'}。`, '', '| 步骤 | 输入 | 预期输出 |', '|---|---|---|');
        s.steps.forEach((step, index) => lines.push(`| ${index + 1} | ${cell(step.input)} | ${cell(step.expected)} |`));
        lines.push('', `SVG 状态证据：${s.snapshots.length ? s.snapshots.map(snap => '`' + snap.name + '` = 第 ' + snap.afterStep + ' 条输入后的状态，由独立前缀重放保存').join('；') : '不额外保存中间状态'}。${s.files.length ? '主会话真实文件检查：' + s.files.map(f => '`' + f.path + '`').join('、') + '。' : ''}`, '');
      }
      lines.push('实际结果：' + this.executions.filter(e => e.case === c.id).map(r => `[${r.entry}-${r.mode} 输出](results/${c.id}/${r.entry}-${r.mode}/actual.txt)（${r.passed ? '通过' : '**失败**'}）`).join('；') + '。', '');
    }
    lines.push('## 视觉检查', '',
      'PNG 由实际保存 SVG 经 Chrome headless 原生 SVG 渲染得到，白色页面背景、800×650 截图、设备比例 1。没有手绘预期图片。断言解码实际 PNG 并读取指定内部像素；SVG 顺序和属性另行检查。字体由本机浏览器/系统提供，文字排版不作跨平台逐像素相等承诺。自动像素检查只证明选定区域，不代替所有图形的人工审美审查。', '',
      '| 场景 | SVG 状态及 PNG | 核查 |', '|---|---|---|',
      '| F23 front | [之前](results/F23-front/build-default/before.svg) / [之后](results/F23-front/build-default/after.svg)；[之前 PNG](results/F23-front/build-default/before.png) / [之后 PNG](results/F23-front/build-default/preview.png) | (60,60) 从蓝 #0000ff 变红 #ff0000，重叠区域由红矩形覆盖 |',
      '| F24 back | [之前](results/F24-back/build-default/before.svg) / [之后](results/F24-back/build-default/after.svg)；[之前 PNG](results/F24-back/build-default/before.png) / [之后 PNG](results/F24-back/build-default/preview.png) | 蓝矩形置底后，(60,60) 从蓝变红 |',
      '| F36 综合流程图 | [SVG](results/F36-task-book/build-default/flowchart/files/flowchart.svg) / [PNG](results/F36-task-book/build-default/flowchart/files/flowchart.png) | 8 元素、node2 撤销移动后 y=100，中文内容 v2、边线及嵌套；起点框内 (130,110) 为 #4a90d9 |',
      '| F39 显式颜色 | [固化 SVG](results/F39-color-link/build-preserve-style/frozen.svg) / [PNG](results/F39-color-link/build-preserve-style/frozen.png)；[inherit SVG](results/F39-color-link/build-preserve-style/inherit.svg) / [PNG](results/F39-color-link/build-preserve-style/inherit.png) | 固化后左红右绿，恢复 inherit 后左右均绿；分别采样 (30,30)、(120,30) |', '',
      '## 偏差、失败与限制', '',
      '- 任务书 §6 典型会话初始 tree 与导入 other.svg 的 tree 均与实现一致，逐行比较未过滤空格。',
      '- §6.1 版本 A 的 tree 按最长完整前缀加两个空格对齐；arrow1 显示实际显式 stroke=black，而题目示例略去该样式。两者是展示差异，未过滤属性或错误输出。命令、几何、结构及文件内容均按实质要求验证。',
      '- F34 使用现存目录作为不可写文件目标，避免 chmod 在管理员身份/不同系统上不可靠；证明写入失败原子性，不代表覆盖每一种 OS 权限/磁盘故障。',
      '- 默认模式结构调整遵循新父级继承；可选样式增强只保留三项基础属性。完整 SVG/CSS、动态插件、box 实现、rotate/skew/非等比变换均不属于本轮已完成功能。',
      '- 只验证本次 Node/平台；交互终端由真实 PTY 验证提示符、逐次输入、错误恢复和 Ctrl+D EOF，保留 raw 与去终端控制字符后的文本。Windows PTY 未测试。',
      '- 采集脚本保留当时的 final，不将其描述为后续最终交付状态；标签更新须另有用户授权，并记录真实操作时间。',
      `- 未解决失败：${summary.failures.length ? JSON.stringify(summary.failures) : '无'}。未观测 GitHub Actions 的执行状态，本报告只记录本地隔离运行。`, '',
      '## 统计和结论', '',
      `- 主用例：${summary.counts.mainCases}；独立子场景：${summary.counts.definedScenarios}；定义输入：${summary.counts.definedInputs}（不是新增功能数量）。`,
      `- 主矩阵实际执行 ${summary.counts.caseExecutions} 次、子场景 ${summary.counts.scenarioExecutions} 次、输入 ${summary.counts.executedInputs} 条；断言 ${summary.counts.assertions} 条。中间 SVG 重放另外执行 ${summary.counts.snapshotReplays} 次，不计为新增功能/子场景。`,
      `- 含中间状态重放与 PTY，总计 ${summary.counts.totalCLIProcesses} 个真实 CLI 进程；主矩阵与重放及 PTY 分别统计，不能将重复运行计为新增用例。`,
      '- 入口/模式执行统计、断言数及失败列表见 [summary.json](summary.json)；每组两种入口结果均独立保存，不用一次运行代替另一入口。',
      `- 隔离 npm ci、严格类型检查、${summary.automatedTests?.files ?? '未完成'} 个自动化测试文件 / ${summary.automatedTests?.tests ?? '未完成'} 项测试、生产构建、覆盖率检查及验收脚本自身严格类型检查的命令输出见 [验证日志](validation/)。数量取自本次实际 check 输出，不写死旧值。`,
      '- 启动参数验证独立放在 tests/startup-options.test.ts，由 check 覆盖解析类、源码入口和新构建入口；40 个功能主用例保持原范围。启动错误检查退出码 2、精确 stderr、空 stdout 和输入命令未执行；编辑器命令错误仍继续执行。',
      '- 交互 PTY 共 4 次（源码/构建 × 普通/增强），见 [交互记录](terminal/)。',
      `- 总结：${summary.passed ? '本轮全部必要验证通过；当前 Phase 1 功能与已声明增强在上述边界内通过可重复验收。' : '存在失败，不能宣布全部通过，也不应提交推送。'}`, '');
    return lines.join('\n');
  }

  async main(): Promise<void> {
    console.log('Isolated workspace: ' + this.temp);
    const status = this.git('status', '--short'), codeCommit = this.git('rev-parse', 'HEAD');
    const packageBase = JSON.parse(this.git('show', codeCommit + ':package.json'));
    const packageCurrent = JSON.parse(readFileSync(join(this.root, 'package.json'), 'utf8'));
    for (const field of ['dependencies', 'devDependencies', 'engines']) if (JSON.stringify(packageBase[field]) !== JSON.stringify(packageCurrent[field])) throw new Error('uncommitted dependency/engine change');
    const businessPaths = ['src', 'tests', 'examples', 'package-lock.json', 'tsconfig.json', 'tsconfig.build.json', 'vitest.config.ts', '.nvmrc'];
    const dirty = [this.git('diff', 'HEAD', '--name-only', '--', ...businessPaths), this.git('ls-files', '--others', '--exclude-standard', '--', ...businessPaths)].filter(Boolean).join('\n');
    if (dirty) throw new Error('business/config/test changes differ from commit; refusing to misattribute baseline: ' + dirty);
    this.baseline = { codeCommit, branch: this.git('branch', '--show-current'), sourceTree: this.git('rev-parse', codeCommit + ':src'), testsTree: this.git('rev-parse', codeCommit + ':tests'), finalCommit: this.git('rev-parse', 'final^{commit}'), finalTagObject: this.git('rev-parse', 'final'), worktreeBefore: status, businessWorktreeChanges: dirty, finalToHead: this.git('diff', '--name-status', 'final..HEAD'), recentCommits: this.git('log', '--oneline', '--decorate', '-8') };
    this.cases = JSON.parse(readFileSync(join(this.root, 'doc/acceptance/cases.json'), 'utf8')).cases;
    this.validateCases(); mkdirSync(this.project, { recursive: true });
    const archive = join(this.temp, 'baseline.tar'); this.git('archive', '--format=tar', '--output=' + archive, codeCommit);
    const tar = this.run('tar', ['-xf', archive, '-C', this.project], this.temp); if (tar.status !== 0) throw new Error(tar.stderr);
    cpSync(join(this.root, 'scripts/acceptance'), join(this.project, 'scripts/acceptance'), { recursive: true });
    mkdirSync(join(this.project, 'doc/acceptance'), { recursive: true }); cpSync(join(this.root, 'doc/acceptance/cases.json'), join(this.project, 'doc/acceptance/cases.json'));
    packageBase.scripts['test:acceptance'] = 'node --import tsx scripts/acceptance/AcceptanceRunner.ts';
    this.put(join(this.project, 'package.json'), packageBase);
    for (const c of this.cases) {
      const dir = join(this.evidence, 'results', c.id);
      this.put(join(dir, 'input.cli'), c.scenarios.map(s => `# scenario: ${s.name}\n` + this.input(s)).join('\n'));
      this.put(join(dir, 'expected.txt'), c.scenarios.map(s => `# scenario: ${s.name}\n` + this.expected(s)).join(''));
    }
    if (!this.stage('npm', ['ci', '--prefer-offline', '--no-audit', '--no-fund'], 'npm-ci')) throw new Error('isolated npm ci failed');
    const versions = this.run('npm', ['ls', '--depth=0', '--json'], this.project); if (versions.status !== 0) throw new Error(versions.stderr);
    const { DOMParser } = await import(pathToFileURL(join(this.project, 'node_modules/@xmldom/xmldom/lib/index.js')).href);
    this.parser = new DOMParser({ onError: (_level: string, message: string) => { throw new Error(message); } });
    const candidates = [process.env.ACCEPTANCE_CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'];
    this.chrome = candidates.find(p => p && existsSync(p));
    if (this.chrome) this.chromeVersion = this.run(this.chrome, ['--version'], this.temp).stdout.trim();
    const built = this.stage('npm', ['run', 'check'], 'check');
    this.stage(join(this.project, 'node_modules/.bin/tsc'), ['--ignoreConfig', '--noEmit', '--strict', '--noUncheckedIndexedAccess', '--exactOptionalPropertyTypes', '--noUnusedLocals', '--noUnusedParameters', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--types', 'node', '--skipLibCheck', 'scripts/acceptance/AcceptanceRunner.ts'], 'runner-typecheck');
    if (built) for (const c of this.cases) for (const mode of c.modes) for (const entry of c.entries) this.execute(c, entry, mode);
    const terminals: Execution[] = [];
    if (built) for (const entry of ['source', 'build']) for (const mode of ['default', 'preserve-style']) terminals.push(this.terminal(entry, mode));
    this.stage('npm', ['run', 'test:coverage'], 'coverage');
    const matrix = ['source-default', 'build-default', 'source-preserve-style', 'build-preserve-style'].map(key => {
      const e = this.executions.filter(r => r.entry + '-' + r.mode === key);
      const replayCount = this.snapshotRuns[key] ?? 0;
      const interactiveCount = terminals.filter(t => t.entry + '-' + t.mode === key).length;
      const scenarioExecutions = e.reduce((a, r) => a + r.scenarios, 0);
      return { key, caseExecutions: e.length, scenarioExecutions, snapshotReplays: replayCount, interactiveExecutions: interactiveCount, totalCLIProcesses: scenarioExecutions + replayCount + interactiveCount, assertions: e.reduce((a, r) => a + r.assertions.length, 0), passed: e.filter(r => r.passed).length, failed: e.filter(r => !r.passed).length };
    });
    const failures = [...this.executions, ...terminals].filter(r => !r.passed).map(r => ({ case: r.case, entry: r.entry, mode: r.mode, failedAssertions: r.assertions.filter(a => !a.passed).map(a => a.name) }));
    for (const c of this.checks) if (!c.passed) failures.push({ case: c.command, entry: 'validation', mode: 'isolated', failedAssertions: [c.log] });
    const summary = { schemaVersion: 1, generatedAt: new Date().toISOString(), baseline: this.baseline, environment: { node: process.version, npm: this.run('npm', ['--version'], this.project).stdout.trim(), platform: process.platform, architecture: process.arch, dependencies: JSON.parse(versions.stdout).dependencies, lockSha256: this.hash(readFileSync(join(this.project, 'package-lock.json'))), renderer: this.chrome ?? null, rendererVersion: this.chromeVersion },
      inputDigests: { cases: this.hash(readFileSync(join(this.root, 'doc/acceptance/cases.json'))), runner: this.hash(readFileSync(fileURLToPath(import.meta.url))) },
      counts: { mainCases: this.cases.length, definedScenarios: this.cases.reduce((a, c) => a + c.scenarios.length, 0), definedInputs: this.cases.flatMap(c => c.scenarios).reduce((a, s) => a + s.steps.length, 0), caseExecutions: this.executions.length, scenarioExecutions: this.executions.reduce((a, e) => a + e.scenarios, 0), executedInputs: this.executions.reduce((a, e) => a + e.commands, 0), assertions: this.executions.reduce((a, e) => a + e.assertions.length, 0), snapshotReplays: Object.values(this.snapshotRuns).reduce((a, n) => a + n, 0), interactiveExecutions: terminals.length, interactiveAssertions: terminals.reduce((a, e) => a + e.assertions.length, 0), totalCLIProcesses: matrix.reduce((a, m) => a + m.totalCLIProcesses, 0) },
      matrix, terminal: terminals.map(({ assertions: _assertions, ...rest }) => rest), validation: this.checks, automatedTests: this.automatedTests ?? null, failures,
      coverage: existsSync(join(this.project, 'coverage/coverage-final.json')) ? 'Full report generated only inside isolated workspace; console summary retained in validation/coverage.txt.' : 'See validation/coverage.txt.',
      passed: failures.length === 0 && this.executions.length === this.cases.reduce((a, c) => a + c.entries.length * c.modes.length, 0) };
    this.put(join(this.evidence, 'summary.json'), summary); this.put(join(this.evidence, '功能测试与结果记录.md'), this.document(summary));
    // Replace only machine-specific temporary prefixes in committed logs/results. Never remove errors or numerical differences.
    const normalize = (dir: string): void => { for (const name of readdirSync(dir)) { const path = join(dir, name); if (statSync(path).isDirectory()) normalize(path); else if (/\.(json|txt|md)$/.test(name)) { let value = readFileSync(path, 'utf8'); value = value.split(this.temp).join('<temporary-workspace>'); value = value.split(this.root).join('<repository>'); this.put(path, value); } } };
    normalize(this.evidence);
    if (this.git('rev-parse', 'HEAD') !== codeCommit || this.git('rev-parse', 'final') !== this.baseline.finalTagObject) throw new Error('HEAD/final changed during run; refusing to record');
    if (this.record) {
      const target = join(this.root, 'doc/acceptance');
      for (const name of ['results', 'terminal', 'validation', 'summary.json', '功能测试与结果记录.md']) { rmSync(join(target, name), { recursive: true, force: true }); cpSync(join(this.evidence, name), join(target, name), { recursive: true }); }
      console.log('Recorded doc/acceptance (passed=' + summary.passed + ')');
    }
    console.log(JSON.stringify({ ...summary.counts, matrix, failures, passed: summary.passed }, null, 2));
    if (!summary.passed) process.exitCode = 1;
    else if (!this.keep) rmSync(this.temp, { recursive: true, force: true });
  }
}

await new AcceptanceRunner().main().catch(error => { console.error(error); process.exitCode = 1; });
