import { router } from './trpc';
import { authRouter } from './routers/auth';
import { conversationsRouter } from './routers/conversations';
import { messagesRouter } from './routers/messages';
import { contactsRouter } from './routers/contacts';
import { searchRouter } from './routers/search';
import { settingsRouter } from './routers/settings';
import { lineAccountsRouter } from './routers/line-accounts';
import { usersRouter } from './routers/users';
import { overviewRouter } from './routers/overview';
import { tagsRouter } from './routers/tags';
import { labelsRouter } from './routers/labels';
import { notesRouter } from './routers/notes';
import { quickRepliesRouter } from './routers/quickReplies';
import { notificationsRouter } from './routers/notifications';
import { pushRouter } from './routers/push';

/**
 * Root tRPC router.
 * All domain routers are merged here.
 */
export const appRouter = router({
  auth: authRouter,
  conversations: conversationsRouter,
  messages: messagesRouter,
  contacts: contactsRouter,
  search: searchRouter,
  settings: settingsRouter,
  lineAccounts: lineAccountsRouter,
  users: usersRouter,
  overview: overviewRouter,
  tags: tagsRouter,
  labels: labelsRouter,
  notes: notesRouter,
  quickReplies: quickRepliesRouter,
  notifications: notificationsRouter,
  push: pushRouter,
});

export type AppRouter = typeof appRouter;

