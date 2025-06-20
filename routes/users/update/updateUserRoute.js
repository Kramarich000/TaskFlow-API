import { Router } from 'express';
import prisma from '../../../utils/prismaConfig/prismaClient.js';
import { authenticateMiddleware } from '../../../middlewares/http/authenticateMiddleware.js';
import { normalizeEmail } from '../../../utils/validators/normalizeEmail.js';
import {
  getConfirmationCode,
  deleteConfirmationCode,
} from '../../../store/userVerifyStore.js';
import { logUserUpdate, logUserUpdateFailure } from '../../../utils/loggers/authLoggers.js';
import { getClientIP } from '../../../utils/helpers/ipHelper.js';

const router = Router();

router.patch('/api/users', authenticateMiddleware, async (req, res) => {
  const userUuid = req.userUuid;
  const ipAddress = getClientIP(req);
  
  try {
    if (!userUuid) {
      return res
        .status(400)
        .json({ error: 'UUID пользователя не найден в токене' });
    }

    const { confirmationCode, updatedFields } = req.body;
    const { login, email } = updatedFields || {};
    const trimmedLogin = typeof login === 'string' ? login.trim() : undefined;
    const normalizedEmail =
      typeof email === 'string' ? normalizeEmail(email) : undefined;

    if (email !== undefined && !normalizedEmail) {
      return res.status(400).json({ error: 'Некорректный email' });
    }

    if (typeof confirmationCode !== 'string') {
      return res.status(400).json({ error: 'Код подтверждения обязателен' });
    }

    const stored = getConfirmationCode(userUuid);
    if (!stored || String(stored) !== confirmationCode) {
      logUserUpdateFailure(userUuid, ipAddress, 'Invalid confirmation code');
      return res.status(400).json({ error: 'Неверный или просроченный код' });
    }

    deleteConfirmationCode(userUuid);

    const dataToUpdate = {};
    if (trimmedLogin) dataToUpdate.login = trimmedLogin;
    if (normalizedEmail) dataToUpdate.email = normalizedEmail;

    if (Object.keys(dataToUpdate).length === 0) {
      return res.status(400).json({ error: 'Нет данных для обновления' });
    }

    const updatedUser = await prisma.user.update({
      where: { uuid: userUuid },
      data: dataToUpdate,
      select: { login: true, email: true },
    });

    logUserUpdate(userUuid, dataToUpdate, ipAddress);

    return res.json({ message: 'Данные успешно обновлены', user: updatedUser });
  } catch (error) {
    if (error.code === 'P2002') {
      logUserUpdateFailure(userUuid, ipAddress, 'Email or login already taken');
      return res.status(409).json({ error: 'Почта или логин уже занят' });
    }
    if (error.code === 'P2025') {
      logUserUpdateFailure(userUuid, ipAddress, 'User not found');
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    console.error('Ошибка обновления пользователя:', error);
    logUserUpdateFailure(userUuid, ipAddress, 'Server error');
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

export default {
  path: '/',
  router,
};
