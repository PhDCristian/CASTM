import { emitCsv } from '@openedge/compiler-backend-csv';
import {
  EmitOptions,
  EmitResult,
  LirProgram,
  MirProgram
} from '@openedge/compiler-ir';

export function emit(program: MirProgram | LirProgram, backendOptions: EmitOptions = {}): EmitResult {
  return emitCsv(program, backendOptions);
}
