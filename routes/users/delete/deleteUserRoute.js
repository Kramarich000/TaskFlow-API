import { Router } from 'express';
import prisma from '../../../utils/prismaConfig/prismaClient.js';
import { authenticateMiddleware } from '../../../middlewares/http/authenticateMiddleware.js';
import {
  getConfirmationCode,
  deleteConfirmationCode,
} from '../../../store/userVerifyStore.js';
import { logUserDelete, logUserDeleteFailure } from '../../../utils/loggers/authLoggers.js';
import { getClientIP } from '../../../utils/helpers/ipHelper.js';

const router = Router();

router.post('/api/users/delete', authenticateMiddleware, async (req, res) => {
  const refreshToken = req.cookies.log___tf_12f_t2;
  const userUuid = req.userUuid;
  const { confirmationCode } = req.body;
  const ipAddress = getClientIP(req);

  if (!refreshToken || !userUuid) {
    return res.status(401).json({ error: 'Нет доступа или неавторизован' });
  }

  const tokenRecord = await prisma.refreshToken.findFirst({
    where: {
      token: refreshToken,
      revoked: false,
      expiresAt: { gt: new Date() },
      user: { uuid: userUuid },
    },
    select: { userId: true },
  });

  if (!tokenRecord) {
    logUserDeleteFailure(userUuid, ipAddress, 'Invalid or expired token');
    return res.status(401).json({ error: 'Недействительный или чужой токен' });
  }

  const expectedCode = getConfirmationCode(userUuid);
  if (!confirmationCode || String(confirmationCode) !== String(expectedCode)) {
    logUserDeleteFailure(userUuid, ipAddress, 'Invalid confirmation code');
    return res.status(400).json({ error: 'Неверный код подтверждения' });
  }

  try {
    await prisma.$transaction([
      prisma.refreshToken.updateMany({
        where: { token: refreshToken },
        data: { revoked: true },
      }),
      prisma.user.delete({
        where: { uuid: userUuid },
      }),
    ]);

    res.clearCookie('log___tf_12f_t2', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
    });

    deleteConfirmationCode(userUuid);

    logUserDelete(userUuid, ipAddress);

    res.status(200).json({ message: 'Вы успешно удалили аккаунт' });
  } catch (error) {
    console.error(error);
    logUserDeleteFailure(userUuid, ipAddress, 'Server error');
    res.status(500).json({ error: 'Ошибка при попытке удалить аккаунт' });
  }
});

export default {
  path: '/',
  router,
};
