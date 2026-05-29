import { ForbiddenError } from '../../common/errors/AppError.js';
import { followsRepository } from '../follows/follows.repository.js';
import { usersRepository } from '../users/users.repository.js';
import { pushService } from '../push/push.service.js';
import { chatRepository } from './chat.repository.js';

export const chatService = {
  async sendMessage(senderId: string, recipientId: string, content: string) {
    const mutuals = await followsRepository.getMutualFollowers(senderId);
    if (!mutuals.some((m) => m.userId === recipientId)) {
      throw new ForbiddenError('Only mutual followers can chat');
    }

    const isFirstMessage = !(await chatRepository.hasExistingConversation(senderId, recipientId));

    const message = await chatRepository.createMessage(senderId, recipientId, content);

    if (isFirstMessage) {
      const sender = await usersRepository.getMe(senderId);
      const senderName = sender?.profile?.displayName ?? sender?.email ?? 'Någon';
      pushService
        .sendPushToUser(recipientId, {
          title: 'Nytt meddelande',
          body: `${senderName} skickade dig ett meddelande`,
          url: '/community'
        })
        .catch(() => undefined);
    }

    return message;
  },

  async getConversation(userId: string, partnerId: string, limit: number, beforeId?: string) {
    void chatRepository.markConversationRead(userId, partnerId);
    return chatRepository.getMessages(userId, partnerId, limit, beforeId);
  },

  listConversations(userId: string) {
    return chatRepository.listConversations(userId);
  },

  markRead(userId: string, partnerId: string) {
    return chatRepository.markConversationRead(userId, partnerId);
  },

  getUnreadCount(userId: string) {
    return chatRepository.totalUnreadCount(userId);
  }
};
