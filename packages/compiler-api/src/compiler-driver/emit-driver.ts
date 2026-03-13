import { emitCsv } from '@castm/compiler-backend-csv';
import {
  EmitOptions,
  EmitResult,
  LirProgram,
  MirProgram
} from '@castm/compiler-ir';

export function emit(program: MirProgram | LirProgram, backendOptions: EmitOptions = {}): EmitResult {
  return emitCsv(program, backendOptions);
}
