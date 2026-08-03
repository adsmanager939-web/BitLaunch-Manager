import { Router, type IRouter } from "express";
import healthRouter from "./health";
import bitlaunchRouter from "./bitlaunch";
import sessionsRouter from "./sessions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(bitlaunchRouter);
router.use(sessionsRouter);

export default router;
