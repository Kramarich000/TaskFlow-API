import { authenticateTelegramMiddleware } from '../../../middlewares/http/authenticateTelegramMiddleware.js';
import { showProfileHandler } from '../../handlers/users/showProfileHandler.js';

export default function registerMeCommand(bot) {
  bot.command('profile', authenticateTelegramMiddleware, showProfileHandler);
}
