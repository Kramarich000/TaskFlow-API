import { Router } from 'express';
import { handleRouteError } from '../../../../utils/handlers/handleRouteError.js';
import { authenticateMiddleware } from '../../../../middlewares/http/authenticateMiddleware.js';
import { validateAndDeleteConfirmationCode } from '../../../../utils/helpers/confirmationHelpers.js';
import { emailConfirmValidate } from '../../../../utils/validators/emailConfirmValidate.js';
import { validateMiddleware } from '../../../../middlewares/http/validateMiddleware.js';
import { findUserByUuidOrThrow } from '../../../../utils/helpers/userHelpers.js';
import prisma from '../../../../utils/prismaConfig/prismaClient.js';

const router = Router();

router.post(
  '/api/auth/google/disable',
  authenticateMiddleware,
  validateMiddleware(emailConfirmValidate),
  async (req, res) => {
    try {
      const userUuid = req.userUuid;
      const { confirmationCode } = req.body;

      const validation = await validateAndDeleteConfirmationCode(
        userUuid,
        'disableGoogle',
        confirmationCode,
      );

      if (!validation.isValid) {
        return res.status(400).json({ error: validation.error });
      }

      await findUserByUuidOrThrow(userUuid, { uuid: true });

      await prisma.user.update({
        where: { uuid: userUuid },
        data: {
          googleSub: null,
          googleOAuthEnabled: false,
        },
      });

      return res.json({ message: 'Google успешно отвязан от вашего аккаунта' });
    } catch (error) {
      handleRouteError(res, error, {
        logPrefix: 'Ошибка при отвязке Google',
        status: 500,
        message: 'Произошла ошибка при отвязке Google. Попробуйте позже.',
      });
    }
  },
);

export default {
  path: '/',
  router,
};
