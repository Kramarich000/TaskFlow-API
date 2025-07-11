import { Router } from 'express';
import { authenticateMiddleware } from '../../middlewares/http/authenticateMiddleware.js';
import { logBoardFetch } from '../../utils/loggers/boardLoggers.js';
import { getClientIP } from '../../utils/helpers/authHelpers.js';
import { handleRouteError } from '../../utils/handlers/handleRouteError.js';
import { getBoardsWithTaskCounts } from '../../utils/helpers/boardHelpers.js';

const router = Router();

router.get('/api/boards', authenticateMiddleware, async (req, res) => {
  const userUuid = req.userUuid;
  const ipAddress = getClientIP(req);

  try {
    const { boards, totalBoards } = await getBoardsWithTaskCounts(userUuid);

    logBoardFetch(boards.length, totalBoards, userUuid, ipAddress);

    return res.json({
      boards,
      totalBoards,
    });
  } catch (error) {
    handleRouteError(res, error, {
      logPrefix: 'Ошибка при получении досок',
      status: 500,
      message: 'Произошла внутренняя ошибка сервера при получении досок',
    });
  }
});

export default {
  path: '/',
  router,
};
