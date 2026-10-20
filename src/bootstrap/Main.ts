import { ShapeFactory } from '../domain/factories/ShapeFactory.js';
import { EditorSession } from '../application/EditorSession.js';
import { CommandFactory } from '../application/commands/CommandFactory.js';
import { CliController } from '../cli/CliController.js';
import { Repl } from '../cli/Repl.js';

const factory = new ShapeFactory();
const session = new EditorSession(factory);
const controller = new CliController(session, new CommandFactory(factory));
await new Repl(controller).run(process.stdin, process.stdout, Boolean(process.stdin.isTTY && process.stdout.isTTY));
