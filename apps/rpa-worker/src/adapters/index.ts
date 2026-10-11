import { MediaAdapter } from '../watcher-core';
import { mynaviAdapter } from './mynavi';
import { dodaAdapter } from './doda';
import { kimisukaAdapter } from './kimisuka';

// TODO: rekatsu, offerbox, mynavi-tenshoku は poc/配下で動作確認済み。
// 同じパターンでこのディレクトリに移植する（rekatsuはheadless不可な点に注意）。
export const adapters: Record<string, MediaAdapter> = {
  mynavi: mynaviAdapter,
  doda: dodaAdapter,
  kimisuka: kimisukaAdapter,
};
