import type { LineOutgoingMessage } from '../types';
import { getChatSetting } from '../settings';

export async function getWelcomeMessages(): Promise<LineOutgoingMessage[]> {
  const text = await getChatSetting('welcome_message');
  return [{ type: 'text', text }];
}
