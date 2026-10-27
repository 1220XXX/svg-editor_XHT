import { ShapeFactory } from '../domain/factories/ShapeFactory.js';
import { EditorSession } from '../application/EditorSession.js';
import { CommandFactory } from '../application/commands/CommandFactory.js';
import { CliController } from '../cli/CliController.js';
import { Repl } from '../cli/Repl.js';
import { OutputFormatter } from '../cli/formatting/OutputFormatter.js';
import { StartupOptions } from './StartupOptions.js';

import { LocalTextStorage } from '../infrastructure/filesystem/LocalTextStorage.js';
import { SvgCodec } from '../infrastructure/svg/SvgCodec.js';
import { FollowParentStyles } from '../domain/styles/FollowParentStyles.js';
import { PreserveBasicStyles } from '../domain/styles/PreserveBasicStyles.js';

let options: StartupOptions | undefined;
try {
  options = new StartupOptions(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`${new OutputFormatter().error(error)}\n`);
  process.exitCode = 2;
}

if (options) {
  const factory = new ShapeFactory();
  const session = new EditorSession(factory, new LocalTextStorage(), new SvgCodec(factory));
  const styles = options.preserveStyle ? new PreserveBasicStyles() : new FollowParentStyles();
  const controller = new CliController(session, new CommandFactory(factory, styles));
  await new Repl(controller).run(process.stdin, process.stdout, Boolean(process.stdin.isTTY && process.stdout.isTTY));
}
