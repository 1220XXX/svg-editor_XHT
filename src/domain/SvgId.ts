import { EditorError } from './errors/EditorError.js';
import { SvgValue } from './SvgValue.js';

export class SvgId {
  static validate(value: string): void {
    SvgValue.validate(value, 'id');
    if (!value || /[\s"'<>/=]/.test(value)) throw new EditorError(`invalid id: ${value}`);
  }
}
