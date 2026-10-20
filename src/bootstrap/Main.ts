import { ShapeFactory } from '../domain/factories/ShapeFactory.js';
import { EditorSession } from '../application/EditorSession.js';
import { CommandFactory } from '../application/commands/CommandFactory.js';
import { CliController } from '../cli/CliController.js';
import { Repl } from '../cli/Repl.js';

import { LocalTextStorage } from '../infrastructure/filesystem/LocalTextStorage.js';
import { SvgCodec } from '../infrastructure/svg/SvgCodec.js';

const factory = new ShapeFactory();
const session = new EditorSession(factory, new LocalTextStorage(), new SvgCodec(factory));
const controller = new CliController(session, new CommandFactory(factory));
await new Repl(controller).run(process.stdin, process.stdout, Boolean(process.stdin.isTTY && process.stdout.isTTY));
