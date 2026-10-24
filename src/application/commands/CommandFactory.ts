import { EditorError } from '../../domain/errors/EditorError.js';
import type { ShapeFactory } from '../../domain/factories/ShapeFactory.js';
import type { Argument } from '../Argument.js';
import type { Command } from './Command.js';
import { InitCommand } from './InitCommand.js';
import { CanvasCommand } from './CanvasCommand.js';
import { CreateCommand } from './CreateCommand.js';
import { DeleteCommand } from './DeleteCommand.js';
import { MoveCommand } from './MoveCommand.js';
import { ScaleCommand } from './ScaleCommand.js';
import { SetCommand } from './SetCommand.js';
import { TreeCommand } from './TreeCommand.js';
import { ShowCommand } from './ShowCommand.js';
import { HelpCommand } from './HelpCommand.js';
import { UndoCommand } from './UndoCommand.js';
import { RedoCommand } from './RedoCommand.js';
import { ReadCommand } from './ReadCommand.js';
import { SaveCommand } from './SaveCommand.js';

import { GroupCommand } from './GroupCommand.js';
import { UngroupCommand } from './UngroupCommand.js';
import { AddToCommand } from './AddToCommand.js';
import { FrontCommand } from './FrontCommand.js';
import { BackCommand } from './BackCommand.js';
import type { ReparentingStylePolicy } from '../../domain/styles/ReparentingStylePolicy.js';
import { FollowParentStyles } from '../../domain/styles/FollowParentStyles.js';

type Registration = { readonly syntax: string; readonly create: (args: readonly Argument[]) => Command };

export class CommandFactory {
  // The only command-name dispatch point; future registration API belongs here.
  private readonly commands: Map<string, Registration>;
  constructor(factory: ShapeFactory, styles: ReparentingStylePolicy = new FollowParentStyles()) {
    this.commands = new Map([
      ['init', { syntax: 'init [w] [h]', create: args => new InitCommand(args) }],
      ['read', { syntax: 'read <file.svg>', create: args => new ReadCommand(args) }],
      ['save', { syntax: 'save [file.svg]', create: args => new SaveCommand(args) }],
      ['canvas', { syntax: 'canvas [w] [h]', create: args => new CanvasCommand(args) }],
      ['create', { syntax: 'create <rect|circle|ellipse|line|text|g> <id> [params...] [in <gid>]', create: args => new CreateCommand(args, factory) }],
      ['delete', { syntax: 'delete <id>', create: args => new DeleteCommand(args) }],
      ['move', { syntax: 'move <id> <dx> <dy>', create: args => new MoveCommand(args) }],
      ['scale', { syntax: 'scale <id> <factor>', create: args => new ScaleCommand(args) }],
      ['set', { syntax: 'set <id> <attr> <value>', create: args => new SetCommand(args) }],
      ['group', { syntax: 'group <newGid> <id1> <id2>...', create: args => new GroupCommand(args, styles) }],
      ['ungroup', { syntax: 'ungroup <gid>', create: args => new UngroupCommand(args, styles) }],
      ['addto', { syntax: 'addto <gid> <id>', create: args => new AddToCommand(args, styles) }],
      ['front', { syntax: 'front <id>', create: args => new FrontCommand(args) }],
      ['back', { syntax: 'back <id>', create: args => new BackCommand(args) }],
      ['tree', { syntax: 'tree [id]', create: args => new TreeCommand(args) }],
      ['show', { syntax: 'show <id>', create: args => new ShowCommand(args) }],
      ['undo', { syntax: 'undo', create: args => new UndoCommand(args) }],
      ['redo', { syntax: 'redo', create: args => new RedoCommand(args) }],
      ['help', { syntax: 'help', create: args => new HelpCommand(args, [...this.commands.values()].map(entry => entry.syntax).concat(factory.help())) }],
    ]);
  }
  create(tokens: readonly Argument[]): Command {
    const name = tokens[0]?.value;
    const entry = name ? this.commands.get(name) : undefined;
    if (!entry) throw new EditorError(`unknown command: ${name ?? ''}`);
    return entry.create(tokens.slice(1));
  }
}
